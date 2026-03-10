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

import QuickAddBar from "./QuickAddBar";
import IntakeSection from "./IntakeSection";
import TimelineSection from "./TimelineSection";
import FactsTab from "./entity/FactsTab";
import KpiScorecardTab from "./entity/KpiScorecardTab";
import DeepAnalysisPanel from "./DeepAnalysisPanel";
import { computeDerivedMetrics } from "@/lib/kpi/derivedMetricsService";
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
  analysisBadge,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  factsBadge?: number;
  analysisBadge?: string | null;
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
            {tab.id === "analysis" && analysisBadge && (
              <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-px rounded-full bg-[#D1FAE5] text-[#065F46] text-[10px] font-bold">
                {analysisBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Score trend chart ────────────────────────────────────────────────────────

function ScoreTrendChart({ history }: { history: ScoreHistoryEntry[] }) {
  // Show last 10 entries, oldest-first for left-to-right display
  const entries = [...history].reverse().slice(0, 10);

  if (entries.length < 2) return null;

  const scores = entries.map((e) => e.overall_score_10 ?? 0);
  const maxScore = 10;
  const chartH = 60;
  const chartW = 280;
  const padX = 8;
  const padY = 8;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const points = scores.map((s, i) => {
    const x = padX + (i / Math.max(scores.length - 1, 1)) * innerW;
    const y = padY + innerH - (s / maxScore) * innerH;
    return `${x},${y}`;
  });

  const latestScore = history[0]?.overall_score_10 ?? null;
  const prevScore = history[1]?.overall_score_10 ?? null;
  const delta = latestScore !== null && prevScore !== null ? latestScore - prevScore : null;

  const lineColor = latestScore === null ? "#94a3b8"
    : latestScore >= 7 ? "#10b981"
    : latestScore >= 5 ? "#f59e0b"
    : "#ef4444";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score Trend</p>
        {latestScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-800 tabular-nums">{latestScore.toFixed(1)}</span>
            <span className="text-xs text-slate-400">/10</span>
            {delta !== null && Math.abs(delta) >= 0.1 && (
              <span className={`text-xs font-semibold tabular-nums ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: chartH }}>
        {/* Grid lines */}
        {[2, 4, 6, 8, 10].map((v) => {
          const y = padY + innerH - (v / maxScore) * innerH;
          return (
            <line key={v} x1={padX} y1={y} x2={chartW - padX} y2={y}
              stroke="#f1f5f9" strokeWidth="1" />
          );
        })}
        {/* Area fill */}
        <polyline
          points={[
            `${padX},${padY + innerH}`,
            ...points,
            `${chartW - padX},${padY + innerH}`,
          ].join(" ")}
          fill={lineColor}
          fillOpacity="0.08"
          stroke="none"
        />
        {/* Line */}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((pt, i) => {
          const [x, y] = pt.split(",").map(Number);
          return (
            <circle key={i} cx={x} cy={y} r="3"
              fill="white" stroke={lineColor} strokeWidth="2" />
          );
        })}
      </svg>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-300">
          {new Date(entries[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <span className="text-[10px] text-slate-300">
          {new Date(entries[entries.length - 1].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}

// ─── Score history list ───────────────────────────────────────────────────────

function ScoreHistoryList({ history }: { history: ScoreHistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? history : history.slice(0, 5);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score History</p>
        <span className="text-[11px] text-slate-400">{history.length} recalculations</span>
      </div>
      <div className="divide-y divide-slate-50">
        {visible.map((entry) => {
          const score = entry.overall_score_10 ?? null;
          const score100 = entry.overall_score_100 ?? null;
          const date = new Date(entry.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric",
          });
          const time = new Date(entry.created_at).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit",
          });
          const color = score === null ? "text-slate-400"
            : score >= 7 ? "text-emerald-600"
            : score >= 5 ? "text-amber-600"
            : "text-red-500";
          const barColor = score === null ? "bg-slate-200"
            : score >= 7 ? "bg-emerald-400"
            : score >= 5 ? "bg-amber-400"
            : "bg-red-400";

          return (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-14 shrink-0">
                <div className="text-[11px] text-slate-500 font-medium tabular-nums">{date}</div>
                <div className="text-[10px] text-slate-300 tabular-nums">{time}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  {score100 !== null && (
                    <div className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${score100}%` }} />
                  )}
                </div>
                {entry.trigger_reason && (
                  <div className="text-[10px] text-slate-400 truncate">{entry.trigger_reason}</div>
                )}
              </div>
              <span className={`text-sm font-bold tabular-nums w-10 text-right shrink-0 ${color}`}>
                {score !== null ? `${score.toFixed(1)}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      {history.length > 5 && (
        <div className="px-4 py-2 border-t border-slate-50">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-slate-400 hover:text-[#1F7A63] transition-colors"
          >
            {expanded ? "Show less" : `Show all ${history.length} entries`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Derived metrics panel ────────────────────────────────────────────────────

function DerivedMetricsPanel({ entityData }: { entityData: EntityPageData | null }) {
  if (!entityData) return null;

  const metrics = computeDerivedMetrics(entityData.fact_values, entityData.fact_definitions);
  const items = Object.values(metrics);

  // Only show if at least one metric is available
  if (!items.some((m) => m.available)) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Derived Metrics</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
        {items.map((m) => (
          <div key={m.key} className="px-4 py-3">
            <div className="text-[11px] text-slate-400 mb-0.5">{m.label}</div>
            <div className={`text-base font-bold tabular-nums ${m.available ? "text-slate-800" : "text-slate-300"}`}>
              {m.formatted}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{m.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SWOT panel ───────────────────────────────────────────────────────────────

function SwotPanel({ swot }: { swot: SwotAnalysisContent }) {
  const categories: { key: keyof SwotAnalysisContent; label: string; color: string; bg: string }[] = [
    { key: "strengths",     label: "Strengths",     color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    { key: "weaknesses",    label: "Weaknesses",    color: "text-red-700",     bg: "bg-red-50 border-red-100" },
    { key: "opportunities", label: "Opportunities", color: "text-blue-700",    bg: "bg-blue-50 border-blue-100" },
    { key: "threats",       label: "Threats",       color: "text-amber-700",   bg: "bg-amber-50 border-amber-100" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {categories.map(({ key, label, color, bg }) => {
        const bullets = swot[key] as { text: string; fact_key: string | null }[];
        return (
          <div key={key} className={`rounded-xl border p-3.5 ${bg}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{label}</p>
            {bullets.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No data available yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${color.replace("text-", "bg-")}`} />
                    <span className="text-xs text-slate-700 leading-relaxed">{b.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Missing info panel ───────────────────────────────────────────────────────

function MissingInfoPanel({ info }: { info: MissingInfoResult }) {
  const [showAll, setShowAll] = useState(false);

  const critical = info.missing.filter((m) => m.priority === "critical");
  const important = info.missing.filter((m) => m.priority === "important");
  const niceToHave = info.missing.filter((m) => m.priority === "nice_to_have");

  if (info.missing.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm text-emerald-700 font-medium">All key information collected</p>
      </div>
    );
  }

  const PriorityGroup = ({
    items,
    label,
    dotColor,
  }: {
    items: typeof info.missing;
    label: string;
    dotColor: string;
  }) => {
    if (items.length === 0) return null;
    const visible = showAll ? items : items.slice(0, 4);
    return (
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
        <div className="space-y-1">
          {visible.map((item) => (
            <div key={item.key} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.why}</p>
              </div>
              <span className={`text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full ${
                item.category === "financial"  ? "bg-blue-50 text-blue-600" :
                item.category === "legal"      ? "bg-red-50 text-red-600" :
                item.category === "deal_terms" ? "bg-purple-50 text-purple-600" :
                                                  "bg-slate-100 text-slate-500"
              }`}>
                {item.category.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Missing Information</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {info.critical_count > 0 && <span className="text-red-500 font-semibold">{info.critical_count} critical</span>}
            {info.critical_count > 0 && info.important_count > 0 && " · "}
            {info.important_count > 0 && <span>{info.important_count} important</span>}
            {" "}of {info.total_checked} checked
          </p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-4">
        <PriorityGroup items={critical}   label="Critical"   dotColor="bg-red-400" />
        <PriorityGroup items={important}  label="Important"  dotColor="bg-amber-400" />
        {showAll && <PriorityGroup items={niceToHave} label="Nice to Have" dotColor="bg-slate-300" />}
      </div>
      {(info.missing.length > 8 || niceToHave.length > 0) && (
        <div className="px-4 py-2 border-t border-slate-50">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-[11px] text-slate-400 hover:text-[#1F7A63] transition-colors"
          >
            {showAll ? "Show less" : `Show all ${info.missing.length} items`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Analysis tab ─────────────────────────────────────────────────────────────

function AnalysisTabContent({
  dealId,
  dealStatus,
  kpiScorecard,
  scoreHistory,
  deepAnalysis,
  deepAnalysisStale,
  deepAnalysisRunAt,
  latestSourceAt,
  entityData,
  swotAnalysis,
  missingInfo,
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
    <div className="flex flex-col gap-5 py-4">

      {/* ── Score trend ─────────────────────────────────────────────────── */}
      {scoreHistory.length >= 2 && (
        <section>
          <SectionLabel label="Score Trend" />
          <ScoreTrendChart history={scoreHistory} />
        </section>
      )}

      {/* ── Derived metrics — only shown when inputs are available ─────── */}
      {entityData && Object.values(computeDerivedMetrics(entityData.fact_values, entityData.fact_definitions)).some((m) => m.available) && (
        <section>
          <SectionLabel label="Derived Metrics" />
          <DerivedMetricsPanel entityData={entityData} />
        </section>
      )}

      {/* ── KPI Scorecard ───────────────────────────────────────────────── */}
      <section>
        <SectionLabel label="KPI Scorecard" />
        <KpiScorecardTab scorecard={kpiScorecard} dealId={dealId} />
      </section>

      {/* ── SWOT Analysis ───────────────────────────────────────────────── */}
      {swotAnalysis ? (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">SWOT Analysis</p>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] text-slate-300 shrink-0">
              from {swotAnalysis.facts_used} facts · {new Date(swotAnalysis.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <SwotPanel swot={swotAnalysis} />
        </section>
      ) : (
        <section>
          <SectionLabel label="SWOT Analysis" />
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-5 text-center">
            <p className="text-sm text-slate-400">SWOT analysis generates automatically after facts are filled.</p>
            <p className="text-xs text-slate-300 mt-1">Add at least 2 facts to trigger analysis.</p>
          </div>
        </section>
      )}

      {/* ── Missing Information ─────────────────────────────────────────── */}
      {missingInfo && (
        <section>
          <SectionLabel label="Missing Information" />
          <MissingInfoPanel info={missingInfo} />
        </section>
      )}

      {/* ── Deep Analysis ───────────────────────────────────────────────── */}
      <section>
        <SectionLabel label="AI Deep Analysis" />
        <DeepAnalysisPanel
          dealId={dealId}
          dealStatus={dealStatus}
          analysis={deepAnalysis}
          isStale={deepAnalysisStale}
          runAt={deepAnalysisRunAt}
          latestSourceAt={latestSourceAt}
        />
      </section>

      {/* ── Score history ───────────────────────────────────────────────── */}
      {scoreHistory.length > 0 && (
        <section>
          <SectionLabel label="Score History" />
          <ScoreHistoryList history={scoreHistory} />
        </section>
      )}

    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
        {label}
      </p>
      <div className="flex-1 h-px bg-slate-100" />
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

  // Badge: show 0–10 score if available
  const analysisBadge = kpiScorecard?.overall_score != null
    ? String(kpiScorecard.overall_score)
    : null;

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
        analysisBadge={analysisBadge}
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
