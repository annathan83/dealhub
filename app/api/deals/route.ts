import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureDealSubfolders } from "@/lib/google/drive";
import { seedManualFactsFromDeal } from "@/lib/services/entity/dealFactSeedService";
import { seedExtractedFactsFromDeal } from "@/lib/services/entity/dealFactSeedService";
import { runPostFactPipeline } from "@/lib/services/analysis/postFactOrchestrator";
import { getEntityByLegacyDealId } from "@/lib/db/entities";
import { scoreAndPersistKpis } from "@/lib/kpi/kpiScoringService";
import { runAndApplyFactInference } from "@/lib/services/facts/factInferenceService";
import { computeTriageRecommendation } from "@/lib/kpi/triageRecommendation";
import type { TriageVerdict } from "@/lib/kpi/triageRecommendation";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    display_alias?: string | null;
    industry_category?: string | null;
    industry?: string | null;
    state?: string | null;
    county?: string | null;
    city?: string | null;
    location?: string | null;
    deal_source_category?: string | null;
    deal_source_detail?: string | null;
    asking_price?: string | null;
    sde?: string | null;
    multiple?: string | null;
    // Pre-extracted facts from the listing (from /api/deals/pre-extract)
    extracted_facts?: Array<{
      fact_key: string;
      value_raw: string;
      confidence: number;
      snippet?: string | null;
    }> | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const displayName = body.display_alias?.trim() || body.name?.trim();
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required." }, { status: 422 });
  }

  // ── 1. Insert the deal row (name = display name). Omit display_alias/last_activity_at so this works without migration 049. ─
  const { data: deal, error: insertError } = await supabase
    .from("deals")
    .insert({
      user_id: user.id,
      name: displayName,
      industry_category: body.industry_category?.trim() || null,
      industry: body.industry?.trim() || null,
      state: body.state?.trim() || null,
      county: body.county?.trim() || null,
      city: body.city?.trim() || null,
      location: body.location?.trim() || null,
      deal_source_category: body.deal_source_category?.trim() || null,
      deal_source_detail: body.deal_source_detail?.trim() || null,
      status: "active",
      intake_status: "pending",
      asking_price: body.asking_price?.trim() || null,
      sde: body.sde?.trim() || null,
      multiple: body.multiple?.trim() || null,
    })
    .select("id, name, deal_number")
    .single();

  if (insertError || !deal) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create deal." },
      { status: 500 }
    );
  }

  const dealId = deal.id as string;

  // ── 2. Seed facts and trigger initial scoring ─────────────────────────────────
  // We await the seeding so scoring can read the facts immediately after.
  let intakeVerdict: TriageVerdict | null = null;
  let intakeFlags: string[] = [];
  let intakeScore: number | null = null;
  let intakeOpinion: string | null = null;

  try {
    // Seed manual fields (asking_price, sde, industry, location) as user_override facts
    await seedManualFactsFromDeal(dealId, user.id, {
      asking_price: body.asking_price,
      sde: body.sde,
      industry: body.industry,
      location: body.location,
      state: body.state,
      county: body.county,
      city: body.city,
    });

    // If pre-extracted facts were provided (from paste-and-extract flow), seed those too.
    // These are ai_extracted facts — they will not overwrite the manual user_override facts above.
    if (body.extracted_facts && body.extracted_facts.length > 0) {
      await seedExtractedFactsFromDeal(dealId, user.id, body.extracted_facts);
    }

    const entity = await getEntityByLegacyDealId(dealId, user.id);
    if (entity) {
      // Apply the user's default scoring config to this new deal entity (non-fatal).
      try {
        const { data: userSettings } = await supabase
          .from("user_settings")
          .select("default_scoring_config")
          .eq("user_id", user.id)
          .maybeSingle();
        const defaultConfig = userSettings?.default_scoring_config as Record<string, number> | null;
        if (defaultConfig && Object.keys(defaultConfig).length > 0) {
          const existingMeta = (entity.metadata_json as Record<string, unknown>) ?? {};
          await supabase
            .from("entities")
            .update({ metadata_json: { ...existingMeta, scoring_config: defaultConfig } })
            .eq("id", entity.id);
        }
      } catch (configErr) {
        console.warn("[createDeal] Could not apply default scoring config (non-fatal):", configErr);
      }

      const industry = body.industry?.trim() || null;

      // Step 1: Fact inference (synchronous — inferred facts feed into scoring)
      await runAndApplyFactInference(entity.id, entity.entity_type_id).catch((err) => {
        console.warn("[createDeal] Fact inference failed (non-fatal):", err);
      });

      // Step 2: KPI scoring — awaited so we can compute the intake triage verdict
      // before returning to the client. SWOT and missing info run fire-and-forget.
      const scorecard = await scoreAndPersistKpis(entity.id, entity.entity_type_id, {
        triggerType: "extraction",
        triggerReason: "Initial deal creation",
      }).catch((err) => {
        console.warn("[createDeal] KPI scoring failed (non-fatal):", err);
        return null;
      });

      // Compute triage verdict for intake assessment
      if (scorecard) {
        const rec = computeTriageRecommendation(scorecard);
        intakeVerdict = rec.verdict;
        intakeFlags = rec.flags;
        intakeScore = scorecard.overall_score ?? null;
        intakeOpinion = rec.opinion;
      }

      // Steps 3 + 4: SWOT and missing info — fire-and-forget (AI, takes longer)
      const { generateSwotFromFacts } = await import("@/lib/services/analysis/swotAnalysisService");
      const { detectMissingInfo } = await import("@/lib/services/analysis/missingInfoService");
      generateSwotFromFacts(entity.id, entity.entity_type_id, entity.title).catch(() => {});
      detectMissingInfo(entity.id, entity.entity_type_id, industry).catch(() => {});
    }

    // If intake verdict is not PROBABLY_PASS, promote the deal immediately
    if (intakeVerdict !== "PROBABLY_PASS") {
      await supabase
        .from("deals")
        .update({ intake_status: "promoted" })
        .eq("id", dealId)
        .eq("user_id", user.id);
    }
    // If PROBABLY_PASS, leave intake_status = 'pending' — the client will call
    // /api/deals/[id]/intake-reject with action='reject' or action='keep'

  } catch (err) {
    console.error("[createDeal] Post-creation pipeline failed (non-fatal):", err);
    // On pipeline failure, promote the deal so it doesn't get stuck as pending (Supabase builder has no .catch())
    try {
      await supabase
        .from("deals")
        .update({ intake_status: "promoted" })
        .eq("id", dealId)
        .eq("user_id", user.id);
    } catch (_promoteErr) {
      // ignore
    }
  }

  // ── 3. Provision Drive folder + subfolders (non-fatal) ───────────────────────
  let driveFolderError: string | null = null;
  try {
    await ensureDealSubfolders(
      user.id,
      dealId,
      displayName,
      deal.deal_number as number
    );
  } catch (err) {
    driveFolderError = err instanceof Error ? err.message : "Drive folders could not be created.";
    console.warn(`[createDeal] Drive folder creation skipped for deal ${dealId}:`, driveFolderError);
  }

  return NextResponse.json(
    {
      id: dealId,
      name: displayName,
      deal_number: deal.deal_number,
      driveFolderError,
      // Intake assessment result — client uses this to decide whether to show
      // the rejection screen or navigate directly to the deal.
      intake_verdict: intakeVerdict,
      intake_flags: intakeFlags,
      intake_score: intakeScore,
      intake_opinion: intakeOpinion,
    },
    { status: 201 }
  );
}
