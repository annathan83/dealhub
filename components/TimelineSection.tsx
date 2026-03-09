"use client";

import { useState, useCallback } from "react";
import type { TimelineItem, TimelineIconType } from "@/lib/services/entity/entityTimelineService";

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Icon components ──────────────────────────────────────────────────────────

const ICON_STYLES: Record<TimelineIconType, { bg: string; text: string }> = {
  file:        { bg: "bg-slate-100",   text: "text-slate-500" },
  note:        { bg: "bg-amber-50",    text: "text-amber-600" },
  audio:       { bg: "bg-violet-50",   text: "text-violet-600" },
  image:       { bg: "bg-sky-50",      text: "text-sky-600" },
  pdf:         { bg: "bg-red-50",      text: "text-red-500" },
  spreadsheet: { bg: "bg-emerald-50",  text: "text-emerald-600" },
  analysis:    { bg: "bg-indigo-50",   text: "text-indigo-600" },
  fact:        { bg: "bg-blue-50",     text: "text-blue-600" },
  status:      { bg: "bg-slate-100",   text: "text-slate-500" },
  pass:        { bg: "bg-red-50",      text: "text-red-500" },
  processing:  { bg: "bg-amber-50",    text: "text-amber-600" },
  check:       { bg: "bg-slate-100",   text: "text-slate-400" },
};

function TimelineIcon({ type }: { type: TimelineIconType }) {
  const style = ICON_STYLES[type];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
      {type === "file" || type === "pdf" || type === "spreadsheet" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ) : type === "note" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ) : type === "audio" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ) : type === "image" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) : type === "analysis" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ) : type === "fact" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ) : type === "processing" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ) : type === "pass" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

// ─── Single timeline entry ────────────────────────────────────────────────────

function TimelineEntry({
  item,
  isLast,
  onFileClick,
}: {
  item: TimelineItem;
  isLast: boolean;
  onFileClick?: (fileId: string) => void;
}) {
  const isClickable = !!(item.fileId && onFileClick);

  function handleClick() {
    if (item.fileId && onFileClick) {
      onFileClick(item.fileId);
    }
  }

  return (
    <div className="flex gap-3 group">
      {/* Left: icon + connector line */}
      <div className="flex flex-col items-center">
        <TimelineIcon type={item.icon} />
        {!isLast && (
          <div className="w-px flex-1 bg-slate-100 mt-1 min-h-[16px]" />
        )}
      </div>

      {/* Right: content */}
      <div
        className={`flex-1 pb-5 min-w-0 ${isLast ? "" : ""}`}
      >
        <button
          onClick={isClickable ? handleClick : undefined}
          disabled={!isClickable}
          className={`w-full text-left rounded-xl px-3 py-2.5 -mx-3 transition-colors ${
            isClickable
              ? "hover:bg-slate-50 cursor-pointer"
              : "cursor-default"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {item.title}
            </p>
            <span className="text-[11px] text-slate-400 shrink-0 mt-0.5 whitespace-nowrap">
              {relativeTime(item.timestamp)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {item.summary}
          </p>
          {isClickable && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View file
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 4;

export default function TimelineSection({
  items,
  onFileClick,
}: {
  items: TimelineItem[];
  onFileClick?: (fileId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? items : items.slice(0, DEFAULT_VISIBLE);
  const hasMore = items.length > DEFAULT_VISIBLE;

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">History</h2>
        <p className="text-xs text-slate-400">
          Activity will appear here as files are added and processed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">History</h2>
          <span className="text-[11px] text-slate-400">{items.length} events</span>
        </div>
      </div>

      {/* Timeline entries */}
      <div className="px-5 pt-4 pb-2">
        {visible.map((item, idx) => (
          <TimelineEntry
            key={item.id}
            item={item}
            isLast={idx === visible.length - 1 && (!hasMore || expanded)}
            onFileClick={onFileClick}
          />
        ))}
      </div>

      {/* Expand / collapse */}
      {hasMore && (
        <div className="px-5 pb-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-100 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            {expanded ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                Show less
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                Show {items.length - DEFAULT_VISIBLE} more
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
