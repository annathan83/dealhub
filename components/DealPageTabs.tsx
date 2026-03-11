"use client";

/**
 * DealPageTabs
 *
 * 3-tab architecture for the deal detail page:
 *   Workspace — raw capture: quick-add, file explorer, activity timeline
 *   Facts     — structured extracted facts, editable with evidence
 *   Analysis  — AI scorecard + deep analysis narrative + score history
 */

import { useState } from "react";
import type { Deal, DealStatus } from "@/types";
import type {
  EntityPageData,
  EntityFile,
  EntityEvent,
  AnalysisSnapshot,
} from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import type { DeepAnalysisContent } from "@/lib/services/entity/deepAnalysisService";
import type { TimelineItem } from "@/lib/services/entity/entityTimelineService";
import type { ScoreHistoryEntry } from "@/lib/kpi/kpiScoringService";
// DeepAnalysisContent, ScoreHistoryEntry kept for prop types (passed through but not rendered in V1 triage view)

import QuickAddBar from "./QuickAddBar";
import IntakeSection from "./IntakeSection";
import TimelineSection from "./TimelineSection";
import FactsTab from "./entity/FactsTab";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { computeTriageRecommendation } from "@/lib/kpi/triageRecommendation";
import type { SwotAnalysisContent } from "@/lib/services/analysis/swotAnalysisService";
import type { MissingInfoResult } from "@/lib/services/analysis/missingInfoService";

// ─── Props ────────────────────────────────────────────────────────────────────

export type DealPageTabsProps = {
  deal: Deal;
  entityData: EntityPageData | null;
  // Workspace
  syncedFiles: EntityFile[];
  isDriveConnected: boolean;
  triageSummaryExists: boolean;
  newFilesAfterTriage: boolean;
  timelineItems: TimelineItem[];
  entityEvents: EntityEvent[];
  analysisSnapshots: AnalysisSnapshot[];
  // Analysis
  kpiScorecard: KpiScorecardResult | null;
  scoreHistory: ScoreHistoryEntry[];
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
  swotAnalysis: SwotAnalysisContent | null;
  missingInfo: MissingInfoResult | null;
};

// ─── Tab type ─────────────────────────────────────────────────────────────────

type TabId = "workspace" | "facts" | "analysis";

const TABS: { id: TabId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "facts",     label: "Facts" },
  { id: "analysis",  label: "Analysis" },
];

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  factsBadge,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  factsBadge?: number;
}) {
  return (
    <div className="flex border-b border-[#E5E7EB] bg-white sticky top-0 z-20">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? "text-[#1F7A63] border-b-2 border-[#1F7A63] -mb-px"
                : "text-[#6B7280] hover:text-[#1E1E1E]"
            }`}
          >
            {tab.label}
            {tab.id === "facts" && factsBadge != null && factsBadge > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold">
                {factsBadge > 9 ? "9+" : factsBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── V1 Triage: Analysis tab ─────────────────────────────────────────────────
//
// Clean triage-first layout:
//   A. Score header (score + confidence + facts used)
//   B. Recommendation (Request NDA / Borderline / Probably Pass + opinion)
//   C. KPI inputs used in scoring (derived metrics with weight)
//   D. Facts used (provenance summary)
//   E. Re-run button
//
// Secondary items (SWOT, deep analysis, score history, trend chart) are
// hidden in V1 to keep the interface fast and decision-oriented.
// The backend still generates them — they are just not surfaced here yet.

// ─── Score header ─────────────────────────────────────────────────────────────

function TriageScoreHeader({
  scorecard,
  dealId,
}: {
  scorecard: KpiScorecardResult | null;
  dealId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/analysis`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Analysis failed."); return; }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const score = scorecard?.overall_score ?? null;
  const conf = scorecard?.confidence ?? null;
  const factsUsed = conf?.total_facts_used ?? scorecard?.kpis.filter((k) => k.status !== "missing").length ?? null;

  const scoreColor = score === null ? "text-slate-300"
    : score >= 7 ? "text-emerald-600"
    : score >= 5 ? "text-amber-600"
    : "text-red-600";

  const confColor = conf === null ? "bg-slate-100"
    : conf.confidence_score >= 70 ? "bg-emerald-500"
    : conf.confidence_score >= 40 ? "bg-amber-400"
    : "bg-red-400";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Score row */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Deal Score</p>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-5xl font-extrabold tabular-nums leading-none ${scoreColor}`}>
              {score !== null ? score.toFixed(1) : "—"}
            </span>
            <span className="text-lg text-slate-300 font-medium">/10</span>
          </div>
          {score === null && (
            <p className="text-xs text-slate-400 mt-1.5">Upload a listing to generate a score</p>
          )}
        </div>

        <button
          onClick={runAnalysis}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F7A63] text-white text-xs font-medium rounded-lg hover:bg-[#1a6854] disabled:opacity-50 transition-colors shrink-0 mt-1"
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
      </div>

      {error && (
        <p className="px-5 pb-2 text-xs text-red-500">{error}</p>
      )}

      {/* Confidence + facts row */}
      {scorecard && (
        <div className="border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100">
          {/* Confidence */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confidence</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${confColor}`}
                  style={{ width: `${conf?.confidence_score ?? 0}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
                {conf?.confidence_score ?? "—"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">of scoring inputs</p>
          </div>

          {/* Facts used */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Facts Used</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{factsUsed ?? "—"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">scoring inputs</p>
          </div>

          {/* Coverage */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Coverage</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums">{scorecard.coverage_pct}%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">of KPIs scored</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function TriageRecommendationCard({ scorecard }: { scorecard: KpiScorecardResult | null }) {
  if (!scorecard || scorecard.overall_score === null) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Recommendation</p>
        <p className="text-sm text-slate-400">Add facts to generate a triage recommendation.</p>
      </div>
    );
  }

  const rec = computeTriageRecommendation(scorecard);

  // Icon per verdict
  const icon = rec.verdict === "REQUEST_NDA" ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : rec.verdict === "BORDERLINE" ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className={`rounded-xl border ${rec.borderColor} ${rec.bgColor} overflow-hidden`}>
      {/* Verdict header */}
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b ${rec.borderColor}`}>
        <span className={rec.color}>{icon}</span>
        <span className={`text-base font-bold ${rec.color}`}>{rec.label}</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-auto">
          Triage opinion
        </span>
      </div>

      {/* Opinion text */}
      <div className="px-5 py-4">
        <p className="text-sm text-slate-700 leading-relaxed">{rec.opinion}</p>

        {/* Flags */}
        {rec.flags.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {rec.flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  rec.verdict === "REQUEST_NDA" && i < 2 ? "bg-emerald-400" :
                  rec.verdict === "PROBABLY_PASS" ? "bg-red-400" : "bg-amber-400"
                }`} />
                {flag}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10px] text-slate-400 mt-3">
          This is a triage opinion based on available facts, not investment advice.
        </p>
      </div>
    </div>
  );
}

// ─── KPI inputs panel ─────────────────────────────────────────────────────────

function TriageKpiInputsPanel({ scorecard }: { scorecard: KpiScorecardResult | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!scorecard || scorecard.kpis.length === 0) return null;

  // Show only scored (non-missing) KPIs, sorted by weight descending
  const scored = scorecard.kpis
    .filter((k) => k.status !== "missing" && k.score !== null)
    .sort((a, b) => b.weight - a.weight);

  const missing = scorecard.kpis.filter((k) => k.status === "missing");

  const visible = expanded ? scored : scored.slice(0, 6);

  if (scored.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KPI Inputs</p>
        <span className="text-[10px] text-slate-400">{scored.length} scored · {missing.length} missing</span>
      </div>

      <div className="divide-y divide-slate-50">
        {visible.map((kpi) => {
          const scoreColor = kpi.score === null ? "text-slate-300"
            : kpi.score >= 8 ? "text-emerald-600"
            : kpi.score >= 5 ? "text-amber-600"
            : "text-red-500";
          const barColor = kpi.score === null ? "bg-slate-100"
            : kpi.score >= 8 ? "bg-emerald-400"
            : kpi.score >= 5 ? "bg-amber-400"
            : "bg-red-400";
          const pct = kpi.score !== null ? (kpi.score / 10) * 100 : 0;

          return (
            <div key={kpi.kpi_key} className="flex items-center gap-3 px-4 py-2.5">
              {/* Score dot */}
              <span className={`text-sm font-bold tabular-nums w-8 text-right shrink-0 ${scoreColor}`}>
                {kpi.score !== null ? kpi.score.toFixed(1) : "—"}
              </span>

              {/* Label + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 truncate">{kpi.label}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{Math.round(kpi.weight * 100)}%</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Value */}
              <span className="text-xs text-slate-500 tabular-nums w-20 text-right shrink-0">
                {kpi.raw_value ?? "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Missing KPIs summary */}
      {missing.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-50 bg-slate-50/60">
          <p className="text-[11px] text-slate-400">
            <span className="font-semibold text-amber-600">{missing.length} KPI{missing.length !== 1 ? "s" : ""} need data:</span>{" "}
            {missing.map((k) => k.label).join(", ")}
          </p>
        </div>
      )}

      {scored.length > 6 && (
        <div className="px-4 py-2 border-t border-slate-50">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-slate-400 hover:text-[#1F7A63] transition-colors"
          >
            {expanded ? "Show less" : `Show all ${scored.length} KPIs`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Source provenance summary ────────────────────────────────────────────────

function TriageSourceSummary({ scorecard }: { scorecard: KpiScorecardResult | null }) {
  const conf = scorecard?.confidence ?? null;
  if (!conf || conf.total_facts_used === 0) return null;

  const items = [
    { label: "Document-backed", count: conf.document_backed_count, dot: "bg-emerald-500", show: conf.document_backed_count > 0 },
    { label: "User override", count: conf.override_count, dot: "bg-blue-400", show: conf.override_count > 0 },
    { label: "AI estimate", count: conf.inferred_count, dot: "bg-amber-400", show: conf.inferred_count > 0 },
    { label: "Manual entry", count: conf.manual_count - conf.inferred_count, dot: "bg-slate-300", show: (conf.manual_count - conf.inferred_count) > 0 },
  ].filter((i) => i.show);

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Facts Used</p>
        <span className="text-[10px] text-slate-400">
          Confidence reflects document-backed inputs
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
            <span className="text-xs text-slate-600">{item.count} {item.label.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analysis tab (V1 triage) ─────────────────────────────────────────────────

function AnalysisTabContent({
  dealId,
  kpiScorecard,
}: {
  dealId: string;
  dealStatus: DealStatus;
  kpiScorecard: KpiScorecardResult | null;
  scoreHistory: ScoreHistoryEntry[];
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
  entityData: EntityPageData | null;
  swotAnalysis: SwotAnalysisContent | null;
  missingInfo: MissingInfoResult | null;
}) {
  return (
    <div className="flex flex-col gap-4 py-4">

      {/* A. Score header */}
      <TriageScoreHeader scorecard={kpiScorecard} dealId={dealId} />

      {/* B. Recommendation */}
      <TriageRecommendationCard scorecard={kpiScorecard} />

      {/* C. KPI inputs */}
      <TriageKpiInputsPanel scorecard={kpiScorecard} />

      {/* D. Source provenance */}
      <TriageSourceSummary scorecard={kpiScorecard} />

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealPageTabs({
  deal,
  entityData,
  syncedFiles,
  isDriveConnected,
  triageSummaryExists,
  newFilesAfterTriage,
  timelineItems,
  analysisSnapshots,
  kpiScorecard,
  scoreHistory,
  deepAnalysis,
  deepAnalysisStale,
  deepAnalysisRunAt,
  latestSourceAt,
  swotAnalysis,
  missingInfo,
}: DealPageTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("workspace");

  // Badge: count of missing core scoring facts (asking_price, sde_latest, revenue_latest, employees_ft, years_in_business)
  const CORE_SCORING_KEYS = ["asking_price", "sde_latest", "revenue_latest", "employees_ft", "years_in_business"];
  const factsBadge = entityData
    ? (() => {
        const valueMap = new Map(entityData.fact_values.map((v) => [v.fact_definition_id, v]));
        return entityData.fact_definitions
          .filter((fd) => CORE_SCORING_KEYS.includes(fd.key))
          .filter((fd) => {
            const v = valueMap.get(fd.id);
            return !v || v.status === "missing" || v.status === "unclear";
          }).length;
      })()
    : 0;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">

      {/* ── Quick-add actions — always visible above the tab bar ────────── */}
      <div className="px-4 pt-4 pb-3">
        <QuickAddBar dealId={deal.id} />
      </div>

      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        factsBadge={factsBadge}
      />

      {/* ── WORKSPACE TAB ───────────────────────────────────────────────── */}
      {activeTab === "workspace" && (
        <div className="px-4 py-4 flex flex-col gap-5">

          {/* Activity timeline — shown first */}
          <TimelineSection
            items={timelineItems}
            dealName={deal.name}
            dealCreatedAt={deal.created_at}
            files={syncedFiles}
            dealId={deal.id}
          />

          {/* File workspace — below activity */}
          <IntakeSection
            dealId={deal.id}
            dealName={deal.name}
            driveFolderId={deal.google_drive_folder_id ?? null}
            isDriveConnected={isDriveConnected}
            files={syncedFiles}
            triageSummaryExists={triageSummaryExists}
            newFilesAfterTriage={newFilesAfterTriage}
          />

        </div>
      )}

      {/* ── FACTS TAB ───────────────────────────────────────────────────── */}
      {activeTab === "facts" && (
        <div className="px-0 py-0">
          {entityData ? (
            <FactsTab
              factDefinitions={entityData.fact_definitions}
              factValues={entityData.fact_values}
              factEvidence={entityData.fact_evidence}
              files={entityData.files}
              dealId={deal.id}
            />
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">No facts extracted yet.</p>
              <p className="text-xs text-slate-300 mt-1">Upload documents or paste text to extract structured facts.</p>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYSIS TAB ────────────────────────────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="px-4">
          <AnalysisTabContent
            dealId={deal.id}
            dealStatus={deal.status}
            kpiScorecard={kpiScorecard}
            scoreHistory={scoreHistory}
            deepAnalysis={deepAnalysis}
            deepAnalysisStale={deepAnalysisStale}
            deepAnalysisRunAt={deepAnalysisRunAt}
            latestSourceAt={latestSourceAt}
            entityData={entityData}
            swotAnalysis={swotAnalysis}
            missingInfo={missingInfo}
          />
        </div>
      )}

    </div>
  );
}
