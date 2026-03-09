"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EntityFile } from "@/types/entity";
import WebcamCaptureModal from "./WebcamCaptureModal";
import AudioRecordModal from "./AudioRecordModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 100 * 1024 * 1024;
const ALL_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac";
const ALLOWED_EXTENSIONS = new Set([
  ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".aac",
]);

function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) return "File exceeds 100 MB.";
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return `"${file.name}" is not a supported type.`;
  return null;
}

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type FileKind = "note" | "audio" | "image" | "pdf" | "spreadsheet" | "doc" | "file";

function getFileKind(file: EntityFile): FileKind {
  const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.mime_type ?? "";
  if (file.source_type === "pasted_text" || file.metadata_json?.is_text_entry) return "note";
  if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) return "audio";
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls","xlsx","csv"].includes(ext)) return "spreadsheet";
  if (["doc","docx"].includes(ext)) return "doc";
  return "file";
}

function getKindLabel(kind: FileKind): string {
  return { note: "Note", audio: "Audio", image: "Image", pdf: "PDF", spreadsheet: "Spreadsheet", doc: "Document", file: "File" }[kind];
}

// ─── File kind icon ───────────────────────────────────────────────────────────

type IconConfig = { color: string; path: string };

const KIND_ICON_CONFIGS: Record<FileKind, IconConfig> = {
  note:        { color: "text-slate-400",   path: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
  audio:       { color: "text-violet-400",  path: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" },
  image:       { color: "text-amber-400",   path: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  pdf:         { color: "text-red-400",     path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  spreadsheet: { color: "text-emerald-500", path: "M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" },
  doc:         { color: "text-blue-400",    path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  file:        { color: "text-slate-400",   path: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
};

function FileTypeIcon({ kind }: { kind: FileKind }) {
  const { color, path } = KIND_ICON_CONFIGS[kind];
  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ file }: { file: EntityFile }) {
  const hasText = !!file.summary;
  const isNote = file.source_type === "pasted_text" || file.metadata_json?.is_text_entry;
  if (isNote || hasText) {
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Processed" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" title="Processing" />;
}

// ─── File detail modal ────────────────────────────────────────────────────────

function FileDetailModal({
  file,
  dealId,
  onClose,
  onDeleted,
}: {
  file: EntityFile;
  dealId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const kind = getFileKind(file);
  const isNote = kind === "note";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/deals/${dealId}/entries/${file.id}`, { method: "DELETE" });
    onDeleted();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            <FileTypeIcon kind={kind} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight break-all">
              {file.title ?? file.file_name}
            </p>
            {file.title && file.title !== file.file_name && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{file.file_name}</p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
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
        </div>

        {/* Footer */}
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

// ─── Add note panel ───────────────────────────────────────────────────────────

function AddNotePanel({ dealId, onDone }: { dealId: string; onDone: () => void }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "Failed to save.");
      }
      setContent("");
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 pt-3 pb-4">
      <p className="text-xs font-semibold text-slate-500 mb-2">Add note or paste text</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        <textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste a listing, broker email, financial summary, or your own notes…"
          disabled={loading}
          autoFocus
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none disabled:opacity-60"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Saving…
              </>
            ) : "Save & Analyze"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Explorer file row ────────────────────────────────────────────────────────

function ExplorerRow({ file, onClick }: { file: EntityFile; onClick: () => void }) {
  const kind = getFileKind(file);
  const displayName = file.title ?? file.file_name;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50/60 active:bg-indigo-100/60 transition-colors text-left group"
    >
      {/* Status dot — leftmost, very subtle */}
      <StatusDot file={file} />

      {/* File type icon */}
      <FileTypeIcon kind={kind} />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 truncate leading-tight font-medium group-hover:text-indigo-700 transition-colors">
          {displayName}
        </p>
        <p className="text-[10px] text-slate-400 truncate mt-px">
          {getKindLabel(kind)}
          {file.file_size_bytes ? ` · ${formatFileSize(file.file_size_bytes)}` : ""}
        </p>
      </div>

      {/* Timestamp */}
      <span className="text-[11px] text-slate-400 shrink-0 tabular-nums whitespace-nowrap">
        {formatRelativeTime(file.uploaded_at)}
      </span>

      {/* Chevron */}
      <svg
        className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ─── Action button (large, tappable) ─────────────────────────────────────────

function ActionButton({
  label,
  iconPath,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  iconPath: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors disabled:opacity-40 flex-1 min-w-0 ${
        accent
          ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <span className="leading-none">{label}</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  dealId: string;
  isDriveConnected: boolean;
  files: EntityFile[];
  triageSummaryExists?: boolean;
  newFilesAfterTriage?: boolean;
};

export default function IntakeSection({
  dealId,
  isDriveConnected,
  files,
  triageSummaryExists = false,
  newFilesAfterTriage = false,
}: Props) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showNote, setShowNote] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [uploading, setUploading] = useState<"camera" | "audio" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<EntityFile | null>(null);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  async function uploadFiles(fileList: FileList | File[] | null, source: "camera" | "audio" | "file") {
    const list = fileList ? Array.from(fileList) : [];
    if (!list.length) return;
    setError(null);
    setUploading(source);
    for (const f of list) {
      const err = validateFile(f);
      if (err) { setError(err); setUploading(null); return; }
    }
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      form.append("captureSource", source);
      const res = await fetch(`/api/deals/${dealId}/files`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({})) as { error?: string; results?: { success: boolean; error?: string }[] };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const failed = (data.results ?? []).find((r) => !r.success);
      if (failed) throw new Error(failed.error ?? "Upload failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files, "file");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const totalFiles = files.length;
  const processedCount = files.filter(
    (f) => !!f.summary || f.source_type === "pasted_text" || f.metadata_json?.is_text_entry
  ).length;
  const pendingCount = totalFiles - processedCount;

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept={ALL_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files, "file")}
        disabled={!!uploading}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files, "camera")}
        disabled={!!uploading}
      />

      {/* ── Zone 1: Large action buttons ──────────────────────────────────────── */}
      <div className="flex gap-2 mb-3">
        <ActionButton
          label={uploading === "file" ? "Uploading…" : "Upload"}
          iconPath="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          onClick={() => uploadInputRef.current?.click()}
          disabled={!!uploading}
          accent
        />
        <ActionButton
          label="Note"
          iconPath="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          onClick={() => setShowNote((v) => !v)}
          disabled={!!uploading}
        />
        <ActionButton
          label="Photo"
          iconPath="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          onClick={() => isMobile ? cameraInputRef.current?.click() : setShowWebcam(true)}
          disabled={!!uploading}
        />
        <ActionButton
          label="Audio"
          iconPath="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z"
          onClick={() => setShowAudio(true)}
          disabled={!!uploading}
        />
      </div>

      {/* ── Zone 2: File workspace pane ────────────────────────────────────────── */}
      <div
        className={`rounded-xl border overflow-hidden transition-all ${
          isDragOver
            ? "border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50/30"
            : "border-slate-200 bg-white"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Pane toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          {/* Folder icon */}
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-[11px] font-semibold text-slate-500 flex-1">Deal Folder</span>
          {/* Stats */}
          {totalFiles > 0 && (
            <span className="text-[11px] text-slate-400">
              {totalFiles} {totalFiles === 1 ? "file" : "files"}
              {processedCount > 0 && ` · ${processedCount} processed`}
              {pendingCount > 0 && ` · ${pendingCount} pending`}
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

        {/* Add note panel */}
        {showNote && (
          <AddNotePanel dealId={dealId} onDone={() => setShowNote(false)} />
        )}

        {/* File list */}
        {files.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {files.map((file) => (
              <ExplorerRow
                key={file.id}
                file={file}
                onClick={() => setSelectedFile(file)}
              />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className={`px-4 py-7 text-center ${isDragOver ? "bg-indigo-50/40" : ""}`}>
            <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm font-medium text-slate-500 mb-1">
              {isDragOver ? "Drop to upload" : "No files yet"}
            </p>
            <p className="text-xs text-slate-400">
              {isDragOver ? "Release to add files to this deal." : "Use the buttons above to upload files, add notes, or record audio."}
            </p>
          </div>
        )}

        {/* Triage status footer */}
        {files.length > 0 && newFilesAfterTriage && (
          <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 flex items-center gap-2">
            <svg className="w-3 h-3 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-[11px] text-amber-700">New files added since last review — Initial Review may be outdated.</p>
          </div>
        )}
        {files.length > 0 && !triageSummaryExists && !newFilesAfterTriage && processedCount > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 flex items-center gap-2">
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[11px] text-slate-500">Files processed — Initial Review will generate automatically.</p>
          </div>
        )}

        {/* Drag-over overlay */}
        {isDragOver && files.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl">
            <p className="text-sm font-semibold text-indigo-600 bg-white/90 rounded-xl px-4 py-2 shadow-sm animate-pulse">Drop to upload…</p>
          </div>
        )}
      </div>

      {/* File detail modal */}
      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          dealId={dealId}
          onClose={() => setSelectedFile(null)}
          onDeleted={() => { setSelectedFile(null); router.refresh(); }}
        />
      )}

      {/* Camera / audio modals */}
      {showWebcam && (
        <WebcamCaptureModal
          onCapture={(fileList) => { if (fileList.length > 0) uploadFiles(fileList, "camera"); }}
          onClose={() => setShowWebcam(false)}
          onError={(msg) => { setShowWebcam(false); setError(msg ?? "Camera access denied."); }}
        />
      )}
      {showAudio && (
        <AudioRecordModal
          onCapture={(file) => uploadFiles([file], "audio")}
          onClose={() => setShowAudio(false)}
          onError={(msg) => { setShowAudio(false); setError(msg ?? "Microphone access denied."); }}
        />
      )}
    </>
  );
}
