"use client";

import { useState } from "react";
import type { EntityPageData } from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import type { DeepAnalysisContent } from "@/lib/services/entity/deepAnalysisService";
import type { DealStatus } from "@/types";
import AIAnalysisTab from "./entity/AIAnalysisTab";
import FactsTab from "./entity/FactsTab";
import HistoryTab from "./entity/HistoryTab";
import KpiScorecardTab from "./entity/KpiScorecardTab";

// Tab order: Deep Analysis → All Facts → History → KPI Score (demoted)
type Tab = "ai" | "facts" | "history" | "kpi";

type Props = {
  data: EntityPageData;
  scorecard: KpiScorecardResult | null;
  dealId: string;
  dealStatus: DealStatus;
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
};

export default function DealDetailTabs({
  data,
  scorecard,
  dealId,
  dealStatus,
  deepAnalysis,
  deepAnalysisStale,
  deepAnalysisRunAt,
  latestSourceAt,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("ai");

  const isStale = deepAnalysisStale && deepAnalysis !== null;

  const criticalMissingCount = data.fact_definitions.filter((fd) => {
    if (!fd.is_critical) return false;
    const val = data.fact_values.find((v) => v.fact_definition_id === fd.id);
    return !val || val.status === "missing" || val.status === "unclear";
  }).length;

  const conflictCount = data.fact_values.filter((v) => v.status === "conflicting").length;

  type TabConfig = {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number | null;
    dot?: boolean;
  };

  const TABS: TabConfig[] = [
    {
      id: "ai",
      label: "Deep Analysis",
      dot: isStale,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      id: "facts",
      label: "All Facts",
      badge: criticalMissingCount > 0 ? criticalMissingCount : (conflictCount > 0 ? conflictCount : null),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "History",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "kpi",
      label: "KPI",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-100 px-1 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isBadgeConflict = tab.id === "facts" && conflictCount > 0 && criticalMissingCount === 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors shrink-0
                ${isActive
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label}</span>

              {/* Stale dot */}
              {tab.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="New information since last analysis" />
              )}

              {/* Badge */}
              {tab.badge != null && (
                <span className={`
                  px-1.5 py-0.5 text-[10px] font-semibold rounded-full
                  ${isBadgeConflict
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-700"
                  }
                `}>
                  {tab.badge}
                </span>
              )}

              {/* KPI score inline */}
              {tab.id === "kpi" && scorecard?.overall_score_100 != null && (
                <span className={`
                  px-1.5 py-0.5 text-[10px] font-bold rounded-full
                  ${scorecard.overall_score_100 >= 70 ? "bg-emerald-100 text-emerald-700"
                    : scorecard.overall_score_100 >= 50 ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"}
                `}>
                  {scorecard.overall_score_100}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4 sm:p-5">
        {activeTab === "ai" && (
          <AIAnalysisTab
            dealId={dealId}
            dealStatus={dealStatus}
            deepAnalysis={deepAnalysis}
            deepAnalysisStale={deepAnalysisStale}
            deepAnalysisRunAt={deepAnalysisRunAt}
            latestSourceAt={latestSourceAt}
          />
        )}
        {activeTab === "facts" && (
          <FactsTab
            factDefinitions={data.fact_definitions}
            factValues={data.fact_values}
            factEvidence={data.fact_evidence}
            files={data.files}
            dealId={dealId}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab
            events={data.events}
            factDefinitions={data.fact_definitions}
            files={data.files}
          />
        )}
        {activeTab === "kpi" && (
          <KpiScorecardTab scorecard={scorecard} dealId={dealId} />
        )}
      </div>
    </div>
  );
}
