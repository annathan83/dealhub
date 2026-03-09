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

import QuickAddBar from "./QuickAddBar";
import IntakeSection from "./IntakeSection";
import TimelineSection from "./TimelineSection";
import FactsTab from "./entity/FactsTab";
import KpiScorecardTab from "./entity/KpiScorecardTab";
import DeepAnalysisPanel from "./DeepAnalysisPanel";

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
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
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
    <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? "text-indigo-600 border-b-2 border-indigo-600 -mb-px"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab.label}
            {tab.id === "facts" && factsBadge != null && factsBadge > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {factsBadge > 9 ? "9+" : factsBadge}
              </span>
            )}
            {tab.id === "analysis" && analysisBadge && (
              <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-px rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                {analysisBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Score history from analysis snapshots ────────────────────────────────────

function ScoreHistory({ snapshots }: { snapshots: AnalysisSnapshot[] }) {
  const kpiSnapshots = snapshots
    .filter((s) => s.analysis_type === "kpi_scorecard")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-8); // last 8 runs

  if (kpiSnapshots.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score History</p>
      </div>
      <div className="divide-y divide-slate-50">
        {[...kpiSnapshots].reverse().map((snap) => {
          const content = snap.content_json as { overall_score_100?: number };
          const score = content.overall_score_100 ?? null;
          const date = new Date(snap.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric",
          });
          const color = score === null ? "text-slate-400"
            : score >= 70 ? "text-emerald-600"
            : score >= 50 ? "text-amber-600"
            : "text-red-500";
          return (
            <div key={snap.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs text-slate-400 tabular-nums w-14 shrink-0">{date}</span>
              <div className="flex-1 min-w-0">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  {score !== null && (
                    <div
                      className={`h-full rounded-full transition-all ${
                        score >= 70 ? "bg-emerald-400" : score >= 50 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  )}
                </div>
              </div>
              <span className={`text-sm font-bold tabular-nums w-10 text-right shrink-0 ${color}`}>
                {score !== null ? score : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Analysis tab ─────────────────────────────────────────────────────────────

function AnalysisTabContent({
  dealId,
  dealStatus,
  kpiScorecard,
  deepAnalysis,
  deepAnalysisStale,
  deepAnalysisRunAt,
  latestSourceAt,
  analysisSnapshots,
}: {
  dealId: string;
  dealStatus: DealStatus;
  kpiScorecard: KpiScorecardResult | null;
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
  analysisSnapshots: AnalysisSnapshot[];
}) {
  return (
    <div className="flex flex-col gap-5 py-4">

      {/* ── Scorecard ──────────────────────────────────────────────────── */}
      <section>
        <SectionLabel label="Scorecard" />
        <KpiScorecardTab scorecard={kpiScorecard} dealId={dealId} />
      </section>

      {/* ── Deep Analysis ──────────────────────────────────────────────── */}
      <section>
        <SectionLabel label="AI Analysis" />
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
      <section>
        <ScoreHistory snapshots={analysisSnapshots} />
      </section>

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
  deepAnalysis,
  deepAnalysisStale,
  deepAnalysisRunAt,
  latestSourceAt,
}: DealPageTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("workspace");

  // Badge: count of missing/conflicting critical facts
  const factsBadge = entityData
    ? entityData.fact_values.filter(
        (v) => v.status === "missing" || v.status === "conflicting"
      ).length
    : 0;

  // Badge: show score if available
  const analysisBadge = kpiScorecard?.overall_score_100 != null
    ? String(kpiScorecard.overall_score_100)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

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

          {/* File workspace */}
          <IntakeSection
            dealId={deal.id}
            dealName={deal.name}
            driveFolderId={deal.google_drive_folder_id ?? null}
            isDriveConnected={isDriveConnected}
            files={syncedFiles}
            triageSummaryExists={triageSummaryExists}
            newFilesAfterTriage={newFilesAfterTriage}
          />

          {/* Activity timeline */}
          <div className="pt-1">
            <TimelineSection
              items={timelineItems}
              dealName={deal.name}
              dealCreatedAt={deal.created_at}
              files={syncedFiles}
              dealId={deal.id}
            />
          </div>

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
            deepAnalysis={deepAnalysis}
            deepAnalysisStale={deepAnalysisStale}
            deepAnalysisRunAt={deepAnalysisRunAt}
            latestSourceAt={latestSourceAt}
            analysisSnapshots={analysisSnapshots}
          />
        </div>
      )}

    </div>
  );
}
