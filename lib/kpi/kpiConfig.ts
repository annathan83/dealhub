/**
 * KPI Configuration Registry
 *
 * Single source of truth for all KPI definitions, weights, and scoring logic.
 * To add a new KPI: add an entry here. Nothing else needs to change.
 *
 * Scoring scale: 0–10
 *   10 = excellent
 *   8  = good
 *   6  = average / acceptable
 *   4  = below average / concern
 *   2  = poor / red flag
 *   0  = critical failure
 *
 * Weights must sum to 1.0 across all KPIs.
 *
 * Future: industry-specific overlays can replace or extend this config
 * by merging a vertical-specific config object on top of KPI_DEFINITIONS.
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

export const KPI_DEFINITIONS: KpiDefinition[] = [

  // ── 1. Asking Price ──────────────────────────────────────────────────────────
  // Informational only — neutral score since price alone can't be judged without multiple
  {
    kpi_key: "asking_price",
    label: "Asking Price",
    description: "Seller's stated asking price",
    weight: 0.05,
    score: ({ asking_price }) => {
      if (!asking_price) return missing("Asking price");
      return {
        score: 6, // neutral — evaluate alongside multiple and SDE
        raw_value: formatCurrency(asking_price),
        rationale: `Asking price is ${formatCurrency(asking_price)}. Evaluate alongside multiple and SDE.`,
        status: "known",
      };
    },
  },

  // ── 2. Revenue ───────────────────────────────────────────────────────────────
  {
    kpi_key: "revenue",
    label: "Annual Revenue",
    description: "Latest full-year revenue",
    weight: 0.08,
    score: ({ revenue_latest }) => {
      if (!revenue_latest) return missing("Revenue");
      let score: number;
      let rationale: string;
      if (revenue_latest >= 2_000_000) {
        score = 10; rationale = `Strong revenue of ${formatCurrency(revenue_latest)}.`;
      } else if (revenue_latest >= 1_000_000) {
        score = 8;  rationale = `Solid revenue of ${formatCurrency(revenue_latest)}.`;
      } else if (revenue_latest >= 500_000) {
        score = 6;  rationale = `Moderate revenue of ${formatCurrency(revenue_latest)}.`;
      } else if (revenue_latest >= 200_000) {
        score = 4;  rationale = `Low revenue of ${formatCurrency(revenue_latest)} — limited scale.`;
      } else {
        score = 2;  rationale = `Very low revenue of ${formatCurrency(revenue_latest)}.`;
      }
      return { score, raw_value: formatCurrency(revenue_latest), rationale, status: "known" };
    },
  },

  // ── 3. SDE or EBITDA ─────────────────────────────────────────────────────────
  {
    kpi_key: "sde_or_ebitda",
    label: "SDE / EBITDA",
    description: "Owner earnings or EBITDA — the core profitability measure",
    weight: 0.12,
    score: ({ sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      const label = sde_latest ? "SDE" : "EBITDA";
      if (!earnings) return missing("SDE or EBITDA");
      let score: number;
      let rationale: string;
      if (earnings >= 500_000) {
        score = 10; rationale = `Strong ${label} of ${formatCurrency(earnings)}.`;
      } else if (earnings >= 250_000) {
        score = 8;  rationale = `Good ${label} of ${formatCurrency(earnings)}.`;
      } else if (earnings >= 100_000) {
        score = 6;  rationale = `Acceptable ${label} of ${formatCurrency(earnings)}.`;
      } else if (earnings >= 50_000) {
        score = 4;  rationale = `Low ${label} of ${formatCurrency(earnings)} — thin cushion.`;
      } else {
        score = 2;  rationale = `Very low ${label} of ${formatCurrency(earnings)}.`;
      }
      const status: KpiStatus = sde_latest ? "known" : "estimated";
      return { score, raw_value: formatCurrency(earnings), rationale, status };
    },
  },

  // ── 4. Price Multiple ────────────────────────────────────────────────────────
  {
    kpi_key: "price_multiple",
    label: "Price Multiple",
    description: "Asking price ÷ SDE (or EBITDA) — key valuation metric",
    weight: 0.12,
    score: ({ asking_price, sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      if (!asking_price || !earnings || earnings <= 0) return missing("Price multiple");
      const multiple = asking_price / earnings;
      let score: number;
      let rationale: string;
      if (multiple <= 2.0) {
        score = 10; rationale = `Excellent multiple of ${multiple.toFixed(2)}x — strong value.`;
      } else if (multiple <= 3.0) {
        score = 8;  rationale = `Good multiple of ${multiple.toFixed(2)}x — fair value.`;
      } else if (multiple <= 4.0) {
        score = 6;  rationale = `Average multiple of ${multiple.toFixed(2)}x — market rate.`;
      } else if (multiple <= 5.5) {
        score = 4;  rationale = `High multiple of ${multiple.toFixed(2)}x — premium pricing.`;
      } else {
        score = 2;  rationale = `Very high multiple of ${multiple.toFixed(2)}x — difficult to justify.`;
      }
      return { score, raw_value: `${multiple.toFixed(2)}x`, rationale, status: "known" };
    },
  },

  // ── 5. Earnings Margin ───────────────────────────────────────────────────────
  {
    kpi_key: "earnings_margin",
    label: "Earnings Margin",
    description: "SDE or EBITDA as a % of revenue",
    weight: 0.10,
    score: ({ revenue_latest, sde_latest, ebitda_latest }) => {
      const earnings = sde_latest ?? ebitda_latest;
      if (!revenue_latest || !earnings || revenue_latest <= 0) return missing("Earnings margin");
      const margin = earnings / revenue_latest;
      let score: number;
      let rationale: string;
      if (margin >= 0.30) {
        score = 10; rationale = `Excellent margin of ${formatPct(margin)} — highly profitable.`;
      } else if (margin >= 0.20) {
        score = 8;  rationale = `Good margin of ${formatPct(margin)}.`;
      } else if (margin >= 0.12) {
        score = 6;  rationale = `Average margin of ${formatPct(margin)}.`;
      } else if (margin >= 0.06) {
        score = 4;  rationale = `Thin margin of ${formatPct(margin)} — limited buffer.`;
      } else {
        score = 2;  rationale = `Very thin margin of ${formatPct(margin)} — high risk.`;
      }
      return { score, raw_value: formatPct(margin), rationale, status: "known" };
    },
  },

  // ── 6. Revenue Trend ─────────────────────────────────────────────────────────
  {
    kpi_key: "revenue_trend",
    label: "Revenue Trend",
    description: "Year-over-year revenue growth or decline",
    weight: 0.08,
    score: ({ revenue_latest, revenue_year_1, revenue_year_2 }) => {
      if (!revenue_latest || !revenue_year_1) return missing("Revenue trend");
      const yoy = (revenue_latest - revenue_year_1) / revenue_year_1;
      let score: number;
      let rationale: string;
      if (yoy >= 0.15) {
        score = 10; rationale = `Strong growth of ${formatPct(yoy)} YoY.`;
      } else if (yoy >= 0.05) {
        score = 8;  rationale = `Steady growth of ${formatPct(yoy)} YoY.`;
      } else if (yoy >= -0.02) {
        score = 6;  rationale = `Flat revenue (${formatPct(yoy)} YoY).`;
      } else if (yoy >= -0.10) {
        score = 4;  rationale = `Revenue declining ${formatPct(Math.abs(yoy))} YoY — investigate.`;
      } else {
        score = 2;  rationale = `Significant revenue decline of ${formatPct(Math.abs(yoy))} YoY.`;
      }
      const status: KpiStatus = revenue_year_2 ? "known" : "estimated";
      return { score, raw_value: `${yoy >= 0 ? "+" : ""}${formatPct(yoy)} YoY`, rationale, status };
    },
  },

  // ── 7. Earnings Trend ────────────────────────────────────────────────────────
  {
    kpi_key: "earnings_trend",
    label: "Earnings Trend",
    description: "Year-over-year SDE growth or decline",
    weight: 0.08,
    score: ({ sde_latest, sde_year_1 }) => {
      if (!sde_latest || !sde_year_1) return missing("Earnings trend");
      const yoy = (sde_latest - sde_year_1) / Math.abs(sde_year_1);
      let score: number;
      let rationale: string;
      if (yoy >= 0.15) {
        score = 10; rationale = `Strong earnings growth of ${formatPct(yoy)} YoY.`;
      } else if (yoy >= 0.05) {
        score = 8;  rationale = `Steady earnings growth of ${formatPct(yoy)} YoY.`;
      } else if (yoy >= -0.02) {
        score = 6;  rationale = `Flat earnings (${formatPct(yoy)} YoY).`;
      } else if (yoy >= -0.15) {
        score = 4;  rationale = `Earnings declining ${formatPct(Math.abs(yoy))} YoY.`;
      } else {
        score = 2;  rationale = `Significant earnings decline of ${formatPct(Math.abs(yoy))} YoY.`;
      }
      return { score, raw_value: `${yoy >= 0 ? "+" : ""}${formatPct(yoy)} YoY`, rationale, status: "known" };
    },
  },

  // ── 8. Customer Concentration ────────────────────────────────────────────────
  {
    kpi_key: "customer_concentration",
    label: "Customer Concentration",
    description: "Revenue dependency on top customer(s)",
    weight: 0.08,
    score: ({ customer_concentration_top1_pct }) => {
      if (customer_concentration_top1_pct == null) return missing("Customer concentration");
      const pct = customer_concentration_top1_pct;
      let score: number;
      let rationale: string;
      if (pct <= 0.10) {
        score = 10; rationale = `Excellent diversification — top customer is only ${formatPct(pct)}.`;
      } else if (pct <= 0.20) {
        score = 8;  rationale = `Good diversification — top customer is ${formatPct(pct)}.`;
      } else if (pct <= 0.35) {
        score = 6;  rationale = `Moderate concentration — top customer is ${formatPct(pct)}.`;
      } else if (pct <= 0.50) {
        score = 4;  rationale = `High concentration — top customer is ${formatPct(pct)} of revenue.`;
      } else {
        score = 2;  rationale = `Critical concentration — top customer is ${formatPct(pct)} of revenue.`;
      }
      return { score, raw_value: formatPct(pct), rationale, status: "known" };
    },
  },

  // ── 9. Recurring Revenue Quality ─────────────────────────────────────────────
  {
    kpi_key: "recurring_revenue_quality",
    label: "Recurring Revenue",
    description: "Percentage of revenue that is recurring or contracted",
    weight: 0.08,
    score: ({ recurring_revenue_pct }) => {
      if (recurring_revenue_pct == null) return missing("Recurring revenue %");
      const pct = recurring_revenue_pct;
      let score: number;
      let rationale: string;
      if (pct >= 0.70) {
        score = 10; rationale = `Excellent — ${formatPct(pct)} recurring revenue.`;
      } else if (pct >= 0.50) {
        score = 8;  rationale = `Good — ${formatPct(pct)} recurring revenue.`;
      } else if (pct >= 0.30) {
        score = 6;  rationale = `Moderate — ${formatPct(pct)} recurring revenue.`;
      } else if (pct >= 0.10) {
        score = 4;  rationale = `Low — only ${formatPct(pct)} recurring revenue.`;
      } else {
        score = 2;  rationale = `Minimal recurring revenue (${formatPct(pct)}) — transactional model.`;
      }
      return { score, raw_value: formatPct(pct), rationale, status: "known" };
    },
  },

  // ── 10. Owner Dependence ─────────────────────────────────────────────────────
  {
    kpi_key: "owner_dependence",
    label: "Owner Dependence",
    description: "How much the business relies on the current owner",
    weight: 0.08,
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

      const rationale = notes.length > 0
        ? `Owner dependence indicators: ${notes.join(", ")}.`
        : "Owner dependence assessed from available data.";

      return { score, raw_value: riskPoints <= 1 ? "Low" : riskPoints <= 2 ? "Medium" : "High", rationale, status: "known" };
    },
  },

  // ── 11. Management Depth ─────────────────────────────────────────────────────
  {
    kpi_key: "management_depth",
    label: "Management Depth",
    description: "Quality of management team beyond the owner",
    weight: 0.07,
    score: ({ manager_in_place, employees_ft, employees_pt }) => {
      const totalEmployees = (employees_ft ?? 0) + (employees_pt ?? 0);
      const hasData = manager_in_place != null || employees_ft != null;
      if (!hasData) return missing("Management depth indicators");

      let score: number;
      let rationale: string;

      if (manager_in_place === true && totalEmployees >= 5) {
        score = 10; rationale = `Strong — manager in place with ${totalEmployees} employees.`;
      } else if (manager_in_place === true) {
        score = 8;  rationale = `Good — manager in place (${totalEmployees} employees).`;
      } else if (totalEmployees >= 10) {
        score = 6;  rationale = `${totalEmployees} employees but no confirmed manager in place.`;
      } else if (totalEmployees >= 3) {
        score = 4;  rationale = `Small team (${totalEmployees} employees), no manager confirmed.`;
      } else {
        score = 2;  rationale = `Minimal team (${totalEmployees} employees) — high key-person risk.`;
      }

      return { score, raw_value: manager_in_place === true ? "Manager in place" : `${totalEmployees} employees`, rationale, status: "known" };
    },
  },

  // ── 12. Risk Flags ───────────────────────────────────────────────────────────
  {
    kpi_key: "risk_flags",
    label: "Risk Flags",
    description: "Legal, compliance, or licensing risks",
    weight: 0.06,
    score: ({ legal_risk_flag, compliance_risk_flag, licensing_dependency }) => {
      const hasData = legal_risk_flag != null || compliance_risk_flag != null || licensing_dependency != null;
      if (!hasData) return missing("Risk flag data");

      const flags: string[] = [];
      if (legal_risk_flag === true)      flags.push("legal risk");
      if (compliance_risk_flag === true) flags.push("compliance risk");
      if (licensing_dependency === true) flags.push("licensing dependency");

      let score: number;
      let rationale: string;
      if (flags.length === 0) {
        score = 10; rationale = "No risk flags identified.";
      } else if (flags.length === 1) {
        score = 6;  rationale = `One risk flag: ${flags[0]}.`;
      } else {
        score = 2;  rationale = `Multiple risk flags: ${flags.join(", ")}.`;
      }

      return { score, raw_value: flags.length === 0 ? "None" : flags.join(", "), rationale, status: "known" };
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
