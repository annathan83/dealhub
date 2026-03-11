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
import { computeBuyerFit } from "@/lib/kpi/buyerFit";
import { getKpiBenchmark } from "@/lib/kpi/kpiBenchmarks";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";
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
  buyerProfile: BuyerProfile | null;
  // Optional: open a specific tab on first render (e.g. after deal creation)
  initialTab?: TabId;
};

// ─── Tab type ─────────────────────────────────────────────────────────────────

type TabId = "workspace" | "facts" | "analysis";

const TABS: { id: TabId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "analysis",  label: "Analysis" },
  { id: "facts",     label: "Facts" },
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
            data-testid={tab.id === "facts" ? "facts-tab-btn" : tab.id === "analysis" ? "analysis-tab-btn" : `tab-${tab.id}`}
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

// ─── New Facts Extracted Banner ───────────────────────────────────────────────
// Shown when AI has extracted facts from an uploaded document that haven't been
// reviewed yet. Prompts user to switch to the Facts tab to review them.

function NewFactsBanner({
  entityData,
  onReviewFacts,
}: {
  entityData: EntityPageData | null;
  onReviewFacts: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (!entityData || dismissed) return null;

  // Count unreviewed AI-extracted or AI-inferred facts
  const unreviewedAiFacts = entityData.fact_values.filter(
    (v) =>
      v.review_status === "unreviewed" &&
      (v.value_source_type === "ai_extracted" || v.value_source_type === "ai_inferred") &&
      v.value_raw !== null
  );

  if (unreviewedAiFacts.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            {unreviewedAiFacts.length} fact{unreviewedAiFacts.length !== 1 ? "s" : ""} extracted from your upload
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Review and confirm the values AI found in your document
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onReviewFacts}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Review Facts
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-emerald-400 hover:text-emerald-600 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Conflict Alert Banner ────────────────────────────────────────────────────
// Shown at the top of the Workspace tab when key scoring facts have conflicting
// values that need user resolution. Each conflict row shows the fact name,
// existing vs. new value, and Accept/Keep buttons.

function ConflictAlertBanner({
  entityData,
  dealId,
}: {
  entityData: EntityPageData | null;
  dealId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [resolving, setResolving] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState(false);

  if (!entityData || snoozed) return null;

  const valueMap = new Map(entityData.fact_values.map((v) => [v.fact_definition_id, v]));
  const evidenceMap = new Map<string, typeof entityData.fact_evidence[0][]>();
  for (const ev of entityData.fact_evidence) {
    const list = evidenceMap.get(ev.fact_definition_id) ?? [];
    list.push(ev);
    evidenceMap.set(ev.fact_definition_id, list);
  }

  // Find ALL conflicting facts (not just scoring keys)
  const conflicts = entityData.fact_definitions
    .map((fd) => {
      const val = valueMap.get(fd.id);
      if (!val || val.status !== "conflicting") return null;

      const allEvidence = evidenceMap.get(fd.id) ?? [];
      // Sort by confidence descending so primary is the best evidence row
      const sortedEvidence = [...allEvidence].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      const primary = sortedEvidence[0];
      const secondary = sortedEvidence[1];

      // For user_override conflicts: the "current" value is what the user manually entered
      // (stored in val.value_raw), and the "new" value is what AI extracted (in evidence row).
      // For evidence-vs-evidence conflicts: current = best existing evidence, new = secondary.
      const isUserOverrideConflict = val.value_source_type === "user_override";
      const existingDisplayValue = val.value_raw ?? primary?.extracted_value_raw ?? "—";
      const newDisplayValue = isUserOverrideConflict
        ? (primary?.extracted_value_raw ?? "—")
        : (secondary?.extracted_value_raw ?? "—");
      const snippet = isUserOverrideConflict
        ? (primary?.snippet ?? null)
        : (secondary?.snippet ?? primary?.snippet ?? null);

      return { fd, val, primary, secondary, existingDisplayValue, newDisplayValue, snippet, isUserOverrideConflict };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((x) => !dismissed.has(x.fd.id));

  if (conflicts.length === 0) return null;

  async function resolve(
    factDefId: string,
    keepValue: string,
    changeType: "confirm" | "override",
    oldValue: string
  ) {
    setResolving(factDefId);
    try {
      const res = await fetch(`/api/deals/${dealId}/facts/${factDefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_type: changeType,
          value_raw: keepValue,
          old_value: oldValue,
          note: `Conflict resolved — kept ${keepValue}`,
        }),
      });
      if (res.ok) {
        setDismissed((prev) => new Set([...prev, factDefId]));
        startTransition(() => router.refresh());
      }
    } finally {
      setResolving(null);
    }
  }

  // Show first 3 conflicts inline; if more exist, show a count
  const INLINE_LIMIT = 3;
  const visibleConflicts = conflicts.slice(0, INLINE_LIMIT);
  const hiddenCount = conflicts.length - visibleConflicts.length;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/60">
        <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm font-semibold text-amber-800">
          {conflicts.length} fact{conflicts.length !== 1 ? "s" : ""} need{conflicts.length === 1 ? "s" : ""} review
        </p>
        <div className="ml-auto flex items-center gap-2">
          <p className="text-xs text-amber-600 hidden sm:block">New evidence conflicts with existing values</p>
          <button
            type="button"
            onClick={() => setSnoozed(true)}
            className="text-[11px] text-amber-500 hover:text-amber-700 font-medium transition-colors"
            title="Dismiss for now — resolve later in the Facts tab"
          >
            Review later
          </button>
        </div>
      </div>

      <div className="divide-y divide-amber-100">
        {visibleConflicts.map(({ fd, existingDisplayValue, newDisplayValue, snippet, isUserOverrideConflict }) => {
          const existingVal = existingDisplayValue;
          const newVal = newDisplayValue;
          const isResolving = resolving === fd.id;

          return (
            <div key={fd.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">{fd.label}</p>
                  {isUserOverrideConflict && (
                    <p className="text-[10px] text-amber-600/70">Manual entry vs. document evidence</p>
                  )}
                  {snippet && (
                    <p className="text-[10px] text-amber-600/80 italic leading-relaxed line-clamp-1 mt-0.5">
                      &ldquo;{snippet.slice(0, 80)}{snippet.length > 80 ? "…" : ""}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Values side by side */}
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="bg-white rounded-lg border border-amber-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    {isUserOverrideConflict ? "Manual entry" : "Current"}
                  </p>
                  <p className="text-sm font-bold text-slate-800 tabular-nums truncate">{existingVal}</p>
                </div>
                <div className="bg-blue-50 rounded-lg border border-blue-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">
                    {isUserOverrideConflict ? "From document" : "New evidence"}
                  </p>
                  <p className="text-sm font-bold text-blue-800 tabular-nums truncate">{newVal}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isResolving || newVal === "—"}
                  onClick={() => resolve(fd.id, newVal, "override", existingVal)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-[#1F7A63] text-white rounded-lg hover:bg-[#1a6854] disabled:opacity-40 transition-colors"
                >
                  {isResolving ? "Saving…" : `Use ${newVal}`}
                </button>
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={() => resolve(fd.id, existingVal, "confirm", existingVal)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-white text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Keep {existingVal}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <div className="px-4 py-2.5 border-t border-amber-100 bg-amber-50/60">
          <p className="text-xs text-amber-600">
            +{hiddenCount} more conflict{hiddenCount !== 1 ? "s" : ""} — go to{" "}
            <span className="font-semibold">Facts tab</span> to resolve all.
          </p>
        </div>
      )}
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

  const confScore = conf?.confidence_score ?? null;
  const confLabel = confScore === null ? null
    : confScore >= 70 ? "High"
    : confScore >= 40 ? "Medium"
    : "Low";
  const confColor = confScore === null ? "bg-slate-100"
    : confScore >= 70 ? "bg-emerald-500"
    : confScore >= 40 ? "bg-amber-400"
    : "bg-red-400";
  const confTextColor = confScore === null ? "text-slate-400"
    : confScore >= 70 ? "text-emerald-700"
    : confScore >= 40 ? "text-amber-700"
    : "text-red-600";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Score row */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Deal Score</p>
          <div className="flex items-baseline gap-1.5">
            <span data-testid="overall-score" className={`text-5xl font-extrabold tabular-nums leading-none ${scoreColor}`}>
              {score !== null ? score.toFixed(1) : "—"}
            </span>
            <span className="text-lg text-slate-300 font-medium">/10</span>
          </div>
          {score === null && (
            <p className="text-xs text-slate-400 mt-1.5">Add facts or upload a listing to generate a score</p>
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
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${confColor}`}
                  style={{ width: `${confScore ?? 0}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
                {confScore ?? "—"}
              </span>
            </div>
            {confLabel && (
              <span className={`text-[10px] font-semibold ${confTextColor}`}>{confLabel}</span>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">input reliability</p>
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

// ─── Buyer Fit card ───────────────────────────────────────────────────────────

function BuyerFitCard({
  scorecard,
  buyerProfile,
  entityData,
}: {
  scorecard: KpiScorecardResult | null;
  buyerProfile: BuyerProfile | null;
  entityData: EntityPageData | null;
}) {
  if (!buyerProfile) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buyer Fit</p>
          <a href="/settings/buyer-profile" className="text-xs text-[#1F7A63] hover:underline font-medium">
            Set up profile →
          </a>
        </div>
        <p className="text-sm text-slate-400">
          Complete your{" "}
          <a href="/settings/buyer-profile" className="text-[#1F7A63] hover:underline font-medium">
            Buyer Profile
          </a>
          {" "}in Settings to see personalized fit analysis for this deal. You can fill it in manually or upload a document and AI will extract your criteria automatically.
        </p>
      </div>
    );
  }

  // Extract deal facts from entity data for buyer fit
  const factValues = entityData?.fact_values ?? [];
  const factDefs = entityData?.fact_definitions ?? [];
  const defMap = new Map(factDefs.map((d) => [d.key, d]));

  function getFactValue(key: string): string | null {
    const def = defMap.get(key);
    if (!def) return null;
    const val = factValues.find((v) => v.fact_definition_id === def.id);
    return val?.value_raw ?? null;
  }

  function parseNum(key: string): number | null {
    const raw = getFactValue(key);
    if (!raw) return null;
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  }

  function parseBool(key: string): boolean | null {
    const raw = getFactValue(key);
    if (!raw) return null;
    return raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
  }

  const sde = parseNum("sde_latest") ?? parseNum("ebitda_latest");
  const ft = parseNum("employees_ft") ?? 0;
  const pt = parseNum("employees_pt") ?? 0;
  const totalEmployees = ft + Math.round(pt * 0.5);

  const dealFacts = {
    industry: getFactValue("industry"),
    location: getFactValue("location") ?? getFactValue("location_county"),
    sde,
    asking_price: parseNum("asking_price"),
    total_employees: totalEmployees > 0 ? totalEmployees : null,
    manager_in_place: parseBool("manager_in_place"),
    owner_hours_per_week: parseNum("owner_hours_per_week"),
  };

  const fit = computeBuyerFit(buyerProfile, dealFacts);

  const fitIcon = (fit.verdict === "GOOD_FIT" || fit.verdict === "FIT") ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : fit.verdict === "NOT_A_GOOD_FIT" ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className={`rounded-xl border ${fit.borderColor} ${fit.bgColor} overflow-hidden`}>
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b ${fit.borderColor}`}>
        <span className={fit.color}>{fitIcon}</span>
        <span className={`text-base font-bold ${fit.color}`}>{fit.label}</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-auto">
          Buyer Fit
        </span>
      </div>
      <div className="px-5 py-4">
        <ul className="space-y-1.5">
          {fit.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                (fit.verdict === "GOOD_FIT" || fit.verdict === "FIT") ? "bg-emerald-400" :
                fit.verdict === "NOT_A_GOOD_FIT" ? "bg-red-400" : "bg-amber-400"
              }`} />
              {bullet}
            </li>
          ))}
        </ul>
        {/* Show source file if profile was imported from a document */}
        {buyerProfile.profile_source_file_name && (
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-current/10">
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[10px] text-slate-400 truncate">
              Profile from: {buyerProfile.profile_source_file_name}
              {buyerProfile.profile_source_uploaded_at && (
                <> · {new Date(buyerProfile.profile_source_uploaded_at).toLocaleDateString()}</>
              )}
            </p>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-2">
          Based on your{" "}
          <a href="/settings/buyer-profile" className="text-[#1F7A63] hover:underline">
            Buyer Profile
          </a>
          . Deal Score and Buyer Fit are separate evaluations.
        </p>
      </div>
    </div>
  );
}

// ─── KPI table with benchmark ranges ─────────────────────────────────────────

function KpiTable({
  scorecard,
  industry,
}: {
  scorecard: KpiScorecardResult | null;
  industry: string | null;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!scorecard || scorecard.kpis.length === 0) return null;

  // Sort: scored first (by weight desc), then missing
  const sorted = [...scorecard.kpis].sort((a, b) => {
    if (a.status === "missing" && b.status !== "missing") return 1;
    if (a.status !== "missing" && b.status === "missing") return -1;
    return b.weight - a.weight;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KPI Analysis</p>
        <span className="text-[10px] text-slate-400">
          {scorecard.kpis.filter((k) => k.status !== "missing").length} of {scorecard.kpis.length} scored
        </span>
      </div>

      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-4 py-2 border-b border-slate-50 bg-slate-50/60">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">KPI</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right w-20">Value</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right w-28">Typical Range</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right w-12">Score</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right w-12">Weight</span>
      </div>

      <div className="divide-y divide-slate-50">
        {sorted.map((kpi) => {
          const benchmark = getKpiBenchmark(kpi.kpi_key, industry);
          const scoreColor = kpi.score === null ? "text-slate-300"
            : kpi.score >= 8 ? "text-emerald-600"
            : kpi.score >= 5 ? "text-amber-600"
            : "text-red-500";
          const barColor = kpi.score === null ? "bg-slate-100"
            : kpi.score >= 8 ? "bg-emerald-400"
            : kpi.score >= 5 ? "bg-amber-400"
            : "bg-red-400";
          const pct = kpi.score !== null ? (kpi.score / 10) * 100 : 0;
          const isExpanded = expandedKey === kpi.kpi_key;

          return (
            <div key={kpi.kpi_key}>
              {/* Main row */}
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : kpi.kpi_key)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                {/* Mobile layout */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{kpi.label}</span>
                    <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
                      {kpi.score !== null ? kpi.score.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums w-16 text-right shrink-0">
                      {kpi.raw_value ?? "—"}
                    </span>
                    <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">
                      {Math.round(kpi.weight * 100)}%
                    </span>
                  </div>
                  {benchmark && (
                    <div className="text-[10px] text-slate-400 mt-1">Typical: {benchmark.range}</div>
                  )}
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{kpi.label}</div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5 max-w-[120px]">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 tabular-nums text-right w-20">
                    {kpi.raw_value ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400 text-right w-28">
                    {benchmark?.range ?? "—"}
                  </span>
                  <span className={`text-sm font-bold tabular-nums text-right w-12 ${scoreColor}`}>
                    {kpi.score !== null ? kpi.score.toFixed(1) : "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 text-right w-12">
                    {Math.round(kpi.weight * 100)}%
                  </span>
                </div>
              </button>

              {/* Expanded rationale */}
              {isExpanded && (
                <div className="px-4 pb-3 pt-0">
                  <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
                    {kpi.rationale}
                    {benchmark?.notes && (
                      <p className="text-slate-400 mt-1.5 italic">{benchmark.notes}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-50">
        Click any row for scoring rationale. Typical ranges are industry benchmarks for triage reference.
      </p>
    </div>
  );
}

// ─── Strengths & Risks panel ─────────────────────────────────────────────────

function StrengthsRisksPanel({ scorecard }: { scorecard: KpiScorecardResult | null }) {
  if (!scorecard || scorecard.kpis.length === 0) return null;

  const scored = scorecard.kpis.filter((k) => k.score !== null);
  if (scored.length === 0) return null;

  const strengths = scored
    .filter((k) => k.score !== null && k.score >= 7)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);

  const risks = scored
    .filter((k) => k.score !== null && k.score < 5)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3);

  if (strengths.length === 0 && risks.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {/* Strengths */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Strengths
          </p>
          {strengths.length > 0 ? (
            <ul className="space-y-2">
              {strengths.map((k) => (
                <li key={k.kpi_key} className="text-xs text-slate-700 leading-snug">
                  <span className="font-medium text-emerald-700">{k.label}</span>
                  <span className="text-slate-400 ml-1">({k.raw_value})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No strong KPIs yet</p>
          )}
        </div>

        {/* Risks */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Risks
          </p>
          {risks.length > 0 ? (
            <ul className="space-y-2">
              {risks.map((k) => (
                <li key={k.kpi_key} className="text-xs text-slate-700 leading-snug">
                  <span className="font-medium text-red-600">{k.label}</span>
                  <span className="text-slate-400 ml-1">({k.raw_value})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">No major risks flagged</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Missing key facts panel ──────────────────────────────────────────────────

function MissingKeyFactsPanel({ scorecard }: { scorecard: KpiScorecardResult | null }) {
  if (!scorecard) return null;

  const missing = scorecard.kpis.filter((k) => k.status === "missing");
  if (missing.length === 0) return null;

  // Map KPI keys to the facts needed
  const KPI_FACT_HINTS: Record<string, string> = {
    price_multiple:       "asking price and SDE",
    earnings_margin:      "revenue and SDE",
    revenue_per_employee: "revenue and employee count",
    rent_ratio:           "monthly rent and revenue",
    owner_dependence:     "owner hours, manager status",
    revenue_quality:      "recurring revenue % or customer concentration",
  };

  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
      <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-2">
        Missing Data · {missing.length} KPI{missing.length !== 1 ? "s" : ""} need facts
      </p>
      <ul className="space-y-1.5">
        {missing.map((k) => (
          <li key={k.kpi_key} className="flex items-start gap-2 text-xs text-amber-900">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              <span className="font-medium">{k.label}:</span>{" "}
              <span className="text-amber-700">add {KPI_FACT_HINTS[k.kpi_key] ?? "relevant facts"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Analysis tab (V1 triage) ─────────────────────────────────────────────────

function AnalysisTabContent({
  dealId,
  kpiScorecard,
  buyerProfile,
  entityData,
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
  buyerProfile: BuyerProfile | null;
}) {
  // Extract industry from facts for benchmark lookup
  const factDefs = entityData?.fact_definitions ?? [];
  const factValues = entityData?.fact_values ?? [];
  const industryDef = factDefs.find((d) => d.key === "industry");
  const industryVal = industryDef
    ? factValues.find((v) => v.fact_definition_id === industryDef.id)?.value_raw ?? null
    : null;

  return (
    <div className="flex flex-col gap-4 py-4" data-testid="score-card">

      {/* A. Score header (score + confidence + facts used) */}
      <TriageScoreHeader scorecard={kpiScorecard} dealId={dealId} />

      {/* B. Recommendation */}
      <TriageRecommendationCard scorecard={kpiScorecard} />

      {/* C. Buyer Fit */}
      <BuyerFitCard
        scorecard={kpiScorecard}
        buyerProfile={buyerProfile}
        entityData={entityData}
      />

      {/* D. KPI table — detailed breakdown */}
      <KpiTable scorecard={kpiScorecard} industry={industryVal} />

      {/* E. Strengths & Risks — derived from KPI scores */}
      <StrengthsRisksPanel scorecard={kpiScorecard} />

      {/* F. Missing key facts */}
      <MissingKeyFactsPanel scorecard={kpiScorecard} />

      {/* G. Source provenance */}
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
  buyerProfile,
  initialTab,
}: DealPageTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "workspace");
  const handleReviewFacts = () => setActiveTab("facts");

  // Badge: count of core scoring facts that are missing, unclear, or conflicting
  const CORE_SCORING_KEYS = ["asking_price", "sde_latest", "revenue_latest", "employees_ft", "years_in_business"];
  const factsBadge = entityData
    ? (() => {
        const valueMap = new Map(entityData.fact_values.map((v) => [v.fact_definition_id, v]));
        return entityData.fact_definitions
          .filter((fd) => CORE_SCORING_KEYS.includes(fd.key))
          .filter((fd) => {
            const v = valueMap.get(fd.id);
            return !v || v.status === "missing" || v.status === "unclear" || v.status === "conflicting";
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

          {/* New facts banner — shown when AI extracted unreviewed facts from upload */}
          <NewFactsBanner entityData={entityData} onReviewFacts={handleReviewFacts} />

          {/* Conflict alert — shown when scoring facts have unresolved conflicts */}
          <ConflictAlertBanner entityData={entityData} dealId={deal.id} />

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
            ndaFileId={deal.nda_signed_file_id ?? null}
            ndaFileConfidence={deal.nda_signed_confidence ?? null}
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
              overallScore={kpiScorecard?.overall_score ?? null}
              scoringConfig={(entityData.entity.metadata_json.scoring_config as Record<string, number> | undefined) ?? null}
              buyerFitLabel={buyerProfile && entityData
                ? (() => {
                    const factDefs = entityData.fact_definitions;
                    const factVals = entityData.fact_values;
                    const defMap = new Map(factDefs.map((d) => [d.id, d.key]));
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
                    const parseBool = (key: string) => {
                      const raw = getVal(key);
                      if (!raw) return null;
                      return raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
                    };
                    const ft = parseNum("employees_ft") ?? 0;
                    const pt = parseNum("employees_pt") ?? 0;
                    const dealFacts = {
                      industry: getVal("industry"),
                      location: getVal("location"),
                      sde: parseNum("sde_latest") ?? parseNum("ebitda_latest"),
                      asking_price: parseNum("asking_price"),
                      total_employees: (ft + Math.round(pt * 0.5)) || null,
                      manager_in_place: parseBool("manager_in_place"),
                      owner_hours_per_week: parseNum("owner_hours_per_week"),
                    };
                    void defMap; // suppress unused warning
                    const fit = computeBuyerFit(buyerProfile, dealFacts);
                    return fit.label ?? null;
                  })()
                : null}
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
            buyerProfile={buyerProfile}
          />
        </div>
      )}

    </div>
  );
}
