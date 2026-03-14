/**
 * KPI Configuration Registry — V1 Triage
 *
 * Triage-first scoring: derived KPIs that answer "should I ask for the NDA?"
 *
 * Scoring scale: 0–10
 *   10 = excellent / strong buy signal
 *   8  = good
 *   6  = average / acceptable
 *   4  = below average / concern
 *   2  = poor / red flag
 *   0  = critical failure
 *
 * Weights must sum to 1.0.
 *
 * Design principle:
 *   Score derived metrics (multiple, margin, RPE) rather than raw values alone.
 *   This gives a buyer-oriented first-pass screen, not a data dump.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type KpiStatus = "known" | "estimated" | "missing";

export type KpiScore = {
  kpi_key: string;
  label: string;
  raw_value: string | null;
  score: number | null;          // 0–10, null if missing
  weight: number;
  weighted_score: number | null; // score * weight, null if missing
  rationale: string;
  status: KpiStatus;
};

export type KpiScorecardResult = {
  overall_score: number | null;     // weighted average of non-missing KPIs, 0–10 scale
  overall_score_100: number | null; // overall_score * 10, for progress bars (0–100)
  kpis: KpiScore[];
  missing_count: number;
  coverage_pct: number;
  // Scoring transparency (populated after persistence)
  confidence?: {
    confidence_score: number;       // 0–100: reliability of scoring inputs
    total_facts_used: number;
    document_backed_count: number;
    manual_count: number;
    inferred_count: number;
    override_count: number;
  } | null;
};

// Input facts fed into the scoring engine
export type KpiFactInputs = {
  asking_price?: number | null;
  revenue_latest?: number | null;
  sde_latest?: number | null;
  ebitda_latest?: number | null;
  revenue_year_1?: number | null;  // prior year
  revenue_year_2?: number | null;  // two years prior
  sde_year_1?: number | null;
  lease_monthly_rent?: number | null;
  years_in_business?: number | null;
  customer_concentration_top1_pct?: number | null;
  recurring_revenue_pct?: number | null;
  owner_hours_per_week?: number | null;
  manager_in_place?: boolean | null;
  owner_in_sales?: boolean | null;
  owner_in_operations?: boolean | null;
  employees_ft?: number | null;
  employees_pt?: number | null;
  legal_risk_flag?: boolean | null;
  compliance_risk_flag?: boolean | null;
  licensing_dependency?: boolean | null;
  capex_intensity?: string | null;  // 'low' | 'medium' | 'high'
  seasonality?: string | null;      // 'low' | 'medium' | 'high'
};

type ScoringFn = (inputs: KpiFactInputs) => { score: number | null; raw_value: string | null; rationale: string; status: KpiStatus };

export type KpiDefinition = {
  kpi_key: string;
  label: string;
  description: string;
  weight: number;
  score: ScoringFn;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function missing(label: string): ReturnType<ScoringFn> {
  return { score: null, raw_value: null, rationale: `${label} not available`, status: "missing" };
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── KPI Definitions ──────────────────────────────────────────────────────────
//
// V1 — 6 derived metrics, equal weight (simple average). No user-configurable weights.
//   1. Purchase Multiple  — Asking Price ÷ SDE
//   2. SDE Margin         — SDE ÷ Revenue
//   3. SDE / Employee     — SDE ÷ Employees (FT)
//   4. Rent Ratio         — (Monthly Rent × 12) ÷ Revenue
//   5. Business Age       — Current Year − Year Established (years_in_business)
//   6. Owner Dependence   — Mapped from Owner Involvement
//
// Thresholds: Green 9–10, Amber 6–7, Red 3–4. Missing metrics excluded from average.

const W = 1 / 6;

export const KPI_DEFINITIONS: KpiDefinition[] = [

  // ── 1. Purchase Multiple ─────────────────────────────────────────────────────
  // Green ≤3x, Amber 3–4x, Red >4x
  {
    kpi_key: "price_multiple",
    label: "Purchase Multiple",
    description: "Asking Price ÷ SDE",
    weight: W,
    score: ({ asking_price, sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      if (!asking_price || !earnings || earnings <= 0) return missing("Purchase multiple");
      const multiple = asking_price / earnings;
      let score: number;
      let rationale: string;
      if (multiple <= 3) {
        score = 9; rationale = `Multiple ${multiple.toFixed(2)}x — strong value.`;
      } else if (multiple <= 4) {
        score = 6; rationale = `Multiple ${multiple.toFixed(2)}x — at market.`;
      } else {
        score = 3; rationale = `Multiple ${multiple.toFixed(2)}x — premium pricing.`;
      }
      return { score, raw_value: `${multiple.toFixed(2)}x`, rationale, status: "known" };
    },
  },

  // ── 2. SDE Margin ────────────────────────────────────────────────────────────
  // Green ≥25%, Amber 15–25%, Red <15%
  {
    kpi_key: "earnings_margin",
    label: "SDE Margin",
    description: "SDE ÷ Revenue",
    weight: W,
    score: ({ revenue_latest, sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      if (!revenue_latest || !earnings || revenue_latest <= 0) return missing("SDE margin");
      const margin = earnings / revenue_latest;
      let score: number;
      let rationale: string;
      if (margin >= 0.25) {
        score = 9; rationale = `SDE margin ${formatPct(margin)} — strong.`;
      } else if (margin >= 0.15) {
        score = 6; rationale = `SDE margin ${formatPct(margin)}.`;
      } else {
        score = 3; rationale = `SDE margin ${formatPct(margin)} — thin.`;
      }
      return { score, raw_value: formatPct(margin), rationale, status: "known" };
    },
  },

  // ── 3. SDE / Employee ───────────────────────────────────────────────────────
  // Green ≥$60K, Amber $40–60K, Red <$40K. Formula: SDE ÷ Employees (FT)
  {
    kpi_key: "sde_per_employee",
    label: "SDE / Employee",
    description: "SDE ÷ Employees (FT)",
    weight: W,
    score: ({ sde_latest, ebitda_latest, employees_ft }) => {
      const sde = sde_latest ?? ebitda_latest;
      const ft = employees_ft ?? 0;
      if (!sde || ft <= 0) return missing("SDE / Employee");
      const perEmp = sde / ft;
      let score: number;
      let rationale: string;
      if (perEmp >= 60_000) {
        score = 9; rationale = `$${(perEmp / 1000).toFixed(0)}K per employee — efficient.`;
      } else if (perEmp >= 40_000) {
        score = 6; rationale = `$${(perEmp / 1000).toFixed(0)}K per employee.`;
      } else {
        score = 3; rationale = `$${(perEmp / 1000).toFixed(0)}K per employee — labor-heavy.`;
      }
      return { score, raw_value: formatCurrency(perEmp), rationale, status: "known" };
    },
  },

  // ── 4. Rent Ratio ────────────────────────────────────────────────────────────
  // Green ≤5%, Amber 5–15%, Red >15%
  {
    kpi_key: "rent_ratio",
    label: "Rent Ratio",
    description: "(Monthly Rent × 12) ÷ Revenue",
    weight: W,
    score: ({ lease_monthly_rent, revenue_latest }) => {
      if (!lease_monthly_rent || !revenue_latest || revenue_latest <= 0) return missing("Rent ratio");
      const annualRent = lease_monthly_rent * 12;
      const ratio = annualRent / revenue_latest;
      let score: number;
      let rationale: string;
      if (ratio <= 0.05) {
        score = 9; rationale = `Rent ratio ${formatPct(ratio)} — low exposure.`;
      } else if (ratio <= 0.15) {
        score = 6; rationale = `Rent ratio ${formatPct(ratio)}.`;
      } else {
        score = 3; rationale = `Rent ratio ${formatPct(ratio)} — high exposure.`;
      }
      return { score, raw_value: formatPct(ratio), rationale, status: "known" };
    },
  },

  // ── 5. Business Age ──────────────────────────────────────────────────────────
  // Green ≥10yr, Amber 5–10yr, Red <5yr. Input: years_in_business (or Year Established)
  {
    kpi_key: "business_age",
    label: "Business Age",
    description: "Current Year − Year Established",
    weight: W,
    score: ({ years_in_business }) => {
      const years = years_in_business;
      if (years == null || years < 0) return missing("Business age");
      let score: number;
      let rationale: string;
      if (years >= 10) {
        score = 9; rationale = `${years} yr — established.`;
      } else if (years >= 5) {
        score = 6; rationale = `${years} yr.`;
      } else {
        score = 3; rationale = `${years} yr — early stage.`;
      }
      return { score, raw_value: `${years} yr`, rationale, status: "known" };
    },
  },

  // ── 6. Owner Dependence ──────────────────────────────────────────────────────
  // Green = Absentee, Amber = Semi-absentee / Part-time, Red = Full-time
  // Mapped from owner_dependence_level (text) or owner_hours_per_week
  {
    kpi_key: "owner_dependence",
    label: "Owner Dependence",
    description: "Mapped from Owner Involvement",
    weight: W,
    score: ({ owner_hours_per_week, owner_in_sales, owner_in_operations, manager_in_place }) => {
      const hasData = owner_hours_per_week != null || owner_in_sales != null || manager_in_place != null;
      if (!hasData) return missing("Owner involvement");

      let riskPoints = 0;
      const notes: string[] = [];

      if (owner_hours_per_week != null) {
        if (owner_hours_per_week >= 50) { riskPoints += 2; notes.push("Full-time"); }
        else if (owner_hours_per_week >= 30) { riskPoints += 1; notes.push("Part-time"); }
        else if (owner_hours_per_week >= 20) { notes.push("Semi-absentee"); }
        else { notes.push("Absentee"); }
      }
      if (owner_in_sales === true)      { riskPoints += 1; }
      if (owner_in_operations === true) { riskPoints += 1; }
      if (manager_in_place === true)    { riskPoints -= 1; }

      let score: number;
      let rawLabel: string;
      if (riskPoints <= 0) { score = 9; rawLabel = "Absentee"; }
      else if (riskPoints === 1) { score = 6; rawLabel = "Semi-absentee / Part-time"; }
      else { score = 3; rawLabel = "Full-time"; }

      const rationale = notes.length > 0 ? `Owner involvement: ${notes.join(", ")}.` : "Owner dependence assessed.";
      return { score, raw_value: rawLabel, rationale, status: "known" };
    },
  },

];

// ─── Verify weights sum to 1.0 ────────────────────────────────────────────────
const totalWeight = KPI_DEFINITIONS.reduce((sum, k) => sum + k.weight, 0);
if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.warn(`[kpiConfig] KPI weights sum to ${totalWeight.toFixed(3)}, expected 1.000`);
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getKpiDefinition(key: string): KpiDefinition | undefined {
  return KPI_DEFINITIONS.find((k) => k.kpi_key === key);
}

export function getKpiKeys(): string[] {
  return KPI_DEFINITIONS.map((k) => k.kpi_key);
}
