import type { DealChangeLogItem, ChangeLogItemType } from "@/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TYPE_CONFIG: Record<
  ChangeLogItemType,
  { label: string; style: string; dot: string }
> = {
  new_fact: {
    label: "New Fact",
    style: "bg-blue-50 text-blue-700",
    dot: "bg-blue-400",
  },
  updated_fact: {
    label: "Updated",
    style: "bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-400",
  },
  concern: {
    label: "Concern",
    style: "bg-red-50 text-red-600",
    dot: "bg-red-400",
  },
  follow_up: {
    label: "Follow Up",
    style: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  file_uploaded: {
    label: "File",
    style: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  deal_edited: {
    label: "Edited",
    style: "bg-violet-50 text-violet-700",
    dot: "bg-violet-400",
  },
};

function HistoryItem({ item }: { item: DealChangeLogItem }) {
  const config = TYPE_CONFIG[item.change_type] ?? TYPE_CONFIG.new_fact;
  const fileId = item.related_google_file_id;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className={`w-2 h-2 rounded-full ${config.dot}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.style}`}>
              {config.label}
            </span>
            <p className="text-xs font-semibold text-slate-700 leading-snug">
              {item.title}
            </p>
          </div>
          <span className="shrink-0 text-xs text-slate-300 whitespace-nowrap">
            {formatDateTime(item.created_at)}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          {item.description}
        </p>
        {fileId && (
          <a
            href={`https://drive.google.com/file/d/${fileId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open file
          </a>
        )}
      </div>
    </div>
  );
}

export default function DealHistoryPanel({
  changeLog,
}: {
  changeLog: DealChangeLogItem[];
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 border border-slate-100">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">History</h3>
          {changeLog.length > 0 && (
            <p className="text-xs text-slate-400">{changeLog.length} event{changeLog.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Body */}
      {changeLog.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No history yet. Add an entry or upload a file to start the log.
          </p>
        </div>
      ) : (
        <div className="px-5 py-2">
          {changeLog.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
