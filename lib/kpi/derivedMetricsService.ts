/**
 * Derived Metrics Service
 *
 * Calculates derived financial metrics from structured facts.
 * These are computed values — not stored as facts themselves — and are
 * surfaced in the Facts tab and used as inputs to the KPI scoring engine.
 *
 * Derived metrics:
 *   - Purchase Multiple    = Asking Price / SDE (or EBITDA)
 *   - SDE Margin           = SDE / Revenue
 *   - Revenue per Employee = Revenue / Total Employees
 *   - SDE per Employee     = SDE / Total Employees
 *   - Years in Business    (already a fact, surfaced here for display)
 */

import { parseFactValue } from "./factRegistry";
import type { EntityFactValue, FactDefinition } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DerivedMetric = {
  key: string;
  label: string;
  value: number | null;
  formatted: string;
  description: string;
  /** Whether the inputs needed to compute this metric are available */
  available: boolean;
  /** Which fact keys were used */
  inputs: string[];
};

export type DerivedMetricsResult = {
  purchase_multiple: DerivedMetric;
  sde_margin: DerivedMetric;
  revenue_per_employee: DerivedMetric;
  sde_per_employee: DerivedMetric;
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtMultiple(n: number): string {
  return `${n.toFixed(2)}x`;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Compute all derived metrics from a set of entity fact values.
 * Pure function — no DB access.
 */
export function computeDerivedMetrics(
  factValues: EntityFactValue[],
  factDefs: FactDefinition[]
): DerivedMetricsResult {
  // Build key → parsed value map (skip missing facts)
  const defMap = new Map<string, FactDefinition>(factDefs.map((fd) => [fd.id, fd]));
  const vals: Record<string, number | boolean | string | null> = {};

  for (const fv of factValues) {
    if (fv.status === "missing") continue;
    const fd = defMap.get(fv.fact_definition_id);
    if (!fd) continue;
    const parsed = parseFactValue(fv.value_raw, fd.data_type as import("./factRegistry").FactValueType);
    if (parsed !== null) vals[fd.key] = parsed;
  }

  const askingPrice = vals["asking_price"] as number | undefined;
  const sde = (vals["sde_latest"] ?? vals["ebitda_latest"]) as number | undefined;
  const revenue = vals["revenue_latest"] as number | undefined;
  const empTotal = vals["employees_total"] as number | undefined;
  const empFt = (vals["employees_ft"] as number | undefined) ?? 0;
  const empPt = (vals["employees_pt"] as number | undefined) ?? 0;
  // Prefer employees_total if present; otherwise sum ft + pt (pt counts as 0.5 FTE)
  const totalEmp = empTotal ?? (empFt + empPt * 0.5);

  // ── Purchase Multiple ──────────────────────────────────────────────────────
  const multipleVal = (askingPrice && sde && sde > 0) ? askingPrice / sde : null;
  const purchaseMultiple: DerivedMetric = {
    key: "purchase_multiple",
    label: "Purchase Multiple",
    value: multipleVal,
    formatted: multipleVal !== null ? fmtMultiple(multipleVal) : "—",
    description: "Ask Price ÷ SDE",
    available: !!(askingPrice && sde && sde > 0),
    inputs: ["asking_price", sde === vals["sde_latest"] ? "sde_latest" : "ebitda_latest"],
  };

  // ── SDE Margin ────────────────────────────────────────────────────────────
  const sdeMarginVal = (sde && revenue && revenue > 0) ? sde / revenue : null;
  const sdeMargin: DerivedMetric = {
    key: "sde_margin",
    label: "SDE Margin",
    value: sdeMarginVal,
    formatted: sdeMarginVal !== null ? fmtPct(sdeMarginVal) : "—",
    description: "SDE ÷ Revenue",
    available: !!(sde && revenue && revenue > 0),
    inputs: [sde === vals["sde_latest"] ? "sde_latest" : "ebitda_latest", "revenue_latest"],
  };

  // ── Revenue per Employee ──────────────────────────────────────────────────
  const revPerEmpVal = (revenue && totalEmp > 0) ? revenue / totalEmp : null;
  const revenuePerEmployee: DerivedMetric = {
    key: "revenue_per_employee",
    label: "Revenue / Employee",
    value: revPerEmpVal,
    formatted: revPerEmpVal !== null ? fmtCurrency(revPerEmpVal) : "—",
    description: "Revenue ÷ Total Employees",
    available: !!(revenue && totalEmp > 0),
    inputs: ["revenue_latest", "employees_ft", "employees_pt"],
  };

  // ── SDE per Employee ──────────────────────────────────────────────────────
  const sdePerEmpVal = (sde && totalEmp > 0) ? sde / totalEmp : null;
  const sdePerEmployee: DerivedMetric = {
    key: "sde_per_employee",
    label: "SDE / Employee",
    value: sdePerEmpVal,
    formatted: sdePerEmpVal !== null ? fmtCurrency(sdePerEmpVal) : "—",
    description: "SDE ÷ Total Employees",
    available: !!(sde && totalEmp > 0),
    inputs: [sde === vals["sde_latest"] ? "sde_latest" : "ebitda_latest", "employees_ft", "employees_pt"],
  };

  return {
    purchase_multiple: purchaseMultiple,
    sde_margin: sdeMargin,
    revenue_per_employee: revenuePerEmployee,
    sde_per_employee: sdePerEmployee,
  };
}
