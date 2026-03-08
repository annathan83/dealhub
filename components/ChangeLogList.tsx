import type { DealChangeLogItem } from "@/types";

const CHANGE_TYPE_STYLES: Record<string, string> = {
  new_fact: "bg-blue-50 text-blue-700",
  updated_fact: "bg-indigo-50 text-indigo-700",
  concern: "bg-red-50 text-red-600",
  follow_up: "bg-amber-50 text-amber-700",
  file_uploaded: "bg-slate-100 text-slate-600",
  deal_edited: "bg-violet-50 text-violet-700",
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  new_fact: "New Fact",
  updated_fact: "Updated",
  concern: "Concern",
  follow_up: "Follow Up",
  file_uploaded: "File",
  deal_edited: "Edited",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function ChangeLogList({
  items,
}: {
  items: DealChangeLogItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic">
        No change log entries yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const typeStyle =
          CHANGE_TYPE_STYLES[item.change_type] ?? CHANGE_TYPE_STYLES.new_fact;
        const typeLabel =
          CHANGE_TYPE_LABELS[item.change_type] ?? item.change_type;

        return (
          <div
            key={item.id}
            className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"
          >
            <span
              className={`shrink-0 mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeStyle}`}
            >
              {typeLabel}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 leading-snug">
                {item.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {item.description}
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-300 whitespace-nowrap pt-0.5">
              {formatDate(item.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
