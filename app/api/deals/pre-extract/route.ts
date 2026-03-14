/**
 * POST /api/deals/pre-extract
 *
 * Pre-creation fact extraction + scoring + buyer fit.
 * Takes raw text (and optional pre-extracted facts for manual flow) and returns
 * extracted facts, deal score, metrics, and buyer fit WITHOUT creating a deal.
 *
 * Used by CreateDealForm to show the preview screen before the user clicks "Create Deal".
 * When body.facts is provided (manual entry), skips OpenAI and runs scoring only.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { getFactDefinitionsForEntityType } from "@/lib/db/entities";
import { computeKpiScorecard } from "@/lib/kpi/kpiScoringService";
import { extractFactInputs } from "@/lib/kpi/factRegistry";
import { computeBuyerFit } from "@/lib/kpi/buyerFit";
import type { EntityFactValue } from "@/types/entity";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";

/** Core 7 inputs for preview (prompt spec) */
const CORE_FACT_KEYS = [
  "asking_price",
  "revenue_latest",
  "sde_latest",
  "employees_ft",
  "lease_monthly_rent",
  "years_in_business",
  "owner_hours_per_week",
] as const;
// 7 core facts per prompt: Asking Price, Revenue, SDE, Employees (FT), Monthly Rent, Year Established, Owner Involvement
const CORE_LABELS: Record<string, string> = {
  asking_price: "Asking Price",
  revenue_latest: "Revenue",
  sde_latest: "SDE",
  employees_ft: "Employees (FT)",
  lease_monthly_rent: "Monthly Rent",
  years_in_business: "Year Established",
  owner_hours_per_week: "Owner Involvement",
};

function scoreToStatus(score: number | null): "good" | "ok" | "bad" | "missing" {
  if (score === null) return "missing";
  if (score >= 8) return "good";
  if (score >= 6) return "ok";
  return "bad";
}

// Full fact set — extract as many facts as possible from any input
// Required = minimum facts needed to activate deal creation and scoring
const TRIAGE_FACTS = [
  // ── Core / Required ────────────────────────────────────────────────────────
  { key: "asking_price",                    label: "Asking Price",                type: "currency", required: true  },
  { key: "sde_latest",                      label: "SDE / Cash Flow",             type: "currency", required: true  },
  { key: "industry",                        label: "Industry",                    type: "text",     required: true  },
  { key: "location",                        label: "Location",                    type: "text",     required: true  },
  // ── Financial ─────────────────────────────────────────────────────────────
  { key: "revenue_latest",                  label: "Annual Revenue",              type: "currency", required: false },
  { key: "ebitda_latest",                   label: "EBITDA",                      type: "currency", required: false },
  { key: "revenue_year_1",                  label: "Revenue (Prior Year)",        type: "currency", required: false },
  { key: "revenue_year_2",                  label: "Revenue (2 Years Prior)",     type: "currency", required: false },
  { key: "sde_year_1",                      label: "SDE (Prior Year)",            type: "currency", required: false },
  { key: "gross_profit",                    label: "Gross Profit",                type: "currency", required: false },
  { key: "net_income",                      label: "Net Income",                  type: "currency", required: false },
  { key: "addbacks_summary",                label: "Addbacks Summary",            type: "text",     required: false },
  // ── Deal Terms ────────────────────────────────────────────────────────────
  { key: "deal_structure",                  label: "Deal Structure",              type: "text",     required: false },
  { key: "seller_financing",                label: "Seller Financing",            type: "currency", required: false },
  { key: "down_payment",                    label: "Down Payment",                type: "currency", required: false },
  { key: "inventory_included",              label: "Inventory Included",          type: "boolean",  required: false },
  { key: "real_estate_included",            label: "Real Estate Included",        type: "boolean",  required: false },
  { key: "lease_monthly_rent",              label: "Monthly Rent",                type: "currency", required: false },
  { key: "lease_expiration_date",           label: "Lease Expiration",            type: "text",     required: false },
  { key: "working_capital_intensity",       label: "Working Capital Intensity",   type: "text",     required: false },
  { key: "capex_intensity",                 label: "CapEx Intensity",             type: "text",     required: false },
  // ── Operations ────────────────────────────────────────────────────────────
  { key: "years_in_business",               label: "Years in Business",           type: "number",   required: false },
  { key: "employees_ft",                    label: "Full-Time Employees",         type: "number",   required: false },
  { key: "employees_pt",                    label: "Part-Time Employees",         type: "number",   required: false },
  { key: "owner_hours_per_week",            label: "Owner Hours/Week",            type: "number",   required: false },
  { key: "owner_in_sales",                  label: "Owner Drives Sales",          type: "boolean",  required: false },
  { key: "owner_in_operations",             label: "Owner in Operations",         type: "boolean",  required: false },
  { key: "manager_in_place",                label: "Manager in Place",            type: "boolean",  required: false },
  { key: "customer_concentration_top1_pct", label: "Top Customer %",             type: "percent",  required: false },
  { key: "customer_concentration_top5_pct", label: "Top 5 Customers %",          type: "percent",  required: false },
  { key: "vendor_concentration_top1_pct",   label: "Top Vendor %",               type: "percent",  required: false },
  { key: "recurring_revenue_pct",           label: "Recurring Revenue %",         type: "percent",  required: false },
  { key: "repeat_revenue_pct",              label: "Repeat Revenue %",            type: "percent",  required: false },
  { key: "seasonality",                     label: "Seasonality",                 type: "text",     required: false },
  { key: "seller_reason",                   label: "Reason for Sale",             type: "text",     required: false },
  { key: "transition_support",              label: "Transition Support",          type: "text",     required: false },
  // ── Risk ──────────────────────────────────────────────────────────────────
  { key: "legal_risk_flag",                 label: "Legal Risk",                  type: "boolean",  required: false },
  { key: "compliance_risk_flag",            label: "Compliance Risk",             type: "boolean",  required: false },
  { key: "licensing_dependency",            label: "Licensing Dependency",        type: "boolean",  required: false },
];

export type PreExtractCandidate = {
  fact_key: string;
  label: string;
  extracted_value_raw: string;
  confidence: number;
  snippet: string | null;
  required: boolean;
};

export type PreExtractResult = {
  candidates: PreExtractCandidate[];
  missing_required: string[];
  model: string;
};

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

  let body: { text?: string; facts?: Array<{ fact_key: string; value_raw: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const manualFacts = body.facts ?? [];
  const isManualMode = manualFacts.length > 0;

  if (!isManualMode && (!text || text.length < 20)) {
    return NextResponse.json({ error: "Text too short to extract facts from." }, { status: 422 });
  }

  const factList = TRIAGE_FACTS.map(
    (f) => `- key: "${f.key}" | label: "${f.label}" | type: ${f.type}${f.required ? " | REQUIRED" : ""}`
  ).join("\n");

  const prompt = `You are a business acquisition analyst. Extract ALL available structured facts from the listing or document text below. Extract as many facts as you can find — do not limit yourself to just the required ones.

Facts to extract:
${factList}

Instructions:
- Extract EVERY fact that is explicitly stated or clearly implied in the text.
- Do NOT guess or hallucinate values not present in the text.
- For currency values, return the numeric amount only (e.g. 1500000 for $1.5M, 240000 for $240K).
- For percentages, return the decimal (e.g. 0.25 for 25%).
- For boolean facts, return "true" or "false".
- confidence: 0.0–1.0 (1.0 = explicitly stated, 0.7 = clearly implied, 0.4 = estimated).
- snippet: the exact phrase from the text that supports this fact (≤150 chars).
- If a fact is not present in the text, omit it entirely.
- For industry: return a short label like "Childcare", "HVAC", "Retail", "B2B Services", etc.
- For location: return city/state or region like "Broward County, FL" or "Dallas, TX".
- Extract ALL financial figures, employee counts, operational details, and deal terms you can find.

Return a JSON object:
{
  "facts": [
    {
      "fact_key": "asking_price",
      "extracted_value_raw": "1500000",
      "confidence": 0.95,
      "snippet": "Listed at $1.5M"
    }
  ]
}

Text to analyze (first 8000 chars):
---
${text.slice(0, 8000)}
---`;

  let candidates: PreExtractCandidate[] = [];
  const factMeta = new Map(TRIAGE_FACTS.map((f) => [f.key, f]));

  if (isManualMode) {
    for (const f of manualFacts) {
      const meta = factMeta.get(f.fact_key);
      if (!meta || !f.value_raw?.trim()) continue;
      candidates.push({
        fact_key: f.fact_key,
        label: meta.label,
        extracted_value_raw: String(f.value_raw).trim(),
        confidence: 1,
        snippet: null,
        required: meta.required,
      });
    }
  } else {
    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 3000,
      });

      const rawContent = response.choices[0]?.message?.content ?? "{}";
      let parsed: { facts?: unknown[] } = {};
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        return NextResponse.json({ candidates: [], missing_required: ["industry", "location", "sde_latest", "asking_price"], model: MODEL });
      }

      for (const item of parsed.facts ?? []) {
        if (!item || typeof item !== "object") continue;
        const f = item as Record<string, unknown>;
        const key = f.fact_key as string;
        const meta = factMeta.get(key);
        if (!meta) continue;

        const rawValue = f.extracted_value_raw;
        if (!rawValue || String(rawValue).trim() === "") continue;

        candidates.push({
          fact_key: key,
          label: meta.label,
          extracted_value_raw: String(rawValue),
          confidence: typeof f.confidence === "number" ? Math.min(1, Math.max(0, f.confidence)) : 0.5,
          snippet: typeof f.snippet === "string" ? f.snippet.slice(0, 200) : null,
          required: meta.required,
        });
      }
    } catch (err) {
      console.error("[pre-extract] OpenAI call failed:", err);
      return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
    }
  }

  const extractedKeys = new Set(candidates.map((c) => c.fact_key));
  const missing_required = TRIAGE_FACTS
    .filter((f) => f.required && !extractedKeys.has(f.key))
    .map((f) => f.key);

  // ── Enrich with scoring and buyer fit (preview) ─────────────────────────────
  const { data: dealTypeRow } = await supabase
    .from("entity_types")
    .select("id")
    .eq("key", "deal")
    .maybeSingle();
  const dealEntityTypeId = dealTypeRow?.id as string | null;
  if (!dealEntityTypeId) {
    return NextResponse.json({
      candidates,
      missing_required,
      model: MODEL,
      suggestedName: "",
      context: { industry: null, location: null },
      coreFacts: [],
      metrics: [],
      dealScore: null,
      dealScoreLabel: null,
      metricsAvailable: 0,
      buyerFit: null,
      otherFacts: [],
      rawText: text,
    });
  }

  const factDefs = await getFactDefinitionsForEntityType(dealEntityTypeId);
  const keyToDef = new Map(factDefs.map((fd) => [fd.key, fd]));

  const syntheticFactValues: EntityFactValue[] = candidates
    .filter((c) => keyToDef.has(c.fact_key))
    .map((c) => {
      const fd = keyToDef.get(c.fact_key)!;
      return {
        id: "",
        entity_id: "",
        fact_definition_id: fd.id,
        value_raw: c.extracted_value_raw,
        value_normalized_json: {},
        status: "known" as const,
        confidence: c.confidence,
        current_evidence_id: null,
        value_source_type: "ai_extracted" as const,
        review_status: "unreviewed" as const,
        confirmed_by_user_id: null,
        confirmed_at: null,
        change_reason: null,
        updated_at: new Date().toISOString(),
      };
    });

  const factDefIdToKey = new Map(factDefs.map((fd) => [fd.id, fd.key]));
  const scorecard = computeKpiScorecard(syntheticFactValues, factDefIdToKey);
  const rawInputs = extractFactInputs(syntheticFactValues, factDefIdToKey);

  const industry = (candidates.find((c) => c.fact_key === "industry")?.extracted_value_raw ?? "").trim() || null;
  const location = (candidates.find((c) => c.fact_key === "location")?.extracted_value_raw ?? "").trim() || null;
  const suggestedName = industry && location ? `${industry} — ${location}` : industry || location || (text.slice(0, 60).trim() || "New deal");

  const coreFacts = CORE_FACT_KEYS.map((key) => {
    const c = candidates.find((x) => x.fact_key === key);
    const value = c?.extracted_value_raw?.trim() || null;
    return { label: CORE_LABELS[key] ?? key, value };
  });

  const formulaFor = (key: string) =>
    key === "price_multiple" ? "Asking Price ÷ SDE" :
    key === "earnings_margin" ? "SDE ÷ Revenue" :
    key === "sde_per_employee" ? "SDE ÷ Employees (FT)" :
    key === "rent_ratio" ? "(Monthly Rent × 12) ÷ Revenue" :
    key === "business_age" ? "Current Year − Year Established" :
    key === "owner_dependence" ? "Mapped from Owner Involvement" : "";
  const metrics = scorecard.kpis.map((kpi) => ({
    label: kpi.label,
    formula: formulaFor(kpi.kpi_key),
    value: kpi.raw_value,
    score: kpi.score,
    status: scoreToStatus(kpi.score),
  }));

  const dealScore = scorecard.overall_score;
  const dealScoreLabel =
    dealScore === null ? null : dealScore >= 8 ? "Strong" : dealScore >= 6 ? "Partial" : "Weak";
  const metricsAvailable = scorecard.kpis.filter((k) => k.score !== null).length;

  let buyerFit: {
    label: "Strong Fit" | "Partial Fit" | "Weak Fit" | "No Fit";
    matchCount: number;
    totalCriteria: number;
    summary: string;
  } | null = null;

  const { data: profileRow } = await supabase
    .from("buyer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRow as BuyerProfile | null;
  const hasProfile =
    profile &&
    ((profile.target_sde_min != null || profile.target_sde_max != null) ||
      (profile.target_purchase_price_min != null || profile.target_purchase_price_max != null) ||
      (profile.preferred_industries?.length ?? 0) > 0 ||
      (profile.preferred_locations?.length ?? 0) > 0 ||
      profile.max_employees != null ||
      profile.manager_required ||
      profile.owner_operator_ok != null);

  if (hasProfile && profile) {
    const dealForFit = {
      industry: industry ?? undefined,
      location: location ?? undefined,
      sde: (rawInputs.sde_latest as number | null) ?? (rawInputs.ebitda_latest as number | null) ?? undefined,
      asking_price: (rawInputs.asking_price as number | null) ?? undefined,
      total_employees: ((rawInputs.employees_ft as number | null) ?? 0) + ((rawInputs.employees_pt as number | null) ?? 0) * 0.5 || undefined,
      manager_in_place: (rawInputs.manager_in_place as boolean | null) ?? undefined,
      owner_hours_per_week: (rawInputs.owner_hours_per_week as number | null) ?? undefined,
    };
    const fitResult = computeBuyerFit(profile, dealForFit);
    const fitLabel =
      fitResult.verdict === "GOOD_FIT" || fitResult.verdict === "FIT"
        ? "Strong Fit"
        : fitResult.verdict === "PARTIAL_FIT"
          ? "Partial Fit"
          : "Weak Fit";
    buyerFit = {
      label: fitLabel as "Strong Fit" | "Partial Fit" | "Weak Fit" | "No Fit",
      matchCount: fitResult.match_count,
      totalCriteria: fitResult.criteria.length || 1,
      summary:
        fitResult.criteria.length > 0
          ? `${fitResult.match_count} of ${fitResult.criteria.length} criteria match`
          : fitResult.bullets[0] ?? "No criteria configured",
    };
  }

  const contextKeys = new Set(["industry", "location", ...CORE_FACT_KEYS]);
  const otherFacts = candidates
    .filter((c) => !contextKeys.has(c.fact_key))
    .map((c) => ({ label: c.label, value: c.extracted_value_raw?.trim() || null }));

  return NextResponse.json({
    candidates,
    missing_required,
    model: MODEL,
    suggestedName,
    context: { industry, location },
    coreFacts,
    metrics,
    dealScore,
    dealScoreLabel,
    metricsAvailable,
    buyerFit,
    otherFacts,
    rawText: text,
  });
}
