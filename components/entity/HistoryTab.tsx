"use client";

import type { EntityEvent, FactDefinition, EntityFileWithText } from "@/types/entity";

type Props = {
  events: EntityEvent[];
  factDefinitions: FactDefinition[];
  files: EntityFileWithText[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type EventConfig = {
  icon: React.ReactNode;
  dotClass: string;
  label: (event: EntityEvent, factDefs: Map<string, FactDefinition>, files: Map<string, EntityFileWithText>) => string;
};

const EVENT_CONFIGS: Record<string, EventConfig> = {
  file_uploaded: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    dotClass: "bg-indigo-500",
    label: (ev, _, files) => {
      const file = ev.file_id ? files.get(ev.file_id) : null;
      const name = file?.file_name ?? (ev.metadata_json.file_name as string | undefined) ?? "File";
      return `Uploaded: ${name}`;
    },
  },
  text_extracted: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    dotClass: "bg-slate-400",
    label: (ev) => {
      const chunks = ev.metadata_json.chunk_count as number | undefined;
      return `Text extracted${chunks ? ` (${chunks} chunks)` : ""}`;
    },
  },
  facts_extracted: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    dotClass: "bg-emerald-500",
    label: (ev) => {
      const found = ev.metadata_json.facts_found as number | undefined;
      return `Facts extracted${found !== undefined ? ` (${found} found)` : ""}`;
    },
  },
  fact_updated: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    dotClass: "bg-blue-500",
    label: (ev, factDefs) => {
      const fd = ev.fact_definition_id ? factDefs.get(ev.fact_definition_id) : null;
      const newVal = ev.metadata_json.new_value as string | undefined;
      return `Fact updated: ${fd?.label ?? "unknown"}${newVal ? ` → ${newVal}` : ""}`;
    },
  },
  fact_conflict_detected: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    dotClass: "bg-red-500",
    label: (ev, factDefs) => {
      const fd = ev.fact_definition_id ? factDefs.get(ev.fact_definition_id) : null;
      return `Conflict detected: ${fd?.label ?? "unknown"}`;
    },
  },
  analysis_refreshed: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    dotClass: "bg-purple-500",
    label: () => "AI analysis refreshed",
  },
};

const DEFAULT_CONFIG: EventConfig = {
  icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  dotClass: "bg-slate-400",
  label: (ev) => ev.event_type.replace(/_/g, " "),
};

export default function HistoryTab({ events, factDefinitions, files }: Props) {
  const factDefMap = new Map<string, FactDefinition>();
  for (const fd of factDefinitions) factDefMap.set(fd.id, fd);

  const fileMap = new Map<string, EntityFileWithText>();
  for (const f of files) fileMap.set(f.id, f);

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-medium">No history yet</p>
        <p className="text-slate-400 text-xs mt-1">
          Events will appear here as you add documents and entries.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />

      <div className="space-y-1">
        {events.map((event) => {
          const cfg = EVENT_CONFIGS[event.event_type] ?? DEFAULT_CONFIG;
          const label = cfg.label(event, factDefMap, fileMap);

          return (
            <div key={event.id} className="flex items-start gap-3 py-2 pl-1">
              {/* Dot + icon */}
              <div className={`relative z-10 w-9 h-9 rounded-full ${cfg.dotClass} bg-opacity-10 flex items-center justify-center shrink-0 border-2 border-white`}>
                <div className={`${cfg.dotClass.replace("bg-", "text-")}`}>
                  {cfg.icon}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-slate-700">{label}</span>
                  <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                    {formatDate(event.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
