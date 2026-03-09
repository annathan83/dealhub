"use client";

import type { EntityEvent } from "@/types/entity";

type Props = {
  events: EntityEvent[];
};

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  file_uploaded:           { icon: "📎", color: "bg-blue-100 text-blue-700",    label: "File uploaded" },
  entry_added:             { icon: "📝", color: "bg-slate-100 text-slate-600",  label: "Entry added" },
  text_extracted:          { icon: "📄", color: "bg-slate-100 text-slate-500",  label: "Text extracted" },
  facts_extracted:         { icon: "🔍", color: "bg-indigo-100 text-indigo-700", label: "Facts extracted" },
  fact_updated:            { icon: "📊", color: "bg-green-100 text-green-700",  label: "Fact updated" },
  fact_conflict_detected:  { icon: "⚠️", color: "bg-amber-100 text-amber-700", label: "Fact conflict" },
  analysis_refreshed:      { icon: "🔄", color: "bg-purple-100 text-purple-700", label: "Analysis refreshed" },
  fact_manually_edited:    { icon: "✏️", color: "bg-orange-100 text-orange-700", label: "Fact edited" },
  fact_manually_confirmed: { icon: "✅", color: "bg-green-100 text-green-700",  label: "Fact confirmed" },
  deep_scan_started:       { icon: "🔬", color: "bg-indigo-100 text-indigo-600", label: "Deep scan started" },
  deep_scan_completed:     { icon: "✅", color: "bg-indigo-100 text-indigo-700", label: "Deep scan done" },
  triage_completed:        { icon: "🏷️", color: "bg-teal-100 text-teal-700",   label: "Triage completed" },
  deep_analysis_started:   { icon: "🧠", color: "bg-violet-100 text-violet-700", label: "Deep analysis started" },
  deep_analysis_completed: { icon: "🧠", color: "bg-violet-100 text-violet-700", label: "Deep analysis done" },
  deal_edited:             { icon: "✏️", color: "bg-slate-100 text-slate-600",  label: "Deal updated" },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getEventTitle(event: EntityEvent): string {
  const meta = event.metadata_json;
  if (meta?.title && typeof meta.title === "string") return meta.title;
  return EVENT_CONFIG[event.event_type]?.label ?? event.event_type.replace(/_/g, " ");
}

function getEventDescription(event: EntityEvent): string | null {
  const meta = event.metadata_json;
  if (meta?.description && typeof meta.description === "string") return meta.description;
  if (meta?.file_name && typeof meta.file_name === "string") return meta.file_name as string;
  if (meta?.facts_found !== undefined) return `${meta.facts_found} facts found`;
  return null;
}

export default function ChangeLogPanel({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
        </div>
        <div className="p-5 text-center text-sm text-slate-400">
          No activity yet. Add entries or upload files to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
        <span className="ml-auto text-xs text-slate-400">{events.length} events</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {events.slice(0, 20).map((event) => {
          const cfg = EVENT_CONFIG[event.event_type] ?? { icon: "•", color: "bg-slate-100 text-slate-500", label: event.event_type };
          const title = getEventTitle(event);
          const description = getEventDescription(event);

          return (
            <li key={event.id} className="px-4 py-3 flex items-start gap-3">
              <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${cfg.color}`}>
                {cfg.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{title}</p>
                {description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</p>
                )}
              </div>
              <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">
                {formatRelativeTime(event.created_at)}
              </span>
            </li>
          );
        })}
        {events.length > 20 && (
          <li className="px-4 py-2 text-center text-xs text-slate-400">
            + {events.length - 20} more events
          </li>
        )}
      </ul>
    </div>
  );
}
