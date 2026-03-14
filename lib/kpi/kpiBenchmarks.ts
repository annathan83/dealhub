/**
 * KPI Benchmark Config
 *
 * Typical ranges for each V1 triage KPI, keyed by industry.
 * Used to show "Typical Range" in the Analysis KPI table.
 *
 * Structure:
 *   BENCHMARKS[industry_key][kpi_key] = { range, notes }
 *
 * Industry keys should match the `industry` fact value (lowercased).
 * "default" is the fallback for unknown industries.
 *
 * These are approximate market norms for small-business acquisition triage.
 * They are intentionally simple for V1 — not investment advice.
 */

export type KpiBenchmark = {
  range: string;          // display string, e.g. "2.5x–3.5x"
  preferred: string;      // what a buyer prefers, e.g. "< 3.0x"
  notes?: string;
};

export type IndustryBenchmarks = Partial<Record<string, KpiBenchmark>>;

// ─── Default benchmarks (general small business) ──────────────────────────────

const DEFAULT_BENCHMARKS: IndustryBenchmarks = {
  price_multiple:    { range: "2.5x–4.0x",  preferred: "≤ 3x",   notes: "Asking Price ÷ SDE" },
  earnings_margin:    { range: "15%–30%",    preferred: "≥ 25%",  notes: "SDE ÷ Revenue" },
  sde_per_employee:  { range: "$40k–$100k", preferred: "≥ $60k", notes: "SDE ÷ Employees (FT)" },
  rent_ratio:        { range: "5%–15%",     preferred: "≤ 5%",   notes: "Annual rent as % of revenue" },
  business_age:      { range: "5–20 yr",    preferred: "≥ 10 yr", notes: "Years in business" },
  owner_dependence:  { range: "Varies",     preferred: "Absentee", notes: "From owner involvement" },
};

// ─── Industry-specific overrides ─────────────────────────────────────────────

const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmarks> = {

  childcare: {
    price_multiple:    { range: "2.0x–3.5x",  preferred: "≤ 3x",   notes: "Childcare centers typically 2–3.5x SDE" },
    earnings_margin:   { range: "10%–25%",    preferred: "≥ 15%",  notes: "Margins vary with enrollment" },
    sde_per_employee:  { range: "$40k–$80k",  preferred: "≥ $55k",  notes: "Labor-intensive" },
    rent_ratio:        { range: "8%–18%",     preferred: "≤ 12%",  notes: "Dedicated facility" },
    business_age:      { range: "5–15 yr",    preferred: "≥ 10 yr", notes: "Stability matters" },
    owner_dependence:  { range: "Low–Medium", preferred: "Low",    notes: "Director in place is key" },
  },

  "home services": {
    price_multiple:    { range: "2.0x–3.5x",  preferred: "≤ 3x",   notes: "Route-based trade at lower multiples" },
    earnings_margin:   { range: "15%–35%",    preferred: "≥ 20%",  notes: "Good margins with low overhead" },
    sde_per_employee:  { range: "$80k–$180k",  preferred: "≥ $100k", notes: "Service type and crew size" },
    rent_ratio:        { range: "1%–8%",     preferred: "≤ 5%",   notes: "Often home-based" },
    business_age:      { range: "5–20 yr",    preferred: "≥ 10 yr", notes: "" },
    owner_dependence:  { range: "Medium–High", preferred: "Medium", notes: "Owner often drives sales" },
  },

  retail: {
    price_multiple:    { range: "1.5x–3.0x",  preferred: "≤ 2.5x", notes: "Retail trades lower due to risk" },
    earnings_margin:   { range: "5%–20%",     preferred: "≥ 12%",  notes: "Product category dependent" },
    sde_per_employee:  { range: "$100k–$300k", preferred: "≥ $150k", notes: "Lean operations" },
    rent_ratio:        { range: "5%–15%",     preferred: "≤ 10%",  notes: "Rent is critical" },
    business_age:      { range: "3–15 yr",     preferred: "≥ 5 yr",  notes: "" },
    owner_dependence:  { range: "Medium",     preferred: "Medium", notes: "Owner typically manages" },
  },

  "b2b services": {
    price_multiple:    { range: "3.0x–5.0x",  preferred: "≤ 4x",   notes: "B2B recurring command higher multiples" },
    earnings_margin:   { range: "20%–40%",    preferred: "≥ 25%",  notes: "Strong margins" },
    sde_per_employee:  { range: "$100k–$250k", preferred: "≥ $150k", notes: "Professional services" },
    rent_ratio:        { range: "2%–8%",      preferred: "≤ 5%",   notes: "Office-based" },
    business_age:      { range: "5–20 yr",    preferred: "≥ 10 yr", notes: "" },
    owner_dependence:  { range: "Medium–High", preferred: "Medium", notes: "Client relationships" },
  },

  healthcare: {
    price_multiple:    { range: "3.0x–5.0x",  preferred: "≤ 4x",   notes: "Practices command premium" },
    earnings_margin:   { range: "15%–35%",    preferred: "≥ 20%",  notes: "Specialty and payer mix" },
    sde_per_employee:  { range: "$80k–$200k", preferred: "≥ $120k", notes: "Clinical vs. admin mix" },
    rent_ratio:        { range: "5%–12%",     preferred: "≤ 8%",   notes: "Medical office space" },
    business_age:      { range: "5–25 yr",    preferred: "≥ 10 yr", notes: "" },
    owner_dependence:  { range: "High",       preferred: "Medium", notes: "Practitioner-owned" },
  },

  restaurant: {
    price_multiple:    { range: "1.5x–3.0x",  preferred: "≤ 2.5x", notes: "Low multiples due to risk" },
    earnings_margin:   { range: "5%–18%",     preferred: "≥ 12%",  notes: "Thin margins common" },
    sde_per_employee: { range: "$40k–$100k", preferred: "≥ $60k", notes: "Labor-intensive" },
    rent_ratio:        { range: "6%–15%",     preferred: "≤ 10%",  notes: "Location critical" },
    business_age:      { range: "3–10 yr",    preferred: "≥ 5 yr",  notes: "" },
    owner_dependence:  { range: "High",        preferred: "Medium", notes: "Owner central to ops" },
  },

  manufacturing: {
    price_multiple:    { range: "3.0x–5.0x",  preferred: "≤ 4x",   notes: "Stability commands higher multiples" },
    earnings_margin:   { range: "10%–25%",    preferred: "≥ 15%",  notes: "Product and automation" },
    sde_per_employee: { range: "$100k–$300k", preferred: "≥ $150k", notes: "Automation drives higher" },
    rent_ratio:        { range: "3%–10%",     preferred: "≤ 7%",   notes: "Owned facilities help" },
    business_age:      { range: "5–30 yr",    preferred: "≥ 10 yr", notes: "" },
    owner_dependence:  { range: "Low–Medium", preferred: "Low",    notes: "Processes reduce dependency" },
  },

};

// ─── Lookup function ──────────────────────────────────────────────────────────

/**
 * Get benchmark for a specific KPI and industry.
 * Falls back to DEFAULT_BENCHMARKS if industry not found or KPI not defined.
 */
export function getKpiBenchmark(
  kpiKey: string,
  industry: string | null | undefined
): KpiBenchmark | null {
  const industryKey = normalizeIndustry(industry);

  // Try industry-specific first
  if (industryKey) {
    const industryBenchmarks = INDUSTRY_BENCHMARKS[industryKey];
    if (industryBenchmarks?.[kpiKey]) {
      return industryBenchmarks[kpiKey]!;
    }
  }

  // Fall back to default
  return DEFAULT_BENCHMARKS[kpiKey] ?? null;
}

/**
 * Normalize an industry string to a benchmark key.
 * Handles common variations and aliases.
 */
export function normalizeIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null;
  const lower = industry.toLowerCase().trim();

  if (lower.includes("childcare") || lower.includes("child care") || lower.includes("daycare") || lower.includes("preschool")) return "childcare";
  if (lower.includes("home service") || lower.includes("cleaning") || lower.includes("landscaping") || lower.includes("plumbing") || lower.includes("hvac")) return "home services";
  if (lower.includes("retail") || lower.includes("store") || lower.includes("shop")) return "retail";
  if (lower.includes("b2b") || lower.includes("business service") || lower.includes("consulting") || lower.includes("staffing")) return "b2b services";
  if (lower.includes("health") || lower.includes("medical") || lower.includes("dental") || lower.includes("therapy") || lower.includes("clinic")) return "healthcare";
  if (lower.includes("restaurant") || lower.includes("food") || lower.includes("cafe") || lower.includes("bakery")) return "restaurant";
  if (lower.includes("manufactur") || lower.includes("fabricat") || lower.includes("production")) return "manufacturing";

  return null;
}
