import type { DealSource } from "@/types";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  listing: "Listing",
  "broker-email": "Broker Email",
  "financial-summary": "Financial Summary",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function entryHeading(source: DealSource): string {
  if (source.title) return source.title;
  // Fall back to first ~60 chars of content as a preview heading
  const preview = source.content.trim().replace(/\s+/g, " ").slice(0, 60);
  return preview.length < source.content.trim().length ? `${preview}…` : preview;
}

export default function DealSourceList({ sources }: { sources: DealSource[] }) {
  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
        <p className="text-sm text-slate-400">No entries yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sources.map((source) => {
        const heading = entryHeading(source);
        const typeLabel =
          source.source_type && source.source_type !== "note"
            ? SOURCE_TYPE_LABELS[source.source_type] ?? source.source_type
            : null;

        return (
          <div
            key={source.id}
            className="rounded-xl border border-slate-100 bg-white px-5 py-4 flex flex-col gap-2 shadow-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-800 leading-snug truncate">
                  {heading}
                </span>
                {typeLabel && (
                  <span className="shrink-0 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                    {typeLabel}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 shrink-0 pt-0.5 whitespace-nowrap">
                {formatDate(source.created_at)}
              </span>
            </div>

            {/* Content */}
            <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
              {source.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}
