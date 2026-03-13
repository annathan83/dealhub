"use client";

/**
 * AnalysisViewSpec — Analysis tab per cursor-prompt-facts-analysis spec
 *
 * 1. Deal Score: large score, "Based on {n} of 6 metrics", metric breakdown table
 *    (Metric | Value | Typical Range | Score). No progress bars, equal weight.
 * 2. Buyer Fit: Strong/Partial/Weak/No Fit badge, criteria list (✓/✗ + context),
 *    or empty state "Set up your Buyer Profile" when no profile.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { KpiScorecardResult, KpiScore } from "@/lib/kpi/kpiConfig";
import type { EntityPageData } from "@/types/entity";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";
import { computeBuyerFit } from "@/lib/kpi/buyerFit";
import { computeDerivedMetrics } from "@/lib/kpi/derivedMetricsService";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  kpiScorecard: KpiScorecardResult | null;
  entityData: EntityPageData | null;
  buyerProfile: BuyerProfile | null;
};

// ─── Typical ranges (spec) ─────────────────────────────────────────────────────

const TYPICAL_RANGES: Record<string, string> = {
  "Purchase Multiple": "2.5x–4.0x",
  "SDE Margin": "15%–30%",
  "SDE / Employee": "$50K–$100K",
  "Rent Ratio": "5%–15%",
  "Business Age": "5–20 years",
  "Owner Dependence": "Varies",
};

/** Map scorecard KPI key to our metric label for table */
const KPI_KEY_TO_LABEL: Record<string, string> = {
  price_multiple: "Purchase Multiple",
  earnings_margin: "SDE Margin",
  revenue_per_employee: "Revenue / Employee",
  sde_per_employee: "SDE / Employee",
  rent_ratio: "Rent Ratio",
  owner_dependence: "Owner Dependence",
  business_age: "Business Age",
};

// ─── Deal Score section ───────────────────────────────────────────────────────

function DealScoreSection({ scorecard, entityData }: { scorecard: KpiScorecardResult | null; entityData: EntityPageData | null }) {
  const score = scorecard?.overall_score ?? null;
  const kpis = scorecard?.kpis ?? [];
  const scoredCount = kpis.filter((k) => k.status !== "missing" && k.score != null).length;
  const scoreLabel = score === null ? null : score >= 8 ? "Strong" : score >= 6 ? "Partial" : "Weak";
  const scoreBg = score === null ? "bg-slate-100" : score >= 8 ? "bg-[#16a34a]" : score >= 6 ? "bg-[#d97706]" : "bg-[#dc2626]";
  const scoreText = score === null ? "text-slate-500" : score >= 8 ? "text-[#16a34a]" : score >= 6 ? "text-[#d97706]" : "text-[#dc2626]";

  const derived = useMemo(
    () => (entityData ? computeDerivedMetrics(entityData.fact_values, entityData.fact_definitions) : null),
    [entityData]
  );

  const tableRows = useMemo(() => {
    const metricOrder = [
      "Purchase Multiple",
      "SDE Margin",
      "SDE / Employee",
      "Rent Ratio",
      "Business Age",
      "Owner Dependence",
    ];
    const kpiByLabel = new Map<string, KpiScore>();
    for (const k of kpis) {
      const label = KPI_KEY_TO_LABEL[k.kpi_key] ?? k.label;
      kpiByLabel.set(label, k);
    }
    return metricOrder.map((label) => {
      const kpi = kpiByLabel.get(label);
      const range = TYPICAL_RANGES[label] ?? "—";
      let value = "—";
      let scoreVal: number | null = null;
      let needsNote: string | null = null;
      if (kpi) {
        value = kpi.raw_value ?? "—";
        scoreVal = kpi.score ?? null;
        if (kpi.status === "missing" && kpi.rationale) needsNote = kpi.rationale;
      }
      if (derived && value === "—") {
        if (label === "Purchase Multiple") value = derived.purchase_multiple.formatted;
        else if (label === "SDE Margin") value = derived.sde_margin.formatted;
        else if (label === "SDE / Employee") value = derived.sde_per_employee.formatted;
        else if (label === "Rent Ratio") value = derived.rent_ratio.formatted;
        else if (label === "Business Age") value = derived.business_age.formatted;
        else if (label === "Owner Dependence") value = derived.owner_dependence.formatted;
      }
      const scoreColor =
        scoreVal === null ? "text-slate-400" : scoreVal >= 8 ? "text-[#16a34a]" : scoreVal >= 6 ? "text-[#d97706]" : "text-[#dc2626]";
      return { label, value, range, scoreVal, scoreColor, needsNote };
    });
  }, [kpis, derived]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-4 border-b border-slate-100">
        <p className="text-[9px] uppercase text-[#94a3b8] tracking-[0.06em] mb-1">Deal Score</p>
        <div className="flex items-baseline gap-2">
          <span
            className={`inline-flex items-center justify-center min-w-[56px] px-2 py-1 rounded-lg text-2xl font-bold font-mono text-white ${scoreBg}`}
          >
            {score !== null ? score.toFixed(1) : "—"}
          </span>
          {scoreLabel && <span className={`text-sm font-semibold uppercase ${scoreText}`}>{scoreLabel}</span>}
        </div>
        <p className="text-[9px] text-slate-400 mt-1">Based on {scoredCount} of 6 metrics</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2 text-[9px] font-semibold uppercase text-[#94a3b8] tracking-wider">Metric</th>
              <th className="px-4 py-2 text-[9px] font-semibold uppercase text-[#94a3b8] tracking-wider">Value</th>
              <th className="px-4 py-2 text-[9px] font-semibold uppercase text-[#94a3b8] tracking-wider">Typical Range</th>
              <th className="px-4 py-2 text-[9px] font-semibold uppercase text-[#94a3b8] tracking-wider text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.label} className="border-b border-slate-50">
                <td className="px-4 py-2 text-[11px] font-semibold text-slate-700">{row.label}</td>
                <td className="px-4 py-2 text-[11px] font-mono text-slate-800">{row.value}</td>
                <td className="px-4 py-2 text-[9px] text-slate-400 font-mono">{row.range}</td>
                <td className={`px-4 py-2 text-[11px] font-bold font-mono text-right ${row.scoreColor}`}>
                  {row.scoreVal !== null ? row.scoreVal.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tableRows.some((r) => r.needsNote) && (
        <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/50">
          {tableRows
            .filter((r) => r.needsNote)
            .map((r) => (
              <p key={r.label} className="text-[10px] text-slate-500 italic">
                {r.label}: {r.needsNote}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Buyer Fit section ────────────────────────────────────────────────────────

function BuyerFitSection({ buyerProfile, entityData }: { buyerProfile: BuyerProfile | null; entityData: EntityPageData | null }) {
  const fitResult = useMemo(() => {
    if (!buyerProfile || !entityData) return null;
    const factDefs = entityData.fact_definitions;
    const factVals = entityData.fact_values;
    const getVal = (key: string) => {
      const fd = factDefs.find((d) => d.key === key);
      if (!fd) return null;
      return factVals.find((v) => v.fact_definition_id === fd.id)?.value_raw ?? null;
    };
    const parseNum = (key: string) => {
      const raw = getVal(key);
      if (!raw) return null;
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
      return isNaN(n) ? null : n;
    };
    const ft = parseNum("employees_ft") ?? 0;
    const pt = parseNum("employees_pt") ?? 0;
    const deal: Parameters<typeof computeBuyerFit>[1] = {
      industry: getVal("industry") ?? null,
      location: getVal("location") ?? null,
      sde: parseNum("sde_latest") ?? parseNum("ebitda_latest") ?? null,
      asking_price: parseNum("asking_price") ?? null,
      total_employees: ft + pt * 0.5 || null,
      manager_in_place: getVal("manager_in_place")?.toLowerCase() === "true" || getVal("manager_in_place")?.toLowerCase() === "yes",
      owner_hours_per_week: parseNum("owner_hours_per_week") ?? null,
    };
    return computeBuyerFit(buyerProfile, deal);
  }, [buyerProfile, entityData]);

  const hasProfile = buyerProfile != null && (
    buyerProfile.target_sde_min != null ||
    buyerProfile.target_sde_max != null ||
    buyerProfile.target_purchase_price_min != null ||
    buyerProfile.target_purchase_price_max != null ||
    (buyerProfile.preferred_industries?.length ?? 0) > 0 ||
    (buyerProfile.preferred_locations?.length ?? 0) > 0 ||
    buyerProfile.max_employees != null ||
    buyerProfile.manager_required ||
    buyerProfile.owner_operator_ok
  );

  if (!hasProfile) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-600">Set up your Buyer Profile to see personalized fit analysis</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Buyer Fit compares this deal against your preferences — price range, industries, locations, and more.
        </p>
        <Link
          href="/settings"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#1F7A63] text-white text-sm font-semibold hover:bg-[#1a6854] transition-colors"
        >
          Set Up Profile
        </Link>
      </div>
    );
  }

  if (!fitResult) return null;

  const label = fitResult.verdict === "GOOD_FIT" ? "Strong Fit" : fitResult.verdict === "FIT" ? "Strong Fit" : fitResult.verdict === "PARTIAL_FIT" ? "Partial Fit" : "Weak Fit";
  const badgeColor = fitResult.verdict === "GOOD_FIT" || fitResult.verdict === "FIT" ? "bg-[#16a34a] text-white" : fitResult.verdict === "PARTIAL_FIT" ? "bg-[#d97706] text-white" : "bg-[#dc2626] text-white";

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase ${badgeColor}`}>
          {label}
        </span>
        <p className="text-[9px] text-slate-400 mt-1">Based on your Buyer Profile</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {fitResult.criteria.map((c, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`shrink-0 mt-0.5 ${c.matched ? "text-[#16a34a]" : "text-[#dc2626]"}`} aria-hidden>
              {c.matched ? "✓" : "✗"}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-700">{c.name}</p>
              <p className="text-[10px] text-slate-500">{c.context}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalysisViewSpec({ kpiScorecard, entityData, buyerProfile }: Props) {
  return (
    <div className="max-w-[480px] mx-auto font-sans flex flex-col gap-4 py-4">
      <DealScoreSection scorecard={kpiScorecard} entityData={entityData} />
      <BuyerFitSection buyerProfile={buyerProfile} entityData={entityData} />
    </div>
  );
}
