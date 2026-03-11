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
  price_multiple:       { range: "2.5x–4.0x",  preferred: "< 3.5x",  notes: "Typical SBA-financed acquisition range" },
  earnings_margin:      { range: "15%–30%",     preferred: "> 20%",   notes: "SDE as % of revenue" },
  revenue_per_employee: { range: "$80k–$200k",  preferred: "> $120k", notes: "Annual revenue per FTE equivalent" },
  rent_ratio:           { range: "5%–15%",      preferred: "< 10%",   notes: "Annual rent as % of revenue" },
  owner_dependence:     { range: "Low–Medium",  preferred: "Low",     notes: "Lower is better for transition" },
  revenue_quality:      { range: "Moderate–High", preferred: "High",  notes: "Recurring revenue + diversification" },
};

// ─── Industry-specific overrides ─────────────────────────────────────────────

const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmarks> = {

  childcare: {
    price_multiple:       { range: "2.0x–3.5x",  preferred: "< 3.0x",  notes: "Childcare centers typically trade at 2–3.5x SDE" },
    earnings_margin:      { range: "10%–25%",     preferred: "> 15%",   notes: "Margins vary with enrollment and staffing ratios" },
    revenue_per_employee: { range: "$40k–$80k",   preferred: "> $55k",  notes: "Labor-intensive; lower RPE is normal" },
    rent_ratio:           { range: "8%–18%",      preferred: "< 12%",   notes: "Dedicated facility; rent is a major cost" },
    owner_dependence:     { range: "Low–Medium",  preferred: "Low",     notes: "Director/manager in place is key" },
    revenue_quality:      { range: "High",        preferred: "High",    notes: "Enrollment-based recurring revenue is strong" },
  },

  "home services": {
    price_multiple:       { range: "2.0x–3.5x",  preferred: "< 3.0x",  notes: "Route-based businesses trade at lower multiples" },
    earnings_margin:      { range: "15%–35%",     preferred: "> 20%",   notes: "Good margins possible with low overhead" },
    revenue_per_employee: { range: "$80k–$180k",  preferred: "> $100k", notes: "Depends on service type and crew size" },
    rent_ratio:           { range: "1%–8%",       preferred: "< 5%",    notes: "Often home-based or low-overhead facility" },
    owner_dependence:     { range: "Medium–High", preferred: "Medium",  notes: "Owner often drives sales and relationships" },
    revenue_quality:      { range: "Low–Moderate",preferred: "Moderate",notes: "Recurring contracts improve quality significantly" },
  },

  retail: {
    price_multiple:       { range: "1.5x–3.0x",  preferred: "< 2.5x",  notes: "Retail trades at lower multiples due to risk" },
    earnings_margin:      { range: "5%–20%",      preferred: "> 12%",   notes: "Margins depend heavily on product category" },
    revenue_per_employee: { range: "$100k–$300k", preferred: "> $150k", notes: "Higher RPE indicates lean operations" },
    rent_ratio:           { range: "5%–15%",      preferred: "< 10%",   notes: "Retail rent is a critical cost driver" },
    owner_dependence:     { range: "Medium",      preferred: "Medium",  notes: "Owner typically manages operations" },
    revenue_quality:      { range: "Low–Moderate",preferred: "Moderate",notes: "Repeat customers improve quality" },
  },

  "b2b services": {
    price_multiple:       { range: "3.0x–5.0x",  preferred: "< 4.0x",  notes: "B2B recurring services command higher multiples" },
    earnings_margin:      { range: "20%–40%",     preferred: "> 25%",   notes: "Service businesses can have strong margins" },
    revenue_per_employee: { range: "$100k–$250k", preferred: "> $150k", notes: "Professional services tend to be efficient" },
    rent_ratio:           { range: "2%–8%",       preferred: "< 5%",    notes: "Often office-based with modest rent" },
    owner_dependence:     { range: "Medium–High", preferred: "Medium",  notes: "Client relationships often tied to owner" },
    revenue_quality:      { range: "Moderate–High", preferred: "High",  notes: "Contracts and retainers are strong signals" },
  },

  healthcare: {
    price_multiple:       { range: "3.0x–5.0x",  preferred: "< 4.0x",  notes: "Healthcare practices command premium multiples" },
    earnings_margin:      { range: "15%–35%",     preferred: "> 20%",   notes: "Margins vary by specialty and payer mix" },
    revenue_per_employee: { range: "$80k–$200k",  preferred: "> $120k", notes: "Depends on clinical vs. admin mix" },
    rent_ratio:           { range: "5%–12%",      preferred: "< 8%",    notes: "Medical office space can be expensive" },
    owner_dependence:     { range: "High",        preferred: "Medium",  notes: "Practitioner-owned practices are highly dependent" },
    revenue_quality:      { range: "Moderate–High", preferred: "High",  notes: "Insurance contracts provide recurring revenue" },
  },

  restaurant: {
    price_multiple:       { range: "1.5x–3.0x",  preferred: "< 2.5x",  notes: "Restaurants trade at low multiples due to risk" },
    earnings_margin:      { range: "5%–18%",      preferred: "> 12%",   notes: "Thin margins are common in food service" },
    revenue_per_employee: { range: "$40k–$100k",  preferred: "> $60k",  notes: "Very labor-intensive business model" },
    rent_ratio:           { range: "6%–15%",      preferred: "< 10%",   notes: "Location rent is critical in food service" },
    owner_dependence:     { range: "High",        preferred: "Medium",  notes: "Owner often central to operations and culture" },
    revenue_quality:      { range: "Low",         preferred: "Moderate",notes: "Transactional; loyalty programs help" },
  },

  manufacturing: {
    price_multiple:       { range: "3.0x–5.0x",  preferred: "< 4.0x",  notes: "Manufacturing commands higher multiples for stability" },
    earnings_margin:      { range: "10%–25%",     preferred: "> 15%",   notes: "Margins depend on product and automation level" },
    revenue_per_employee: { range: "$100k–$300k", preferred: "> $150k", notes: "Automation drives higher RPE" },
    rent_ratio:           { range: "3%–10%",      preferred: "< 7%",    notes: "Owned facilities reduce this significantly" },
    owner_dependence:     { range: "Low–Medium",  preferred: "Low",     notes: "Established processes reduce owner dependency" },
    revenue_quality:      { range: "Moderate–High", preferred: "High",  notes: "Long-term contracts are very positive" },
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
