/**
 * POST /api/deals/pre-extract
 *
 * Lightweight pre-creation fact extraction.
 * Takes raw text (pasted listing, broker email, etc.) and returns extracted
 * fact candidates WITHOUT creating a deal or writing to the database.
 *
 * Used by CreateDealForm to show extracted facts for review before the user
 * commits to creating the deal.
 *
 * Returns the 4 minimum required facts prominently, plus all other triage facts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import OpenAI from "openai";

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini";

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

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  if (!text || text.length < 20) {
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

    const factMeta = new Map(TRIAGE_FACTS.map((f) => [f.key, f]));
    const candidates: PreExtractCandidate[] = [];

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

    const extractedKeys = new Set(candidates.map((c) => c.fact_key));
    const missing_required = TRIAGE_FACTS
      .filter((f) => f.required && !extractedKeys.has(f.key))
      .map((f) => f.key);

    return NextResponse.json({ candidates, missing_required, model: MODEL });
  } catch (err) {
    console.error("[pre-extract] OpenAI call failed:", err);
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
