/**
 * Derived Metrics Service
 *
 * Calculates derived financial metrics from structured facts.
 * These are computed values — not stored as facts themselves — and are
 * surfaced in the Facts tab and used as inputs to the KPI scoring engine.
 *
 * Derived metrics (6 scored):
 *   - Purchase Multiple = Asking Price / SDE
 *   - SDE Margin        = SDE / Revenue
 *   - SDE / Employee    = SDE / Employees (FT)
 *   - Rent Ratio        = (Monthly Rent × 12) / Revenue
 *   - Business Age      = years_in_business (yr)
 *   - Owner Dependence  = from Owner Involvement
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

/** Owner dependence for scoring: Absentee = best, Full-time = worst */
export type OwnerDependenceLevel = "Absentee" | "Semi-absentee" | "Part-time" | "Full-time";

export type DerivedMetricsResult = {
  purchase_multiple: DerivedMetric;
  sde_margin: DerivedMetric;
  sde_per_employee: DerivedMetric;
  rent_ratio: DerivedMetric;
  business_age: DerivedMetric;
  owner_dependence: DerivedMetric & { valueLabel: OwnerDependenceLevel | null };
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
  const monthlyRent = vals["lease_monthly_rent"] as number | undefined;
  const yearsInBusiness = vals["years_in_business"] as number | undefined;
  const ownerHoursRaw = vals["owner_hours_per_week"];
  const ownerDependenceRaw = vals["owner_dependence_level"] as string | undefined;
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

  // ── SDE / Employee (SDE ÷ FT only per prompt) ─────────────────────────────
  const sdePerEmpVal = (sde && empFt > 0) ? sde / empFt : null;
  const sdePerEmployee: DerivedMetric = {
    key: "sde_per_employee",
    label: "SDE / Employee",
    value: sdePerEmpVal,
    formatted: sdePerEmpVal !== null ? fmtCurrency(sdePerEmpVal) : "—",
    description: "SDE ÷ Employees (FT)",
    available: !!(sde && empFt > 0),
    inputs: [sde === vals["sde_latest"] ? "sde_latest" : "ebitda_latest", "employees_ft"],
  };

  // ── Rent Ratio ────────────────────────────────────────────────────────────
  const annualRent = monthlyRent != null ? monthlyRent * 12 : null;
  const rentRatioVal = (annualRent != null && revenue != null && revenue > 0) ? annualRent / revenue : null;
  const rentRatio: DerivedMetric = {
    key: "rent_ratio",
    label: "Rent Ratio",
    value: rentRatioVal,
    formatted: rentRatioVal != null ? fmtPct(rentRatioVal) : "—",
    description: "(Monthly Rent × 12) ÷ Revenue",
    available: !!(annualRent != null && revenue != null && revenue > 0),
    inputs: ["lease_monthly_rent", "revenue_latest"],
  };

  // ── Business Age (Current Year − Year Established) ──────────────────────────
  const businessAgeVal = yearsInBusiness ?? null;
  const businessAge: DerivedMetric = {
    key: "business_age",
    label: "Business Age",
    value: businessAgeVal,
    formatted: businessAgeVal != null ? `${businessAgeVal} yr` : "—",
    description: "Current Year − Year Established",
    available: yearsInBusiness != null,
    inputs: ["years_in_business"],
  };

  // ── Owner Dependence (from owner involvement) ──────────────────────────────
  function mapToOwnerDependence(): OwnerDependenceLevel | null {
    if (ownerDependenceRaw != null && typeof ownerDependenceRaw === "string") {
      const lower = String(ownerDependenceRaw).toLowerCase();
      if (lower.includes("absentee") && !lower.includes("semi")) return "Absentee";
      if (lower.includes("semi") || lower.includes("semi-absentee")) return "Semi-absentee";
      if (lower.includes("part") || lower.includes("part-time")) return "Part-time";
      if (lower.includes("full") || lower.includes("operational")) return "Full-time";
      return "Full-time"; // default
    }
    const hours = ownerHoursRaw != null ? Number(ownerHoursRaw) : NaN;
    if (!Number.isFinite(hours)) return null;
    if (hours < 5) return "Absentee";
    if (hours < 20) return "Semi-absentee";
    if (hours < 40) return "Part-time";
    return "Full-time";
  }
  const ownerDepLabel = mapToOwnerDependence();
  const ownerDependence: DerivedMetric & { valueLabel: OwnerDependenceLevel | null } = {
    key: "owner_dependence",
    label: "Owner Dependence",
    value: ownerDepLabel !== null ? 1 : null, // placeholder for threshold; UI uses valueLabel
    formatted: ownerDepLabel ?? "—",
    description: "From Owner Involvement",
    available: ownerDepLabel !== null,
    inputs: ["owner_hours_per_week", "owner_dependence_level"],
    valueLabel: ownerDepLabel,
  };

  return {
    purchase_multiple: purchaseMultiple,
    sde_margin: sdeMargin,
    sde_per_employee: sdePerEmployee,
    rent_ratio: rentRatio,
    business_age: businessAge,
    owner_dependence: ownerDependence,
  };
}
