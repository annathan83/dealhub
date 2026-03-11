"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TimelineItem, TimelineIconType } from "@/lib/services/entity/entityTimelineService";
import type { EntityFile } from "@/types/entity";
import FileDetailModal from "./FileDetailModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Spine constants ──────────────────────────────────────────────────────────

const SPINE_COLOR = "#cbd5e1"; // slate-300
const SPINE_W     = 1.5;
const SPINE_COL_W = 28; // px — width of the left column

// ─── Node styles ──────────────────────────────────────────────────────────────

const NODE_STYLES: Record<TimelineIconType, { ring: string; bg: string; icon: string }> = {
  file:        { ring: "ring-slate-300",   bg: "bg-white",      icon: "text-slate-500"   },
  note:        { ring: "ring-amber-300",   bg: "bg-amber-50",   icon: "text-amber-600"   },
  audio:       { ring: "ring-violet-300",  bg: "bg-violet-50",  icon: "text-violet-600"  },
  image:       { ring: "ring-sky-300",     bg: "bg-sky-50",     icon: "text-sky-600"     },
  pdf:         { ring: "ring-red-300",     bg: "bg-red-50",     icon: "text-red-600"     },
  spreadsheet: { ring: "ring-emerald-300", bg: "bg-emerald-50", icon: "text-emerald-700" },
  analysis:    { ring: "ring-indigo-300",  bg: "bg-indigo-50",  icon: "text-indigo-700"  },
  fact:        { ring: "ring-blue-300",    bg: "bg-blue-50",    icon: "text-blue-700"    },
  status:      { ring: "ring-slate-300",   bg: "bg-white",      icon: "text-slate-500"   },
  pass:        { ring: "ring-red-300",     bg: "bg-red-50",     icon: "text-red-600"     },
  processing:  { ring: "ring-amber-300",   bg: "bg-amber-50",   icon: "text-amber-600"   },
  check:       { ring: "ring-slate-300",   bg: "bg-white",      icon: "text-slate-500"   },
};

function NodeIcon({ type }: { type: TimelineIconType }) {
  const { ring, bg, icon } = NODE_STYLES[type];
  return (
    <div className={`w-6 h-6 rounded-full ring-2 shadow-[0_0_0_2px_white] flex items-center justify-center shrink-0 relative z-10 ${ring} ${bg} ${icon}`}>
      {(type === "file" || type === "pdf" || type === "spreadsheet") ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ) : type === "note" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ) : type === "audio" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ) : type === "image" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) : type === "analysis" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ) : type === "fact" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ) : type === "processing" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ) : type === "pass" ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

// ─── "Deal created" anchor node ───────────────────────────────────────────────
// Always pinned at the bottom of the timeline. Uses a filled indigo circle.

function CreatedNode() {
  return (
    <div className="w-6 h-6 rounded-full bg-indigo-600 shadow-[0_0_0_2px_white] ring-2 ring-indigo-300 flex items-center justify-center shrink-0 relative z-10">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </div>
  );
}

// ─── Gap indicator (dots on the spine) ───────────────────────────────────────
// Shown between the "last 3 recent" block and the "deal created" anchor
// when there are hidden events in between.

function GapIndicator({
  hiddenCount,
  onExpand,
}: {
  hiddenCount: number;
  onExpand: () => void;
}) {
  return (
    <div className="flex gap-0">
      {/* Left: dots on the spine */}
      <div
        className="flex flex-col items-center gap-[3px] py-1"
        style={{ width: SPINE_COL_W, minWidth: SPINE_COL_W }}
      >
        {/* Top connector */}
        <div style={{ width: SPINE_W, height: 6, background: SPINE_COLOR }} />
        {/* Three dots */}
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: SPINE_COLOR }} />
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: SPINE_COLOR }} />
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: SPINE_COLOR }} />
        {/* Bottom connector */}
        <div style={{ width: SPINE_W, height: 6, background: SPINE_COLOR }} />
      </div>

      {/* Right: expand link */}
      <div className="flex-1 min-w-0 pl-3 flex items-center">
        <button
          type="button"
          onClick={onExpand}
          className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
        >
          {hiddenCount} more event{hiddenCount !== 1 ? "s" : ""} — show all
        </button>
      </div>
    </div>
  );
}

// ─── Single timeline entry ────────────────────────────────────────────────────

function TimelineEntry({
  item,
  hasTopConnector,
  hasBottomConnector,
  onFileClick,
  onConflictClick,
}: {
  item: TimelineItem;
  hasTopConnector: boolean;
  hasBottomConnector: boolean;
  onFileClick?: (fileId: string) => void;
  onConflictClick?: (item: TimelineItem) => void;
}) {
  const isFileClickable = !!(item.fileId && onFileClick);
  const isConflict = item.icon === "fact" && !!item.conflictData;
  const isClickable = isFileClickable || (isConflict && !!onConflictClick);

  function handleClick() {
    if (isFileClickable) { onFileClick!(item.fileId!); return; }
    if (isConflict && onConflictClick) { onConflictClick(item); }
  }

  return (
    <div className="flex gap-0">
      {/* ── Left: spine + node ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center"
        style={{ width: SPINE_COL_W, minWidth: SPINE_COL_W }}
      >
        <div style={{ width: SPINE_W, height: 8, background: hasTopConnector ? SPINE_COLOR : "transparent" }} />
        <NodeIcon type={item.icon} />
        {hasBottomConnector && (
          <div className="flex-1 min-h-[10px]" style={{ width: SPINE_W, background: SPINE_COLOR }} />
        )}
      </div>

      {/* ── Right: content ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-w-0 pl-3 pb-3"
        style={{ paddingTop: 4 }}
      >
        <button
          type="button"
          onClick={isClickable ? handleClick : undefined}
          disabled={!isClickable}
          className={`w-full text-left group ${isClickable ? "cursor-pointer" : "cursor-default"}`}
        >
          {/* Title + timestamp on one line */}
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm font-semibold leading-snug flex-1 min-w-0 ${
              isConflict
                ? "text-amber-700 group-hover:text-amber-800 transition-colors"
                : isClickable
                  ? "text-slate-800 group-hover:text-[#1F7A63] transition-colors"
                  : "text-slate-800"
            }`}>
              {item.title}
              {isConflict && (
                <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full">
                  Resolve
                </span>
              )}
              {isFileClickable && (
                <svg className="w-3 h-3 inline ml-1 text-[#1F7A63] opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </p>
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0 whitespace-nowrap">
              {relativeTime(item.timestamp)}
            </span>
          </div>

          {/* Summary — up to 2 lines */}
          <p className={`text-[11px] mt-0.5 leading-snug line-clamp-2 ${
            isConflict ? "text-amber-600/80" : "text-slate-400"
          }`}>
            {item.summary}
          </p>
        </button>
      </div>
    </div>
  );
}

// ─── "Deal created" anchor entry ─────────────────────────────────────────────

function CreatedEntry({
  dealName,
  createdAt,
  hasTopConnector,
}: {
  dealName: string;
  createdAt: string;
  hasTopConnector: boolean;
}) {
  return (
    <div className="flex gap-0">
      <div
        className="flex flex-col items-center"
        style={{ width: SPINE_COL_W, minWidth: SPINE_COL_W }}
      >
        <div style={{ width: SPINE_W, height: 8, background: hasTopConnector ? SPINE_COLOR : "transparent" }} />
        <CreatedNode />
        {/* No bottom connector — this is always the last item */}
      </div>
      <div className="flex-1 min-w-0 pl-3 pb-1" style={{ paddingTop: 4 }}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 leading-snug flex-1 min-w-0 truncate">
            Deal created
          </p>
          <span className="text-[11px] text-slate-400 tabular-nums shrink-0 whitespace-nowrap">
            {absoluteDate(createdAt)}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug truncate">
          {dealName} was added to the pipeline.
        </p>
      </div>
    </div>
  );
}

// ─── Conflict resolution modal ────────────────────────────────────────────────
// Lightweight modal shown when user clicks a fact_conflict_detected timeline item.

function ConflictResolutionModal({
  dealId,
  conflict,
  onClose,
  onResolved,
}: {
  dealId: string;
  conflict: NonNullable<TimelineItem["conflictData"]>;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(keepValue: string, changeType: "confirm" | "override") {
    if (!conflict.factDefinitionId) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/facts/${conflict.factDefinitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_type: changeType,
          value_raw: keepValue,
          old_value: conflict.existingValue,
          note: `Conflict resolved via timeline — kept ${keepValue}`,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to resolve."); return; }
      onResolved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-slate-800">Conflicting Value</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {conflict.factLabel}
          </p>

          {conflict.snippet && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4 border border-slate-100">
              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                &ldquo;{conflict.snippet.slice(0, 120)}{conflict.snippet.length > 120 ? "…" : ""}&rdquo;
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Existing */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Current</p>
              <p className="text-base font-bold text-slate-800 tabular-nums">{conflict.existingValue}</p>
            </div>
            {/* New */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 px-3 py-3">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">New evidence</p>
              <p className="text-base font-bold text-blue-800 tabular-nums">{conflict.newValue}</p>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => resolve(conflict.newValue, "override")}
              className="w-full py-2.5 bg-[#1F7A63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a6854] disabled:opacity-50 transition-colors"
            >
              Use new value ({conflict.newValue})
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => resolve(conflict.existingValue, "confirm")}
              className="w-full py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              Keep existing ({conflict.existingValue})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Items arrive newest-first. We always show:
//   [most recent 3]  ← top
//   [gap indicator]  ← if hidden events exist
//   [deal created]   ← bottom anchor (always)
//
// When expanded, all items are shown between the anchor and the top.

const RECENT_COUNT = 3;

export default function TimelineSection({
  items,
  dealName,
  dealCreatedAt,
  files = [],
  dealId,
}: {
  items: TimelineItem[];       // newest-first
  dealName: string;
  dealCreatedAt: string;
  /** All entity files — used to look up the EntityFile when opening the modal */
  files?: EntityFile[];
  /** Deal ID — needed to fetch facts in the modal */
  dealId?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded]           = useState(false);
  const [modalFile, setModalFile]         = useState<EntityFile | null>(null);
  const [conflictItem, setConflictItem]   = useState<TimelineItem | null>(null);

  // Build a lookup map for fast file resolution
  const fileMap = new Map(files.map((f) => [f.id, f]));

  function handleItemClick(fileId: string) {
    const file = fileMap.get(fileId);
    if (file && dealId) setModalFile(file);
  }

  function handleConflictClick(item: TimelineItem) {
    setConflictItem(item);
  }

  function handleConflictResolved() {
    setConflictItem(null);
    startTransition(() => router.refresh());
  }

  // items is newest-first; we show the first RECENT_COUNT at the top.
  // The "deal created" anchor is always at the bottom.
  const recentItems  = items.slice(0, RECENT_COUNT);
  const hiddenItems  = items.slice(RECENT_COUNT); // everything between recent and creation
  const hiddenCount  = hiddenItems.length;
  const hasGap       = !expanded && hiddenCount > 0;

  // What to render between the top and the anchor
  const visibleItems = expanded ? items : recentItems;

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
          Activity
        </p>
        <div className="flex-1 h-px bg-slate-100" />
        {items.length > 0 && (
          <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
            {items.length + 1} {items.length + 1 === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      <div className="pl-0.5">
        {/* Recent events (newest first) */}
        {visibleItems.map((item, idx) => (
          <TimelineEntry
            key={item.id}
            item={item}
            hasTopConnector={idx > 0}
            hasBottomConnector={true}
            onFileClick={item.fileId ? handleItemClick : undefined}
            onConflictClick={item.conflictData ? handleConflictClick : undefined}
          />
        ))}

        {/* Gap indicator — shown when collapsed and there are hidden events */}
        {hasGap && (
          <GapIndicator
            hiddenCount={hiddenCount}
            onExpand={() => setExpanded(true)}
          />
        )}

        {/* Collapse link — shown when expanded and there were hidden events */}
        {expanded && hiddenCount > 0 && (
          <div className="flex gap-0">
            <div
              className="flex flex-col items-center"
              style={{ width: SPINE_COL_W, minWidth: SPINE_COL_W }}
            >
              <div style={{ width: SPINE_W, height: 8, background: SPINE_COLOR }} />
              <div style={{ width: SPINE_W, height: 8, background: SPINE_COLOR }} />
            </div>
            <div className="flex-1 min-w-0 pl-3 flex items-center pb-1">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors"
              >
                Show less
              </button>
            </div>
          </div>
        )}

        {/* Deal created anchor — always at the bottom */}
        <CreatedEntry
          dealName={dealName}
          createdAt={dealCreatedAt}
          hasTopConnector={visibleItems.length > 0 || hasGap}
        />
      </div>

      {/* File detail modal — opened when a file-linked timeline item is clicked */}
      {modalFile && dealId && (
        <FileDetailModal
          file={modalFile}
          dealId={dealId}
          onClose={() => setModalFile(null)}
        />
      )}

      {/* Conflict resolution modal — opened when a conflict timeline item is clicked */}
      {conflictItem?.conflictData && dealId && (
        <ConflictResolutionModal
          dealId={dealId}
          conflict={conflictItem.conflictData}
          onClose={() => setConflictItem(null)}
          onResolved={handleConflictResolved}
        />
      )}
    </div>
  );
}
