import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureDealSubfolders } from "@/lib/google/drive";
import { seedManualFactsFromDeal } from "@/lib/services/entity/dealFactSeedService";
import { seedExtractedFactsFromDeal } from "@/lib/services/entity/dealFactSeedService";
import { runPostFactPipeline } from "@/lib/services/analysis/postFactOrchestrator";
import { getEntityByLegacyDealId } from "@/lib/db/entities";

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

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Deal name is required." }, { status: 422 });
  }

  // ── 1. Insert the deal row ────────────────────────────────────────────────────
  const { data: deal, error: insertError } = await supabase
    .from("deals")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      industry_category: body.industry_category?.trim() || null,
      industry: body.industry?.trim() || null,
      state: body.state?.trim() || null,
      county: body.county?.trim() || null,
      city: body.city?.trim() || null,
      location: body.location?.trim() || null,
      deal_source_category: body.deal_source_category?.trim() || null,
      deal_source_detail: body.deal_source_detail?.trim() || null,
      status: "active",
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

    // Immediately run the post-fact pipeline (scoring + inference).
    // Scoring is deterministic and fast — we await it so the Analysis tab
    // has a score ready when the user arrives.
    // SWOT and missing info run fire-and-forget (they use AI and take longer).
    const entity = await getEntityByLegacyDealId(dealId, user.id);
    if (entity) {
      const industry = body.industry?.trim() || null;
      await runPostFactPipeline({
        entityId: entity.id,
        entityTypeId: entity.entity_type_id,
        entityTitle: entity.title,
        industry,
        triggerType: "extraction",
        triggerReason: "Initial deal creation",
      });
    }
  } catch (err) {
    console.error("[createDeal] Post-creation pipeline failed (non-fatal):", err);
  }

  // ── 3. Provision Drive folder + subfolders (non-fatal) ───────────────────────
  let driveFolderError: string | null = null;
  try {
    await ensureDealSubfolders(
      user.id,
      dealId,
      deal.name as string,
      deal.deal_number as number
    );
  } catch (err) {
    driveFolderError = err instanceof Error ? err.message : "Drive folders could not be created.";
    console.warn(`[createDeal] Drive folder creation skipped for deal ${dealId}:`, driveFolderError);
  }

  return NextResponse.json(
    { id: dealId, name: deal.name, deal_number: deal.deal_number, driveFolderError },
    { status: 201 }
  );
}
