/**
 * Fact Registry
 *
 * Maps fact_definition keys to their expected value types and
 * provides helpers for extracting typed values from entity_fact_values.
 *
 * This is the single place that knows how to parse each fact's raw_value
 * into a typed number, boolean, or string for use in KPI scoring.
 *
 * To add a new fact: add it to FACT_REGISTRY below.
 * The KPI scoring engine reads from this registry automatically.
 *
 * Future: industry-specific fact overlays can extend this registry
 * by merging additional entries for vertical-specific facts.
 */

import type { EntityFactValue } from "@/types/entity";

export type FactValueType = "currency" | "number" | "percent" | "boolean" | "text" | "date";

export type FactRegistryEntry = {
  key: string;
  label: string;
  value_type: FactValueType;
  description: string;
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FACT_REGISTRY: FactRegistryEntry[] = [
  // Financial
  { key: "asking_price",           label: "Asking Price",                value_type: "currency", description: "Seller's stated asking price" },
  { key: "revenue_latest",         label: "Revenue (Latest Year)",       value_type: "currency", description: "Most recent full-year revenue" },
  { key: "sde_latest",             label: "SDE (Latest Year)",           value_type: "currency", description: "Seller's Discretionary Earnings, most recent year" },
  { key: "ebitda_latest",          label: "EBITDA (Latest Year)",        value_type: "currency", description: "EBITDA, most recent year" },
  { key: "revenue_year_1",         label: "Revenue (Prior Year)",        value_type: "currency", description: "Revenue one year before latest" },
  { key: "revenue_year_2",         label: "Revenue (2 Years Prior)",     value_type: "currency", description: "Revenue two years before latest" },
  { key: "sde_year_1",             label: "SDE (Prior Year)",            value_type: "currency", description: "SDE one year before latest" },
  { key: "gross_profit",           label: "Gross Profit",                value_type: "currency", description: "Revenue minus COGS" },
  { key: "net_income",             label: "Net Income",                  value_type: "currency", description: "Bottom-line profit" },
  { key: "addbacks_summary",       label: "Addbacks Summary",            value_type: "text",     description: "Summary of owner addbacks" },
  { key: "financial_quality_notes",label: "Financial Quality Notes",     value_type: "text",     description: "Notes on financial statement quality" },

  // Deal Terms
  { key: "deal_structure",         label: "Deal Structure",              value_type: "text",     description: "Asset sale, share sale, earnout, etc." },
  { key: "seller_financing",       label: "Seller Financing",            value_type: "currency", description: "Amount seller will finance" },
  { key: "down_payment",           label: "Down Payment",                value_type: "currency", description: "Cash required at close" },
  { key: "inventory_included",     label: "Inventory Included",          value_type: "boolean",  description: "Whether inventory is included" },
  { key: "real_estate_included",   label: "Real Estate Included",        value_type: "boolean",  description: "Whether real estate is included" },
  { key: "lease_monthly_rent",     label: "Monthly Rent",                value_type: "currency", description: "Monthly lease payment" },
  { key: "lease_expiration_date",  label: "Lease Expiration",            value_type: "date",     description: "When the lease expires" },
  { key: "working_capital_intensity", label: "Working Capital Intensity",value_type: "text",     description: "Low / medium / high" },
  { key: "capex_intensity",        label: "CapEx Intensity",             value_type: "text",     description: "Low / medium / high" },

  // Operations
  { key: "years_in_business",      label: "Years in Business",           value_type: "number",   description: "How long the business has operated" },
  { key: "employees_ft",           label: "Full-Time Employees",         value_type: "number",   description: "Number of full-time employees" },
  { key: "employees_pt",           label: "Part-Time Employees",         value_type: "number",   description: "Number of part-time employees" },
  { key: "owner_hours_per_week",   label: "Owner Hours / Week",          value_type: "number",   description: "Hours per week owner works in the business" },
  { key: "owner_in_sales",         label: "Owner Drives Sales",          value_type: "boolean",  description: "Whether owner is the primary salesperson" },
  { key: "owner_in_operations",    label: "Owner in Operations",         value_type: "boolean",  description: "Whether owner is required for operations" },
  { key: "manager_in_place",       label: "Manager in Place",            value_type: "boolean",  description: "Whether a non-owner manager exists" },
  { key: "customer_concentration_top1_pct", label: "Top Customer %",    value_type: "percent",  description: "Revenue % from top single customer" },
  { key: "customer_concentration_top5_pct", label: "Top 5 Customers %", value_type: "percent",  description: "Revenue % from top 5 customers" },
  { key: "vendor_concentration_top1_pct",   label: "Top Vendor %",      value_type: "percent",  description: "Spend % from top single vendor" },
  { key: "recurring_revenue_pct",  label: "Recurring Revenue %",         value_type: "percent",  description: "% of revenue that is recurring" },
  { key: "repeat_revenue_pct",     label: "Repeat Revenue %",            value_type: "percent",  description: "% of revenue from repeat customers" },
  { key: "seasonality",            label: "Seasonality",                 value_type: "text",     description: "Low / medium / high seasonality" },
  { key: "seller_reason",          label: "Reason for Sale",             value_type: "text",     description: "Why the owner is selling" },
  { key: "transition_support",     label: "Transition Support",          value_type: "text",     description: "Training / handover offered" },

  // Risk
  { key: "legal_risk_flag",        label: "Legal Risk",                  value_type: "boolean",  description: "Any known legal issues" },
  { key: "compliance_risk_flag",   label: "Compliance Risk",             value_type: "boolean",  description: "Any compliance concerns" },
  { key: "licensing_dependency",   label: "Licensing Dependency",        value_type: "boolean",  description: "Business depends on specific licenses" },
];

export const FACT_REGISTRY_MAP = new Map<string, FactRegistryEntry>(
  FACT_REGISTRY.map((f) => [f.key, f])
);

// ─── Value parsers ────────────────────────────────────────────────────────────

export function parseFactValue(raw: string | null, valueType: FactValueType): number | boolean | string | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;

  switch (valueType) {
    case "currency":
    case "number": {
      // Strip currency symbols, commas, M/K suffixes
      const clean = raw.replace(/[$,]/g, "").trim();
      if (clean.endsWith("M") || clean.endsWith("m")) return parseFloat(clean) * 1_000_000;
      if (clean.endsWith("K") || clean.endsWith("k")) return parseFloat(clean) * 1_000;
      const n = parseFloat(clean);
      return isNaN(n) ? null : n;
    }
    case "percent": {
      const clean = raw.replace(/%/g, "").trim();
      const n = parseFloat(clean);
      if (isNaN(n)) return null;
      // Normalize: if value > 1, assume it's already a percentage (e.g. 25 → 0.25)
      return n > 1 ? n / 100 : n;
    }
    case "boolean": {
      const lower = raw.toLowerCase().trim();
      if (lower === "true" || lower === "yes" || lower === "1") return true;
      if (lower === "false" || lower === "no" || lower === "0") return false;
      return null;
    }
    default:
      return raw;
  }
}

/**
 * Extract typed fact values from a list of entity_fact_values.
 * Returns a map of fact_key → parsed value (number | boolean | string | null).
 * Only includes facts that are not in "missing" status.
 */
export function extractFactInputs(
  factValues: EntityFactValue[],
  factDefIdToKey: Map<string, string>
): Record<string, number | boolean | string | null> {
  const result: Record<string, number | boolean | string | null> = {};

  for (const fv of factValues) {
    if (fv.status === "missing") continue;

    const key = factDefIdToKey.get(fv.fact_definition_id);
    if (!key) continue;

    const registryEntry = FACT_REGISTRY_MAP.get(key);
    if (!registryEntry) continue;

    const parsed = parseFactValue(fv.value_raw, registryEntry.value_type);
    if (parsed !== null) {
      result[key] = parsed;
    }
  }

  return result;
}
