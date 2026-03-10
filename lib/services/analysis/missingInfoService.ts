/**
 * missingInfoService
 *
 * Deterministic missing information detection.
 * No AI required — compares current facts against industry-specific
 * diligence checklists and returns what's still needed.
 *
 * Triggered automatically after any fact change.
 * Stored as analysis_snapshot with type "missing_info".
 */

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  insertAnalysisSnapshot,
} from "@/lib/db/entities";
import type { EntityFactValue, FactDefinition } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MissingInfoItem = {
  key: string;
  label: string;
  category: "financial" | "operational" | "legal" | "market" | "deal_terms";
  priority: "critical" | "important" | "nice_to_have";
  why: string;  // one-sentence explanation of why this matters
};

export type MissingInfoResult = {
  missing: MissingInfoItem[];
  total_checked: number;
  critical_count: number;
  important_count: number;
  generated_at: string;
};

// ─── Industry diligence checklists ────────────────────────────────────────────
// Maps industry keywords → required fact keys with metadata.
// "universal" applies to all industries.

type DiligenceItem = {
  fact_key: string;
  label: string;
  category: MissingInfoItem["category"];
  priority: MissingInfoItem["priority"];
  why: string;
};

const UNIVERSAL_CHECKLIST: DiligenceItem[] = [
  { fact_key: "asking_price",        label: "Asking Price",           category: "deal_terms",  priority: "critical",      why: "Required to calculate purchase multiple and assess deal value." },
  { fact_key: "revenue_latest",      label: "Latest Annual Revenue",  category: "financial",   priority: "critical",      why: "Core financial metric for sizing the business." },
  { fact_key: "sde_latest",          label: "SDE / EBITDA",           category: "financial",   priority: "critical",      why: "Owner earnings are the primary basis for valuation." },
  { fact_key: "years_in_business",   label: "Years in Business",      category: "operational", priority: "critical",      why: "Indicates business stability and track record." },
  { fact_key: "employees_ft",        label: "Full-Time Employees",    category: "operational", priority: "important",     why: "Needed to assess management depth and scalability." },
  { fact_key: "manager_in_place",    label: "Manager in Place",       category: "operational", priority: "important",     why: "Key indicator of owner-dependency risk." },
  { fact_key: "owner_hours_per_week",label: "Owner Hours / Week",     category: "operational", priority: "important",     why: "Quantifies owner dependence and transition complexity." },
  { fact_key: "revenue_year_1",      label: "Prior Year Revenue",     category: "financial",   priority: "important",     why: "Needed to calculate revenue trend." },
  { fact_key: "sde_year_1",          label: "Prior Year SDE",         category: "financial",   priority: "important",     why: "Needed to calculate earnings trend." },
  { fact_key: "lease_monthly_rent",  label: "Monthly Lease / Rent",   category: "operational", priority: "important",     why: "Significant fixed cost that affects cash flow." },
  { fact_key: "lease_remaining_months", label: "Lease Remaining",     category: "legal",       priority: "important",     why: "Short remaining lease is a key risk factor." },
  { fact_key: "reason_for_sale",     label: "Reason for Sale",        category: "deal_terms",  priority: "important",     why: "Seller motivation affects negotiation and risk." },
  { fact_key: "deal_structure",      label: "Deal Structure",         category: "deal_terms",  priority: "nice_to_have",  why: "Asset vs stock sale has significant tax implications." },
  { fact_key: "seller_financing",    label: "Seller Financing",       category: "deal_terms",  priority: "nice_to_have",  why: "Seller carry-back reduces upfront capital requirement." },
  { fact_key: "customer_concentration_top1_pct", label: "Customer Concentration", category: "market", priority: "nice_to_have", why: "High concentration in one customer is a key risk." },
  { fact_key: "recurring_revenue_pct", label: "Recurring Revenue %",  category: "financial",   priority: "nice_to_have",  why: "Higher recurring revenue means more predictable cash flow." },
];

const INDUSTRY_OVERLAYS: Record<string, DiligenceItem[]> = {
  childcare: [
    { fact_key: "enrollment_current",     label: "Current Enrollment",       category: "operational", priority: "critical",  why: "Primary revenue driver for childcare businesses." },
    { fact_key: "enrollment_capacity",    label: "Licensed Capacity",        category: "legal",       priority: "critical",  why: "Sets the revenue ceiling and determines growth potential." },
    { fact_key: "licensing_status",       label: "Licensing Status",         category: "legal",       priority: "critical",  why: "License is required to operate — any issues are deal-breakers." },
    { fact_key: "teacher_certifications", label: "Teacher Certifications",   category: "legal",       priority: "important", why: "Staffing ratios and certifications are regulatory requirements." },
    { fact_key: "tuition_rate_monthly",   label: "Monthly Tuition Rate",     category: "financial",   priority: "important", why: "Per-student revenue is needed to validate enrollment-based revenue." },
    { fact_key: "waitlist_count",         label: "Waitlist Count",           category: "market",      priority: "nice_to_have", why: "Waitlist indicates demand exceeds supply — growth signal." },
  ],
  restaurant: [
    { fact_key: "seating_capacity",       label: "Seating Capacity",         category: "operational", priority: "important", why: "Determines maximum revenue potential." },
    { fact_key: "avg_check_size",         label: "Average Check Size",       category: "financial",   priority: "important", why: "Key metric for revenue per customer analysis." },
    { fact_key: "food_cost_pct",          label: "Food Cost %",              category: "financial",   priority: "important", why: "Food cost is the largest variable expense in restaurants." },
    { fact_key: "labor_cost_pct",         label: "Labor Cost %",             category: "financial",   priority: "important", why: "Labor is typically 30-35% of revenue in restaurants." },
    { fact_key: "health_inspection_score",label: "Health Inspection Score",  category: "legal",       priority: "important", why: "Recent violations can indicate operational or compliance risk." },
  ],
  healthcare: [
    { fact_key: "patient_count_active",   label: "Active Patient Count",     category: "operational", priority: "critical",  why: "Patient panel size is the primary revenue driver." },
    { fact_key: "insurance_mix",          label: "Insurance Mix",            category: "financial",   priority: "important", why: "Payer mix significantly affects revenue per patient." },
    { fact_key: "licensing_status",       label: "Licensing / Credentials",  category: "legal",       priority: "critical",  why: "Healthcare licenses are required and non-transferable." },
    { fact_key: "malpractice_history",    label: "Malpractice History",      category: "legal",       priority: "important", why: "Outstanding claims are a significant liability." },
  ],
  retail: [
    { fact_key: "inventory_value",        label: "Inventory Value",          category: "financial",   priority: "important", why: "Inventory is often a significant part of the deal price." },
    { fact_key: "avg_transaction_value",  label: "Avg Transaction Value",    category: "financial",   priority: "important", why: "Key metric for revenue per customer." },
    { fact_key: "foot_traffic_monthly",   label: "Monthly Foot Traffic",     category: "market",      priority: "nice_to_have", why: "Traffic trends indicate demand health." },
  ],
  "home services": [
    { fact_key: "repeat_customer_pct",    label: "Repeat Customer %",        category: "market",      priority: "important", why: "Repeat business indicates customer satisfaction and retention." },
    { fact_key: "service_area_radius",    label: "Service Area",             category: "operational", priority: "nice_to_have", why: "Geographic scope affects growth potential." },
    { fact_key: "contractor_vs_employee", label: "Contractor vs Employee",   category: "legal",       priority: "important", why: "Misclassification is a significant legal and tax risk." },
  ],
};

// ─── Industry matching ────────────────────────────────────────────────────────

function matchIndustry(industry: string | null): string | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();
  for (const key of Object.keys(INDUSTRY_OVERLAYS)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function detectMissingInfo(
  entityId: string,
  entityTypeId: string,
  industry: string | null
): Promise<MissingInfoResult> {
  const [factValues, factDefs] = await Promise.all([
    getCurrentFactsForEntity(entityId),
    getFactDefinitionsForEntityType(entityTypeId),
  ]);

  // Build a set of fact keys that are currently filled
  const defMap = new Map<string, FactDefinition>(factDefs.map((d) => [d.id, d]));
  const filledKeys = new Set<string>();
  for (const fv of factValues) {
    if (fv.value_raw && fv.status !== "missing") {
      const def = defMap.get(fv.fact_definition_id);
      if (def) filledKeys.add(def.key);
    }
  }

  // Build checklist: universal + industry overlay
  const industryKey = matchIndustry(industry);
  const checklist: DiligenceItem[] = [
    ...UNIVERSAL_CHECKLIST,
    ...(industryKey ? (INDUSTRY_OVERLAYS[industryKey] ?? []) : []),
  ];

  // Deduplicate by fact_key (industry overlay can override universal)
  const seen = new Set<string>();
  const deduped: DiligenceItem[] = [];
  for (const item of [...(industryKey ? (INDUSTRY_OVERLAYS[industryKey] ?? []) : []), ...UNIVERSAL_CHECKLIST]) {
    if (!seen.has(item.fact_key)) {
      seen.add(item.fact_key);
      deduped.push(item);
    }
  }

  // Find missing items
  const missing: MissingInfoItem[] = deduped
    .filter((item) => !filledKeys.has(item.fact_key))
    .map((item) => ({
      key: item.fact_key,
      label: item.label,
      category: item.category,
      priority: item.priority,
      why: item.why,
    }));

  const result: MissingInfoResult = {
    missing,
    total_checked: deduped.length,
    critical_count: missing.filter((m) => m.priority === "critical").length,
    important_count: missing.filter((m) => m.priority === "important").length,
    generated_at: new Date().toISOString(),
  };

  // Persist as analysis_snapshot (fire-and-forget)
  insertAnalysisSnapshot({
    entity_id: entityId,
    analysis_type: "missing_info",
    title: "Missing Information",
    content_json: result as unknown as Record<string, unknown>,
    model_name: null,
    prompt_version: "v1",
    run_id: null,
  }).catch((err) => {
    console.error("[missingInfoService] Failed to persist missing_info snapshot:", err);
  });

  return result;
}

/**
 * Load the latest persisted missing info result for an entity.
 */
export async function getLatestMissingInfo(
  entityId: string
): Promise<MissingInfoResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_snapshots")
    .select("content_json")
    .eq("entity_id", entityId)
    .eq("analysis_type", "missing_info")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.content_json) return null;
  return data.content_json as MissingInfoResult;
}
