"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  listing: "bg-blue-50 text-blue-600 border-blue-100",
  broker_email: "bg-amber-50 text-amber-700 border-amber-100",
  financial_summary: "bg-emerald-50 text-emerald-700 border-emerald-100",
  note: "bg-slate-100 text-slate-500 border-slate-200",
  file: "bg-violet-50 text-violet-700 border-violet-100",
  unknown: "bg-slate-100 text-slate-500 border-slate-200",
};

const TYPE_ICON_BG: Record<string, string> = {
  listing: "bg-blue-100",
  broker_email: "bg-amber-100",
  financial_summary: "bg-emerald-100",
  note: "bg-slate-100",
  file: "bg-violet-100",
  unknown: "bg-slate-100",
};

const TYPE_ICON_COLOR: Record<string, string> = {
  listing: "text-blue-600",
  broker_email: "text-amber-600",
  financial_summary: "text-emerald-600",
  note: "text-slate-500",
  file: "text-violet-600",
  unknown: "text-slate-500",
};

function TypeIcon({ type }: { type: string }) {
  if (type === "listing") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (type === "broker_email") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type === "financial_summary") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (type === "file") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    );
  }
  // note / unknown
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function extractFileName(content: string): string | null {
  const match = content.match(/^\[File:\s*(.+?)\]/);
  return match ? match[1].trim() : null;
}

function contentFallback(content: string): string {
  const stripped = content.replace(/^\[File:[^\]]+\]\s*/i, "").trim();
  if (!stripped) return "";
  return stripped.length > 200 ? stripped.slice(0, 200).trimEnd() + "…" : stripped;
}

type SourceWithAnalysis = DealSource & {
  analysis: DealSourceAnalysis | null;
};

type Props = {
  sources: SourceWithAnalysis[];
  dealId: string;
};

function EntryCard({
  source,
  dealId,
  isLast,
}: {
  source: SourceWithAnalysis;
  dealId: string;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const analysis = source.analysis;
  const title = analysis?.generated_title ?? source.title ?? null;
  const detectedType = analysis?.detected_type ?? source.source_type ?? "unknown";
  const typeLabel = TYPE_LABELS[detectedType] ?? "Entry";
  const typeStyle = TYPE_STYLES[detectedType] ?? TYPE_STYLES.unknown;
  const iconBg = TYPE_ICON_BG[detectedType] ?? TYPE_ICON_BG.unknown;
  const iconColor = TYPE_ICON_COLOR[detectedType] ?? TYPE_ICON_COLOR.unknown;

  const fileName = extractFileName(source.content);
  const isFileEntry = !!fileName;
  const bodyText = analysis?.summary ?? contentFallback(source.content) ?? null;

  function handleDelete() {
    startTransition(async () => {
      await fetch(`/api/deals/${dealId}/entries/${source.id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <div className="relative flex gap-4 pb-4 last:pb-0">
      {/* Timeline dot / icon + connecting line */}
      <div className="relative flex-shrink-0 flex flex-col items-center">
        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${iconBg} ${iconColor}`}>
          <TypeIcon type={detectedType} />
        </div>
        {!isLast && (
          <div className="flex-1 w-px bg-slate-100 mt-1" />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeStyle}`}>
              {typeLabel}
            </span>
            <span className="text-sm font-semibold text-slate-800 leading-snug truncate">
              {title ? (
                title
              ) : isFileEntry ? (
                <span className="text-slate-400 font-normal text-xs">{fileName}</span>
              ) : (
                <span className="text-slate-400 font-normal italic text-xs">Untitled Entry</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 whitespace-nowrap pt-px tabular-nums">
              {formatDate(source.created_at)}
            </span>
            {/* Delete button */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                className="p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                title="Delete entry"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {isPending ? "…" : "Delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isPending}
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Keep
                </button>
              </div>
            )}
          </div>
        </div>

        {bodyText && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            {bodyText}
          </p>
        )}

        {isFileEntry && fileName && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-100 px-2 py-1">
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">{fileName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DealEntriesList({ sources, dealId }: Props) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">No entries yet</p>
        <p className="text-xs text-slate-400">Add a note, photo, or file to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {sources.map((source, idx) => (
        <EntryCard
          key={source.id}
          source={source}
          dealId={dealId}
          isLast={idx === sources.length - 1}
        />
      ))}
    </div>
  );
}
