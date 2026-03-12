"use client";

/**
 * IntakeSection — file workspace pane
 *
 * Renders the explorer-style file list for a deal. Upload actions have been
 * moved to QuickAddBar which sits above the tab bar so they are always visible.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EntityFile } from "@/types/entity";
import FileDetailModal from "./FileDetailModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type FileKind = "note" | "audio" | "image" | "pdf" | "excel" | "word" | "file";

function getFileKind(file: EntityFile): FileKind {
  const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.mime_type ?? "";
  if (file.source_type === "pasted_text" || file.metadata_json?.is_text_entry || ext === "txt") return "note";
  if (mime.startsWith("audio/") || ["mp3", "m4a", "wav", "webm", "ogg", "aac"].includes(ext)) return "audio";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (["doc", "docx"].includes(ext)) return "word";
  return "file";
}

/** User-facing label — no technical extensions */
function getKindLabel(kind: FileKind): string {
  return {
    note:  "Note",
    audio: "Audio",
    image: "Photo",
    pdf:   "PDF",
    excel: "Excel",
    word:  "Word",
    file:  "File",
  }[kind];
}

/** Clean display name: always show actual filename (no extension), prefer AI title when meaningfully different */
function getDisplayName(file: EntityFile, kind: FileKind): string {
  // Base: strip extension from the raw filename
  const baseName = file.file_name.replace(/\.[^.]+$/, "").trim() || file.file_name;

  // Use AI-generated title only if it's meaningfully different from the raw filename
  if (file.title) {
    const rawLower = baseName.toLowerCase();
    const titleLower = file.title.trim().toLowerCase();
    if (titleLower !== rawLower && titleLower.length > 2 && !titleLower.startsWith("untitled")) {
      return file.title.trim();
    }
  }

  // For pasted text with no real filename, fall back to "Note"
  if (kind === "note" && (baseName === "" || baseName.toLowerCase() === "note" || baseName.match(/^[a-f0-9-]{8,}$/i))) {
    return "Note";
  }

  return baseName;
}

// ─── File kind icon ───────────────────────────────────────────────────────────

type IconConfig = { color: string; path: string };

const KIND_ICON_CONFIGS: Record<FileKind, IconConfig> = {
  note:  { color: "text-[#6B7280]",  path: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  audio: { color: "text-violet-500", path: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" },
  image: { color: "text-amber-500",  path: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  pdf:   { color: "text-red-500",    path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  excel: { color: "text-[#1F7A63]",  path: "M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" },
  word:  { color: "text-blue-500",   path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  file:  { color: "text-[#6B7280]",  path: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
};

function FileTypeIcon({ kind }: { kind: FileKind }) {
  const { color, path } = KIND_ICON_CONFIGS[kind];
  return (
    <svg
      className={`w-4 h-4 shrink-0 ${color}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// ─── NDA file badge ───────────────────────────────────────────────────────────

function NdaFileBadge({ variant }: { variant: "signed" | "review" }) {
  if (variant === "signed") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 whitespace-nowrap shrink-0">
        <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        NDA Signed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 whitespace-nowrap shrink-0">
      NDA Review
    </span>
  );
}

// ─── Explorer file row ────────────────────────────────────────────────────────

function ExplorerRow({
  file,
  onClick,
  ndaFileId,
  ndaConfidence,
}: {
  file: EntityFile;
  onClick: () => void;
  ndaFileId?: string | null;
  ndaConfidence?: number | null;
}) {
  const kind = getFileKind(file);
  const displayName = getDisplayName(file, kind);
  const timeAgo = formatRelativeTime(file.uploaded_at);

  // Determine if this file is the NDA milestone file
  const isNdaFile = ndaFileId === file.id;
  const ndaBadgeVariant: "signed" | "review" | null = isNdaFile
    ? ndaConfidence !== null && ndaConfidence !== undefined && ndaConfidence < 0.7
      ? "review"
      : "signed"
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="workspace-file-row"
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 active:bg-[#E5E7EB] transition-colors text-left group"
    >
      <div className="shrink-0 w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
        <FileTypeIcon kind={kind} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-[#1E1E1E] truncate group-hover:text-[#1F7A63] transition-colors leading-snug">
            {displayName}
          </p>
          {ndaBadgeVariant && <NdaFileBadge variant={ndaBadgeVariant} />}
        </div>
        <p className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">{getKindLabel(kind)} · {timeAgo}</p>
      </div>
      <svg
        className="w-3.5 h-3.5 text-[#D1D5DB] group-hover:text-[#1F7A63] transition-colors shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  dealId: string;
  dealName: string;
  driveFolderId: string | null;
  /** Kept for API compatibility — upload logic lives in QuickAddBar */
  isDriveConnected?: boolean;
  files: EntityFile[];
  triageSummaryExists?: boolean;
  newFilesAfterTriage?: boolean;
  /** ID of the entity_file that triggered the NDA milestone (if any) */
  ndaFileId?: string | null;
  /** Confidence score for the NDA detection (to distinguish signed vs review) */
  ndaFileConfidence?: number | null;
  /** Called when user clicks Upload in the empty-state checklist (opens file picker) */
  onRequestUpload?: () => void;
  /** Called when user clicks Note in the empty-state checklist (opens note panel) */
  onRequestNote?: () => void;
  /** When set (e.g. from Facts "View source"), open this file in the detail modal and clear after */
  highlightFileId?: string | null;
  /** Called after the highlighted file has been selected so parent can clear highlightFileId */
  onHighlightConsumed?: () => void;
};

// ─── Main component ───────────────────────────────────────────────────────────

const INITIAL_SHOW = 5;

export default function IntakeSection({
  dealId,
  dealName,
  driveFolderId,
  files,
  triageSummaryExists = false,
  newFilesAfterTriage = false,
  ndaFileId = null,
  ndaFileConfidence = null,
  onRequestUpload,
  onRequestNote,
  highlightFileId = null,
  onHighlightConsumed,
}: Props) {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<EntityFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // When parent asks to highlight a file (e.g. "View source" from Facts), select it and open modal
  useEffect(() => {
    if (!highlightFileId || !files.length) return;
    const file = files.find((f) => f.id === highlightFileId);
    if (file) {
      setSelectedFile(file);
      const sorted = [...files].sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );
      if (sorted.indexOf(file) >= INITIAL_SHOW) setShowAll(true);
      onHighlightConsumed?.();
    }
  }, [highlightFileId, files]);

  const totalFiles = files.length;
  const processedCount = files.filter(
    (f) => !!f.summary || f.source_type === "pasted_text" || f.metadata_json?.is_text_entry
  ).length;
  const pendingCount = totalFiles - processedCount;

  // Sort newest first, then limit
  const sortedFiles = [...files].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
  const visibleFiles = showAll ? sortedFiles : sortedFiles.slice(0, INITIAL_SHOW);
  const hasMore = totalFiles > INITIAL_SHOW;

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const list = Array.from(e.dataTransfer.files);
    if (!list.length) return;
    setError(null);
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      form.append("captureSource", "file");
      const res = await fetch(`/api/deals/${dealId}/files`, { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: { success: boolean; error?: string }[];
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const failed = (data.results ?? []).find((r) => !r.success);
      if (failed) throw new Error(failed.error ?? "Upload failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  return (
    <>
      {/* ── File workspace pane ───────────────────────────────────────────── */}
      <div
        className={`rounded-xl border overflow-hidden transition-all ${
          isDragOver
            ? "border-[#1F7A63] ring-2 ring-[#C6E4DC] bg-[#F0FAF7]"
            : "border-[#E5E7EB] bg-white"
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
      >
        {/* Pane toolbar */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F8FAF9] border-b border-[#E5E7EB]">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>

          {driveFolderId ? (
            <a
              href={`https://drive.google.com/drive/folders/${driveFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-[#1E1E1E] hover:text-[#1F7A63] transition-colors flex-1 truncate flex items-center gap-1 min-w-0 group/folder"
              title="Open in Google Drive"
            >
              <span className="truncate">{dealName}</span>
              <svg className="w-3 h-3 shrink-0 text-[#6B7280] group-hover/folder:text-[#1F7A63] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-sm font-bold text-[#1E1E1E] flex-1 truncate">{dealName}</span>
          )}

          {totalFiles > 0 && (
            <span className="text-[11px] text-[#6B7280] tabular-nums shrink-0">
              {totalFiles} {totalFiles === 1 ? "file" : "files"}
              {pendingCount > 0 && <span className="text-amber-500"> · {pendingCount} processing</span>}
            </span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-3 py-2">
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-red-600 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* File list */}
        {totalFiles > 0 ? (
          <>
            <div className="divide-y divide-[#F3F4F6]" data-testid="workspace-file-list">
              {visibleFiles.map((file) => (
                <ExplorerRow
                  key={file.id}
                  file={file}
                  onClick={() => setSelectedFile(file)}
                  ndaFileId={ndaFileId}
                  ndaConfidence={ndaFileConfidence}
                />
              ))}
            </div>

            {/* Show more / count footer */}
            {hasMore && (
              <div className="border-t border-[#E5E7EB] px-3 py-2 flex items-center justify-between bg-[#F8FAF9]">
                <span className="text-[11px] text-[#6B7280]">
                  {showAll ? `All ${totalFiles} files` : `${visibleFiles.length} of ${totalFiles} files`}
                </span>
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[11px] font-medium text-[#1F7A63] hover:text-[#176B55] transition-colors"
                >
                  {showAll ? "Show less" : `Show all ${totalFiles}`}
                </button>
              </div>
            )}

            {/* Triage status footer */}
            {newFilesAfterTriage && (
              <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 flex items-center gap-2">
                <svg className="w-3 h-3 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[11px] text-amber-700">New files added since last review.</p>
              </div>
            )}
            {!triageSummaryExists && !newFilesAfterTriage && processedCount > 0 && (
              <div className="border-t border-[#E5E7EB] bg-[#F8FAF9] px-3 py-2 flex items-center gap-2">
                <svg className="w-3 h-3 text-[#6B7280] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-[#6B7280]">Files processed — Initial Review will generate automatically.</p>
              </div>
            )}
          </>
        ) : (
          <div className={`px-6 py-10 ${isDragOver ? "bg-[#F0FAF7]" : ""}`}>
            {isDragOver ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700 mb-1.5">Drop to upload</p>
                <p className="text-xs text-slate-400">Release to add files to this deal.</p>
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <p className="text-sm font-semibold text-slate-800 mb-4">Get the most out of this deal</p>
                <ul className="space-y-4">
                  <li className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">① Upload a document</span>
                      <button
                        type="button"
                        onClick={() => onRequestUpload?.()}
                        className="shrink-0 rounded-lg bg-[#1F7A63] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#176B55] transition-colors"
                      >
                        Upload
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">CIM, financials, or broker email</p>
                  </li>
                  <li className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">② Add a quick note</span>
                      <button
                        type="button"
                        onClick={() => onRequestNote?.()}
                        className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Note
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">Paste key details or follow-ups</p>
                  </li>
                  <li className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">③ Capture photo or audio</span>
                      <span className="text-xs text-slate-400 shrink-0">Photo · Audio</span>
                    </div>
                    <p className="text-xs text-slate-500">Use the buttons above to capture</p>
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* File detail modal */}
      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          dealId={dealId}
          onClose={() => setSelectedFile(null)}
          onDeleted={() => {
            setSelectedFile(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
