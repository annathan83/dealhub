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
// V1 Triage KPIs — 6 derived metrics (buyer-neutral deal quality):
//   1. Purchase Multiple      (30%) — core valuation check
//   2. SDE Margin             (20%) — profitability quality
//   3. Revenue per Employee   (15%) — labor efficiency
//   4. Rent Ratio             (10%) — fixed-cost exposure
//   5. Owner Dependence       (15%) — transition risk
//   6. Revenue Quality        (10%) — recurring / concentration
//
// Total: 1.00
//
// Business size / stability intentionally excluded:
//   Size preference is buyer-specific → handled in Buyer Fit, not Deal Score.
//   Stability (years in business) is useful context but not a core triage KPI.

export const KPI_DEFINITIONS: KpiDefinition[] = [

  // ── 1. Purchase Multiple ─────────────────────────────────────────────────────
  // Core triage check: is the asking price reasonable relative to earnings?
  {
    kpi_key: "price_multiple",
    label: "Purchase Multiple",
    description: "Asking price ÷ SDE (or EBITDA) — key valuation metric",
    weight: 0.30,
    score: ({ asking_price, sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      if (!asking_price || !earnings || earnings <= 0) return missing("Purchase multiple");
      const multiple = asking_price / earnings;
      let score: number;
      let rationale: string;
      if (multiple <= 2.0) {
        score = 10; rationale = `Excellent multiple of ${multiple.toFixed(2)}x — strong value relative to earnings.`;
      } else if (multiple <= 3.0) {
        score = 8;  rationale = `Good multiple of ${multiple.toFixed(2)}x — fair market value.`;
      } else if (multiple <= 4.0) {
        score = 6;  rationale = `Average multiple of ${multiple.toFixed(2)}x — at market rate.`;
      } else if (multiple <= 5.5) {
        score = 4;  rationale = `High multiple of ${multiple.toFixed(2)}x — premium pricing, validate earnings quality.`;
      } else {
        score = 2;  rationale = `Very high multiple of ${multiple.toFixed(2)}x — difficult to justify returns.`;
      }
      return { score, raw_value: `${multiple.toFixed(2)}x`, rationale, status: "known" };
    },
  },

  // ── 2. SDE Margin ────────────────────────────────────────────────────────────
  // Profitability quality: what % of revenue flows to the owner?
  {
    kpi_key: "earnings_margin",
    label: "SDE Margin",
    description: "SDE or EBITDA as a % of revenue — profitability quality",
    weight: 0.20,
    score: ({ revenue_latest, sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      if (!revenue_latest || !earnings || revenue_latest <= 0) return missing("SDE margin");
      const margin = earnings / revenue_latest;
      let score: number;
      let rationale: string;
      if (margin >= 0.30) {
        score = 10; rationale = `Excellent SDE margin of ${formatPct(margin)} — highly profitable.`;
      } else if (margin >= 0.20) {
        score = 8;  rationale = `Good SDE margin of ${formatPct(margin)}.`;
      } else if (margin >= 0.12) {
        score = 6;  rationale = `Average SDE margin of ${formatPct(margin)}.`;
      } else if (margin >= 0.06) {
        score = 4;  rationale = `Thin SDE margin of ${formatPct(margin)} — limited buffer for debt service.`;
      } else {
        score = 2;  rationale = `Very thin SDE margin of ${formatPct(margin)} — high risk.`;
      }
      return { score, raw_value: formatPct(margin), rationale, status: "known" };
    },
  },

  // ── 3. Revenue per Employee ──────────────────────────────────────────────────
  // Labor efficiency: how much revenue does each employee generate?
  {
    kpi_key: "revenue_per_employee",
    label: "Revenue / Employee",
    description: "Annual revenue per full-time employee — labor efficiency",
    weight: 0.15,
    score: ({ revenue_latest, employees_ft, employees_pt }) => {
      if (!revenue_latest) return missing("Revenue per employee");
      const totalEmployees = (employees_ft ?? 0) + Math.round((employees_pt ?? 0) * 0.5);
      if (totalEmployees <= 0) return missing("Employee count");
      const rpe = revenue_latest / totalEmployees;
      let score: number;
      let rationale: string;
      if (rpe >= 300_000) {
        score = 10; rationale = `Excellent revenue per employee of ${formatCurrency(rpe)} — highly efficient.`;
      } else if (rpe >= 200_000) {
        score = 8;  rationale = `Good revenue per employee of ${formatCurrency(rpe)}.`;
      } else if (rpe >= 120_000) {
        score = 6;  rationale = `Average revenue per employee of ${formatCurrency(rpe)}.`;
      } else if (rpe >= 70_000) {
        score = 4;  rationale = `Below-average revenue per employee of ${formatCurrency(rpe)} — labor-intensive.`;
      } else {
        score = 2;  rationale = `Low revenue per employee of ${formatCurrency(rpe)} — high labor cost relative to revenue.`;
      }
      return { score, raw_value: formatCurrency(rpe), rationale, status: "known" };
    },
  },

  // ── 4. Rent Ratio ────────────────────────────────────────────────────────────
  // Fixed-cost exposure: what % of revenue goes to rent?
  {
    kpi_key: "rent_ratio",
    label: "Rent Ratio",
    description: "Annual rent as a % of revenue — fixed-cost exposure",
    weight: 0.10,
    score: ({ lease_monthly_rent, revenue_latest }) => {
      if (!lease_monthly_rent || !revenue_latest || revenue_latest <= 0) return missing("Rent ratio");
      const annualRent = lease_monthly_rent * 12;
      const ratio = annualRent / revenue_latest;
      let score: number;
      let rationale: string;
      if (ratio <= 0.05) {
        score = 10; rationale = `Excellent rent ratio of ${formatPct(ratio)} — very low fixed-cost exposure.`;
      } else if (ratio <= 0.10) {
        score = 8;  rationale = `Good rent ratio of ${formatPct(ratio)}.`;
      } else if (ratio <= 0.15) {
        score = 6;  rationale = `Average rent ratio of ${formatPct(ratio)}.`;
      } else if (ratio <= 0.25) {
        score = 4;  rationale = `High rent ratio of ${formatPct(ratio)} — significant fixed-cost exposure.`;
      } else {
        score = 2;  rationale = `Very high rent ratio of ${formatPct(ratio)} — rent is a major risk factor.`;
      }
      return { score, raw_value: formatPct(ratio), rationale, status: "known" };
    },
  },

  // ── 5. Owner Dependence ──────────────────────────────────────────────────────
  // Transition risk: how much does the business depend on the current owner?
  {
    kpi_key: "owner_dependence",
    label: "Owner Dependence",
    description: "How much the business relies on the current owner",
    weight: 0.15,
    score: ({ owner_hours_per_week, owner_in_sales, owner_in_operations, manager_in_place }) => {
      const hasData = owner_hours_per_week != null || owner_in_sales != null || manager_in_place != null;
      if (!hasData) return missing("Owner dependence indicators");

      let riskPoints = 0;
      const notes: string[] = [];

      if (owner_hours_per_week != null) {
        if (owner_hours_per_week >= 50) { riskPoints += 2; notes.push(`owner works ${owner_hours_per_week}h/week`); }
        else if (owner_hours_per_week >= 30) { riskPoints += 1; notes.push(`owner works ${owner_hours_per_week}h/week`); }
        else { notes.push(`owner works ${owner_hours_per_week}h/week`); }
      }
      if (owner_in_sales === true)      { riskPoints += 1; notes.push("owner drives sales"); }
      if (owner_in_operations === true) { riskPoints += 1; notes.push("owner in operations"); }
      if (manager_in_place === true)    { riskPoints -= 1; notes.push("manager in place"); }

      let score: number;
      if (riskPoints <= 0) score = 10;
      else if (riskPoints === 1) score = 8;
      else if (riskPoints === 2) score = 6;
      else if (riskPoints === 3) score = 4;
      else score = 2;

      const rawLabel = riskPoints <= 0 ? "Low" : riskPoints <= 1 ? "Low-Med" : riskPoints <= 2 ? "Medium" : "High";
      const rationale = notes.length > 0
        ? `Owner dependence: ${notes.join(", ")}.`
        : "Owner dependence assessed from available data.";

      return { score, raw_value: rawLabel, rationale, status: "known" };
    },
  },

  // ── 6. Revenue Quality ───────────────────────────────────────────────────────
  // Recurring revenue % and customer concentration — revenue reliability
  {
    kpi_key: "revenue_quality",
    label: "Revenue Quality",
    description: "Recurring revenue % and customer concentration",
    weight: 0.10,
    score: ({ recurring_revenue_pct, customer_concentration_top1_pct }) => {
      const hasRecurring = recurring_revenue_pct != null;
      const hasConcentration = customer_concentration_top1_pct != null;

      if (!hasRecurring && !hasConcentration) return missing("Revenue quality indicators");

      let score = 6; // neutral baseline
      const notes: string[] = [];

      if (hasRecurring) {
        const pct = recurring_revenue_pct!;
        if (pct >= 0.70) { score = Math.min(10, score + 3); notes.push(`${formatPct(pct)} recurring`); }
        else if (pct >= 0.50) { score = Math.min(10, score + 2); notes.push(`${formatPct(pct)} recurring`); }
        else if (pct >= 0.30) { score = Math.min(10, score + 1); notes.push(`${formatPct(pct)} recurring`); }
        else if (pct < 0.10) { score = Math.max(2, score - 2); notes.push(`low recurring (${formatPct(pct)})`); }
        else { notes.push(`${formatPct(pct)} recurring`); }
      }

      if (hasConcentration) {
        const pct = customer_concentration_top1_pct!;
        if (pct > 0.50) { score = Math.max(2, score - 2); notes.push(`top customer ${formatPct(pct)} of revenue`); }
        else if (pct > 0.35) { score = Math.max(3, score - 1); notes.push(`top customer ${formatPct(pct)}`); }
        else if (pct <= 0.10) { score = Math.min(10, score + 1); notes.push(`well-diversified (top customer ${formatPct(pct)})`); }
        else { notes.push(`top customer ${formatPct(pct)}`); }
      }

      const status: KpiStatus = hasRecurring && hasConcentration ? "known" : "estimated";
      return {
        score: Math.max(0, Math.min(10, score)),
        raw_value: notes.join(" · "),
        rationale: `Revenue quality: ${notes.join(", ")}.`,
        status,
      };
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
