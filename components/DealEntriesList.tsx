import type { DealSource, DealSourceAnalysis } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  listing: "Listing",
  broker_email: "Broker Email",
  financial_summary: "Financial",
  note: "Note",
  file: "File",
  unknown: "Entry",
};

const TYPE_STYLES: Record<string, string> = {
  listing: "bg-blue-50 text-blue-600",
  broker_email: "bg-amber-50 text-amber-700",
  financial_summary: "bg-green-50 text-green-700",
  note: "bg-slate-100 text-slate-500",
  file: "bg-violet-50 text-violet-700",
  unknown: "bg-slate-100 text-slate-500",
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

/**
 * If the content starts with "[File: ...]", extract just the filename.
 * Returns null for regular text entries.
 */
function extractFileName(content: string): string | null {
  const match = content.match(/^\[File:\s*(.+?)\]/);
  return match ? match[1].trim() : null;
}

/**
 * For text entries without an AI summary yet, show the first ~160 chars
 * of content as a plain-text fallback, stripped of any [File:] prefix.
 */
function contentFallback(content: string): string {
  const stripped = content.replace(/^\[File:[^\]]+\]\s*/i, "").trim();
  if (!stripped) return "";
  return stripped.length > 160 ? stripped.slice(0, 160).trimEnd() + "…" : stripped;
}

type SourceWithAnalysis = DealSource & {
  analysis: DealSourceAnalysis | null;
};

export default function DealEntriesList({
  sources,
}: {
  sources: SourceWithAnalysis[];
}) {
  if (sources.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-4 text-center">No entries yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sources.map((source) => {
        const analysis = source.analysis;
        const title = analysis?.generated_title ?? source.title ?? null;
        const detectedType = analysis?.detected_type ?? source.source_type;
        const typeLabel = detectedType ? (TYPE_LABELS[detectedType] ?? "Entry") : null;
        const typeStyle = detectedType
          ? (TYPE_STYLES[detectedType] ?? TYPE_STYLES.unknown)
          : TYPE_STYLES.unknown;

        const fileName = extractFileName(source.content);
        const isFileEntry = !!fileName;

        // For file entries: use AI title + summary. For text: AI summary or content fallback.
        const bodyText = isFileEntry
          ? (analysis?.summary ?? contentFallback(source.content) ?? null)
          : (analysis?.summary ?? contentFallback(source.content) ?? null);

        return (
          <div
            key={source.id}
            className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2.5 flex flex-col gap-1"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                {typeLabel ? (
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${typeStyle}`}>
                    {typeLabel}
                  </span>
                ) : null}

                <span className="text-xs font-semibold text-slate-800 leading-snug">
                  {title ? (
                    title
                  ) : isFileEntry ? (
                    <span className="text-slate-400 font-normal">{fileName}</span>
                  ) : (
                    <span className="text-slate-400 font-normal italic">Untitled Entry</span>
                  )}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap pt-px">
                {formatDate(source.created_at)}
              </span>
            </div>

            {/* Body — AI summary or content */}
            {bodyText && (
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {bodyText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
