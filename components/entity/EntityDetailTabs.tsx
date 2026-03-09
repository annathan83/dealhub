"use client";

import { useState } from "react";
import type { EntityPageData } from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import FactsTab from "./FactsTab";
import AIAnalysisTab from "./AIAnalysisTab";
import FilesTab from "./FilesTab";
import HistoryTab from "./HistoryTab";
import KpiScorecardTab from "./KpiScorecardTab";

type Tab = "facts" | "kpi" | "ai" | "files" | "history";

type Props = {
  data: EntityPageData;
  scorecard: KpiScorecardResult | null;
  dealId: string;
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "facts",
    label: "Facts",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: "kpi",
    label: "KPI Score",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "ai",
    label: "AI Analysis",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: "files",
    label: "Files",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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
];

export default function EntityDetailTabs({ data, scorecard, dealId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("facts");

  const confirmedCount = data.fact_values.filter(
    (v) => v.status === "confirmed" || v.status === "estimated"
  ).length;

  const criticalMissingCount = data.fact_definitions.filter((fd) => {
    if (!fd.is_critical) return false;
    const val = data.fact_values.find((v) => v.fact_definition_id === fd.id);
    return !val || val.status === "missing" || val.status === "unclear";
  }).length;

  const conflictCount = data.fact_values.filter((v) => v.status === "conflicting").length;

  return (
    <div className="mt-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          let badge: number | null = null;
          if (tab.id === "facts" && criticalMissingCount > 0) badge = criticalMissingCount;
          if (tab.id === "files") badge = data.files.length > 0 ? data.files.length : null;
          if (tab.id === "kpi" && scorecard?.overall_score_100 != null) badge = null; // show score inline instead

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-lg
                border-b-2 transition-colors
                ${isActive
                  ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {/* KPI tab: show score inline */}
              {tab.id === "kpi" && scorecard?.overall_score_100 != null && (
                <span className={`
                  ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full
                  ${scorecard.overall_score_100 >= 70 ? "bg-emerald-100 text-emerald-700"
                    : scorecard.overall_score_100 >= 50 ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"}
                `}>
                  {scorecard.overall_score_100}
                </span>
              )}
              {badge !== null && (
                <span className={`
                  ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full
                  ${tab.id === "facts" && criticalMissingCount > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                  }
                `}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Coverage pill — shown on all tabs */}
        {data.fact_definitions.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500">
            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{
                  width: `${Math.round((confirmedCount / data.fact_definitions.length) * 100)}%`,
                }}
              />
            </div>
            <span className="tabular-nums">
              {Math.round((confirmedCount / data.fact_definitions.length) * 100)}% facts covered
            </span>
            {conflictCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-semibold">
                {conflictCount} conflict{conflictCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "facts" && (
        <FactsTab
          factDefinitions={data.fact_definitions}
          factValues={data.fact_values}
          factEvidence={data.fact_evidence}
          files={data.files}
          dealId={dealId}
        />
      )}
      {activeTab === "kpi" && (
        <KpiScorecardTab scorecard={scorecard} dealId={dealId} />
      )}
      {activeTab === "ai" && (
        <AIAnalysisTab
          snapshots={data.analysis_snapshots.filter((s) => s.analysis_type !== "kpi_scorecard")}
        />
      )}
      {activeTab === "files" && (
        <FilesTab files={data.files} entity={data.entity} dealId={dealId} />
      )}
      {activeTab === "history" && (
        <HistoryTab
          events={data.events}
          factDefinitions={data.fact_definitions}
          files={data.files}
        />
      )}
    </div>
  );
}
