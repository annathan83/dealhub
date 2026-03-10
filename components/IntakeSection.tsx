"use client";

/**
 * IntakeSection — file workspace pane
 *
 * Renders the explorer-style file list for a deal. Upload actions have been
 * moved to QuickAddBar which sits above the tab bar so they are always visible.
 */

import { useState } from "react";
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

/** Clean display name: strip extension for non-notes, use AI title when available */
function getDisplayName(file: EntityFile, kind: FileKind): string {
  // For notes/pasted text prefer the AI-generated title
  if (kind === "note") {
    if (file.title && !file.title.toLowerCase().startsWith("note")) return file.title;
    return "Note";
  }
  // Use AI title if meaningfully different from raw filename
  if (file.title) {
    const raw = file.file_name.replace(/\.[^.]+$/, "").trim().toLowerCase();
    const title = file.title.trim().toLowerCase();
    if (title !== raw && title.length > 2) return file.title.trim();
  }
  // Strip extension from filename for clean display
  return file.file_name.replace(/\.[^.]+$/, "");
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

// ─── Explorer file row ────────────────────────────────────────────────────────

function ExplorerRow({ file, onClick }: { file: EntityFile; onClick: () => void }) {
  const kind = getFileKind(file);
  const displayName = getDisplayName(file, kind);
  const timeAgo = formatRelativeTime(file.uploaded_at);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F3F4F6] active:bg-[#E5E7EB] transition-colors text-left group"
    >
      <FileTypeIcon kind={kind} />
      <span className="flex-1 min-w-0 text-sm text-[#1E1E1E] truncate group-hover:text-[#1F7A63] transition-colors">
        {displayName}
        <span className="text-[#6B7280] font-normal"> · {timeAgo}</span>
      </span>
      <svg
        className="w-3.5 h-3.5 text-[#E5E7EB] group-hover:text-[#1F7A63] transition-colors shrink-0"
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
}: Props) {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<EntityFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
              className="text-xs font-semibold text-[#1E1E1E] hover:text-[#1F7A63] transition-colors flex-1 truncate flex items-center gap-1 min-w-0 group/folder"
              title="Open in Google Drive"
            >
              <span className="truncate">{dealName}</span>
              <svg className="w-3 h-3 shrink-0 text-[#6B7280] group-hover/folder:text-[#1F7A63] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-xs font-semibold text-[#1E1E1E] flex-1 truncate">{dealName}</span>
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
            <div className="divide-y divide-[#F3F4F6]">
              {visibleFiles.map((file) => (
                <ExplorerRow
                  key={file.id}
                  file={file}
                  onClick={() => setSelectedFile(file)}
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
          <div className={`px-4 py-8 text-center ${isDragOver ? "bg-[#F0FAF7]" : ""}`}>
            <svg className="w-8 h-8 text-[#E5E7EB] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm font-medium text-[#6B7280] mb-1">
              {isDragOver ? "Drop to upload" : "No files yet"}
            </p>
            <p className="text-xs text-[#9CA3AF]">
              {isDragOver ? "Release to add files." : "Use the buttons above to upload files, add notes, or record audio."}
            </p>
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
