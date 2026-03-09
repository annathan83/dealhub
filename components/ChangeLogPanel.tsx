"use client";

/**
 * ChangeLogPanel
 *
 * Shows a chronological log of changes to the deal:
 * file uploads, text entries, edits, and AI-detected changes.
 * This is the only remaining use of deal_change_log.
 */

import type { DealChangeLogItem } from "@/types";

type Props = {
  changeLog: DealChangeLogItem[];
};

const CHANGE_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  file_uploaded:       { icon: "📎", color: "bg-blue-100 text-blue-700" },
  entry_added:         { icon: "📝", color: "bg-slate-100 text-slate-600" },
  asking_price_change: { icon: "💰", color: "bg-amber-100 text-amber-700" },
  revenue_change:      { icon: "📈", color: "bg-green-100 text-green-700" },
  sde_change:          { icon: "📊", color: "bg-indigo-100 text-indigo-700" },
  status_change:       { icon: "🔄", color: "bg-purple-100 text-purple-700" },
  risk_flag_added:     { icon: "⚠️", color: "bg-red-100 text-red-700" },
  risk_flag_resolved:  { icon: "✅", color: "bg-green-100 text-green-700" },
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

export default function ChangeLogPanel({ changeLog }: Props) {
  if (changeLog.length === 0) {
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
        <span className="ml-auto text-xs text-slate-400">{changeLog.length} events</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {changeLog.slice(0, 20).map((item) => {
          const cfg = CHANGE_TYPE_CONFIG[item.change_type] ?? { icon: "•", color: "bg-slate-100 text-slate-500" };
          return (
            <li key={item.id} className="px-4 py-3 flex items-start gap-3">
              <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${cfg.color}`}>
                {cfg.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
              <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">
                {formatRelativeTime(item.created_at)}
              </span>
            </li>
          );
        })}
        {changeLog.length > 20 && (
          <li className="px-4 py-2 text-center text-xs text-slate-400">
            + {changeLog.length - 20} more events
          </li>
        )}
      </ul>
    </div>
  );
}
