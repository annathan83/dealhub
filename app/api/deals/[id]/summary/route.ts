/**
 * POST /api/deals/:id/summary
 *
 * User-triggered AI deal summary. Gathers current facts, metrics, score, buyer fit,
 * generates a comprehensive summary, saves to Google Drive summaries/, and creates
 * a timeline event.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { getEntityPageData } from "@/lib/db/entities";
import { getLatestKpiScorecard } from "@/lib/kpi/kpiScoringService";
import { computeBuyerFit } from "@/lib/kpi/buyerFit";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";
import { computeDerivedMetrics } from "@/lib/kpi/derivedMetricsService";
import { saveSummaryToDrive } from "@/lib/google/drive";
import { logEntityEvent } from "@/lib/services/entity/entityEventService";
import { getDealDisplayName } from "@/types";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

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

  const { data: dealRow } = await supabase
    .from("deals")
    .select("id, name, deal_number, industry, location, city, county, state")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (!dealRow) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const entityData = await getEntityPageData(dealId, user.id);
  if (!entityData?.entity) {
    return NextResponse.json(
      { error: "Deal has no entity data yet. Add files or notes first." },
      { status: 422 }
    );
  }

  const entity = entityData.entity;
  const dealName = getDealDisplayName(dealRow as { name?: string; id: string });
  const industry = (dealRow as { industry?: string }).industry ?? "";
  const location = (dealRow as { location?: string }).location ?? "";

  const [scorecard, { data: profileRow }] = await Promise.all([
    getLatestKpiScorecard(entity.id),
    supabase.from("buyer_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const buyerProfile = profileRow as BuyerProfile | null;
  const factDefs = entityData.fact_definitions ?? [];
  const factVals = entityData.fact_values ?? [];
  const defMap = new Map(factDefs.map((d) => [d.id, d]));
  const getVal = (key: string) => {
    const fd = factDefs.find((d) => d.key === key);
    if (!fd) return null;
    return factVals.find((v) => v.fact_definition_id === fd.id)?.value_raw ?? null;
  };

  const derived = computeDerivedMetrics(factVals, factDefs);
  const coreLabels: Record<string, string> = {
    asking_price: "Asking Price",
    revenue_latest: "Revenue",
    sde_latest: "SDE",
    employees_ft: "Employees (FT)",
    lease_monthly_rent: "Monthly Rent",
    years_in_business: "Year Established",
    owner_hours_per_week: "Owner Involvement",
  };
  const coreLines = Object.entries(coreLabels).map(([key, label]) => {
    const v = getVal(key);
    return `- ${label}: ${v ?? "Not found"}`;
  });

  const metricLines = [
    `Purchase Multiple: ${derived.purchase_multiple.formatted}`,
    `SDE Margin: ${derived.sde_margin.formatted}`,
    `SDE / Employee: ${derived.sde_per_employee.formatted}`,
    `Rent Ratio: ${derived.rent_ratio.formatted}`,
    `Business Age: ${derived.business_age.formatted}`,
    `Owner Dependence: ${derived.owner_dependence.formatted}`,
  ];

  const score = scorecard?.overall_score ?? null;
  const scoreLabel = score === null ? "—" : score >= 8 ? "Strong" : score >= 6 ? "Partial" : "Weak";

  let buyerFitLabel = "No profile";
  if (buyerProfile) {
    const ft = parseFloat(getVal("employees_ft") ?? "") || 0;
    const pt = parseFloat(getVal("employees_pt") ?? "") || 0;
    const fit = computeBuyerFit(buyerProfile, {
      industry: getVal("industry") ?? undefined,
      location: getVal("location") ?? getVal("location_county") ?? undefined,
      sde: parseFloat(getVal("sde_latest") ?? "") || undefined,
      asking_price: parseFloat(getVal("asking_price") ?? "") || undefined,
      total_employees: ft + pt * 0.5 || undefined,
      manager_in_place: getVal("manager_in_place")?.toLowerCase() === "true" || undefined,
      owner_hours_per_week: parseFloat(getVal("owner_hours_per_week") ?? "") || undefined,
    });
    buyerFitLabel = fit.label;
  }

  const missing: string[] = [];
  if (!getVal("asking_price")) missing.push("Asking Price");
  if (!getVal("revenue_latest")) missing.push("Revenue");
  if (!getVal("sde_latest")) missing.push("SDE");
  if (!getVal("employees_ft")) missing.push("Employees (FT) — cannot calculate SDE/Employee");
  if (!getVal("lease_monthly_rent")) missing.push("Monthly Rent");
  if (!getVal("years_in_business")) missing.push("Year Established");
  if (!getVal("owner_hours_per_week") && !getVal("owner_dependence_level")) missing.push("Owner Involvement");

  const contextText = `
Deal: ${dealName}
Industry: ${industry || "—"}
Location: ${location || "—"}

Core facts:
${coreLines.join("\n")}

Metrics:
${metricLines.join("\n")}

Deal Score: ${score !== null ? `${score.toFixed(1)}/10 (${scoreLabel})` : "— (not enough data)"}
Buyer Fit: ${buyerFitLabel}

${missing.length > 0 ? `What's missing: ${missing.join(", ")}` : ""}
`.trim();

  const systemPrompt = `You are a concise deal analyst. Generate a comprehensive, point-in-time summary of this deal for the user's records. Include: deal name and context; key facts and metrics; deal score and buyer fit; 2-4 key observations (e.g. "SDE margin is healthy but owner is full-time — transition risk"); and what's missing if any. Use clear headings. Keep total length to about 300-500 words. Plain text only, no markdown.`;

  let summaryText: string;
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextText },
      ],
    });
    summaryText = completion.choices[0]?.message?.content?.trim() ?? "Summary could not be generated.";
  } catch (err) {
    console.error("[summary] OpenAI error:", err);
    return NextResponse.json(
      { error: "Failed to generate summary. Please try again." },
      { status: 500 }
    );
  }

  const fullSummary = `DEAL SUMMARY — ${dealName}\nGenerated: ${new Date().toISOString()}\n\n${summaryText}`;

  try {
    await saveSummaryToDrive({
      userId: user.id,
      dealId,
      dealName,
      summaryContent: fullSummary,
      dealNumber: (dealRow as { deal_number?: number }).deal_number,
    });
  } catch (driveErr) {
    console.warn("[summary] Drive save failed (non-fatal):", driveErr);
  }

  await logEntityEvent(
    entity.id,
    "ai_summary_generated",
    { display_summary: "Snapshot saved to Google Drive" },
    undefined,
    undefined,
    { actorUserId: user.id }
  );

  return NextResponse.json({ summary: summaryText }, { status: 201 });
}
