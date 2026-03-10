"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KpiScorecardResult, KpiScore } from "@/lib/kpi/kpiConfig";

type Props = {
  scorecard: KpiScorecardResult | null;
  dealId: string;
};

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, max = 10 }: { score: number | null; max?: number }) {
  if (score === null) {
    return <div className="w-full h-1.5 bg-slate-100 rounded-full" />;
  }
  const pct = (score / max) * 100;
  const color = score >= 8 ? "bg-emerald-500"
    : score >= 5 ? "bg-amber-400"
    : "bg-red-400";
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Score dot ────────────────────────────────────────────────────────────────

function ScoreDot({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300 text-sm font-mono">—</span>;
  const color = score >= 8 ? "text-emerald-600"
    : score >= 5 ? "text-amber-600"
    : "text-red-600";
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{score}/10</span>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KpiScore["status"] }) {
  if (status === "known") return null;
  const cfg = status === "estimated"
    ? "bg-blue-50 text-blue-600 border-blue-200"
    : "bg-slate-50 text-slate-400 border-slate-200";
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${cfg}`}>
      {status}
    </span>
  );
}

// ─── Overall score ring ───────────────────────────────────────────────────────

function OverallScoreRing({ score100, coverage }: { score100: number | null; coverage: number }) {
  const score = score100 ?? 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Strong" : score >= 50 ? "Average" : score > 0 ? "Weak" : "—";

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-24 h-24 shrink-0">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          {score100 !== null && (
            <circle
              cx="44" cy="44" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800 leading-none">
            {score100 !== null ? score100 : "—"}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">/ 100</span>
        </div>
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{label}</div>
        <div className="text-sm text-slate-500 mt-0.5">Overall deal score</div>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${coverage}%` }} />
          </div>
          <span className="text-xs text-slate-400">{coverage}% data coverage</span>
        </div>
      </div>
    </div>
  );
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function KpiRow({ kpi }: { kpi: KpiScore }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        {/* Score */}
        <div className="w-10 shrink-0 text-right">
          <ScoreDot score={kpi.score} />
        </div>

        {/* Label + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-700">{kpi.label}</span>
            <StatusBadge status={kpi.status} />
          </div>
          <ScoreBar score={kpi.score} />
        </div>

        {/* Value */}
        <div className="w-24 text-right shrink-0">
          <span className={`text-xs tabular-nums ${kpi.raw_value ? "text-slate-600" : "text-slate-300"}`}>
            {kpi.raw_value ?? "—"}
          </span>
        </div>

        {/* Weight */}
        <div className="w-12 text-right shrink-0 hidden sm:block">
          <span className="text-[10px] text-slate-400">{Math.round(kpi.weight * 100)}%</span>
        </div>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-0">
          <div className={`
            text-xs rounded-lg px-3 py-2 leading-relaxed
            ${kpi.status === "missing" ? "bg-slate-50 text-slate-400" : "bg-slate-50 text-slate-600"}
          `}>
            {kpi.rationale}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KpiScorecardTab({ scorecard, dealId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function runAnalysis() {
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/analysis`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Analysis failed.");
        return;
      }
      setLastRun(new Date().toLocaleTimeString());
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    }
  }

  if (!scorecard || scorecard.kpis.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-medium">No KPI scorecard yet</p>
        <p className="text-slate-400 text-xs mt-1 mb-4">
          Upload documents or paste text, then run analysis to generate scores.
        </p>
        <button
          onClick={runAnalysis}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Analysis
            </>
          )}
        </button>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  const knownCount = scorecard.kpis.filter((k) => k.status !== "missing").length;
  const missingCount = scorecard.missing_count;

  return (
    <div>
      {/* Overall score card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <OverallScoreRing
            score100={scorecard.overall_score_100}
            coverage={scorecard.coverage_pct}
          />
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={runAnalysis}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-run
                </>
              )}
            </button>
            {lastRun && <span className="text-[10px] text-slate-400">Last run: {lastRun}</span>}
            {error && <span className="text-[10px] text-red-500">{error}</span>}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-slate-800">{knownCount}</div>
            <div className="text-[11px] text-slate-400">KPIs scored</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-600">{missingCount}</div>
            <div className="text-[11px] text-slate-400">Missing data</div>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-800">{scorecard.coverage_pct}%</div>
            <div className="text-[11px] text-slate-400">Coverage</div>
          </div>
        </div>
      </div>

      {/* Missing data notice */}
      {missingCount > 0 && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs text-amber-700">
            <span className="font-semibold">{missingCount} KPI{missingCount !== 1 ? "s" : ""} missing data.</span>{" "}
            Upload financial statements, a broker listing, or paste deal details to improve coverage.
            The overall score is calculated from available data only.
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <div className="w-10 text-right shrink-0">Score</div>
        <div className="flex-1">KPI</div>
        <div className="w-24 text-right shrink-0">Value</div>
        <div className="w-12 text-right shrink-0 hidden sm:block">Weight</div>
        <div className="w-4 shrink-0" />
      </div>

      {/* KPI rows */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {scorecard.kpis.map((kpi) => (
          <KpiRow key={kpi.kpi_key} kpi={kpi} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-400 text-center">
        Click any row to see the scoring rationale. Weights shown as % of total score.
      </p>
    </div>
  );
}
