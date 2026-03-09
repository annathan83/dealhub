"use client";

import { useEffect, useState } from "react";
import type { EntityFile } from "@/types/entity";

// ─── Helpers (duplicated from IntakeSection to keep this component self-contained) ──

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins  = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days  = Math.floor(diffMs / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type FileKind = "note" | "audio" | "image" | "pdf" | "spreadsheet" | "doc" | "file";

function getFileKind(file: EntityFile): FileKind {
  const ext  = file.file_name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.mime_type ?? "";
  if (file.source_type === "pasted_text" || file.metadata_json?.is_text_entry) return "note";
  if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) return "audio";
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext))       return "image";
  if (ext === "pdf")                                                                        return "pdf";
  if (["xls","xlsx","csv"].includes(ext))                                                  return "spreadsheet";
  if (["doc","docx"].includes(ext))                                                        return "doc";
  return "file";
}

function getKindLabel(kind: FileKind): string {
  return { note: "Note", audio: "Audio", image: "Image", pdf: "PDF", spreadsheet: "Spreadsheet", doc: "Document", file: "File" }[kind];
}

// ─── File type icon ───────────────────────────────────────────────────────────

const KIND_ICON: Record<FileKind, { color: string; path: string }> = {
  note:        { color: "text-slate-400",   path: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  audio:       { color: "text-violet-400",  path: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" },
  image:       { color: "text-amber-400",   path: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  pdf:         { color: "text-red-400",     path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  spreadsheet: { color: "text-emerald-500", path: "M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" },
  doc:         { color: "text-blue-400",    path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  file:        { color: "text-slate-400",   path: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
};

function FileTypeIcon({ kind, size = "md" }: { kind: FileKind; size?: "sm" | "md" }) {
  const { color, path } = KIND_ICON[kind];
  return (
    <svg
      className={`shrink-0 ${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} ${color}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// ─── Fact row types ───────────────────────────────────────────────────────────

type FileFact = {
  evidence_id: string;
  fact_definition_id: string;
  label: string;
  category: string | null;
  fact_scope: string;
  display_order: number;
  value: string | null;
  confidence: number | null;
  snippet: string | null;
  page_number: number | null;
  is_primary: boolean;
  evidence_type: string;
};

// ─── Confidence pill ──────────────────────────────────────────────────────────

function ConfidencePill({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-emerald-50 text-emerald-700" :
    pct >= 50 ? "bg-amber-50 text-amber-700" :
                "bg-slate-100 text-slate-500";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${color}`}>
      {pct}%
    </span>
  );
}

// ─── Facts section ────────────────────────────────────────────────────────────

function FactsSection({ dealId, fileId }: { dealId: string; fileId: string }) {
  const [facts, setFacts]     = useState<FileFact[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/deals/${dealId}/files/${fileId}`)
      .then((r) => r.json())
      .then((d: { facts?: FileFact[] }) => setFacts(d.facts ?? []))
      .catch(() => setFacts([]))
      .finally(() => setLoading(false));
  }, [dealId, fileId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <svg className="w-3.5 h-3.5 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
        <span className="text-xs text-slate-400">Loading extracted facts…</span>
      </div>
    );
  }

  if (!facts || facts.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-1">
        No facts extracted from this file yet.
      </p>
    );
  }

  // Group by category for cleaner display
  const grouped = facts.reduce<Record<string, FileFact[]>>((acc, f) => {
    const cat = f.category ?? "Other";
    (acc[cat] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {cat}
          </p>
          <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
            {items.map((fact) => (
              <div key={fact.evidence_id} className="px-3 py-2.5 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 leading-none mb-1">
                    {fact.label}
                  </p>
                  <p className="text-sm text-slate-800 leading-snug font-medium break-words">
                    {fact.value ?? <span className="text-slate-400 font-normal italic">—</span>}
                  </p>
                  {fact.snippet && (
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2 italic">
                      &ldquo;{fact.snippet}&rdquo;
                      {fact.page_number != null && (
                        <span className="not-italic ml-1 text-slate-300">p.{fact.page_number}</span>
                      )}
                    </p>
                  )}
                </div>
                <ConfidencePill value={fact.confidence} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export type FileDetailModalProps = {
  file: EntityFile;
  dealId: string;
  onClose: () => void;
  onDeleted?: () => void;
};

export default function FileDetailModal({
  file,
  dealId,
  onClose,
  onDeleted,
}: FileDetailModalProps) {
  const kind   = getFileKind(file);
  const isNote = kind === "note";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [activeTab, setActiveTab]         = useState<"details" | "facts">("details");

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/deals/${dealId}/entries/${file.id}`, { method: "DELETE" });
    onDeleted?.();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            <FileTypeIcon kind={kind} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight break-all">
              {file.file_name}
            </p>
            {file.title && file.title !== file.file_name && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{file.title}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 px-5">
          {(["details", "facts"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-1 mr-5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab === "details" ? "Details" : "Extracted Facts"}
            </button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {activeTab === "details" && (
            <>
              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Type</p>
                  <p className="text-sm text-slate-700">{getKindLabel(kind)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Added</p>
                  <p className="text-sm text-slate-700">{formatRelativeTime(file.uploaded_at)}</p>
                </div>
                {file.file_size_bytes && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Size</p>
                    <p className="text-sm text-slate-700">{formatFileSize(file.file_size_bytes)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
                  <p className="text-sm text-slate-700">
                    {(file.source_type === "pasted_text" || file.metadata_json?.is_text_entry || file.summary)
                      ? "Processed"
                      : "Processing"}
                  </p>
                </div>
              </div>

              {/* Summary / content */}
              {file.summary && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {kind === "audio" ? "Transcript preview" : kind === "note" ? "Content" : "AI summary"}
                  </p>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-10">
                      {file.summary}
                    </p>
                  </div>
                </div>
              )}

              {!file.summary && !isNote && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700">
                    This file is still being processed. Extracted text and AI analysis will appear here once complete.
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "facts" && (
            <FactsSection dealId={dealId} fileId={file.id} />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          {file.web_view_link && (
            <a
              href={file.web_view_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Drive
            </a>
          )}
          {isNote && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
          {isNote && confirmDelete && (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
