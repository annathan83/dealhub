"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

// ─── Source type helpers ──────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  pasted_text:     "Note",
  uploaded_file:   "File",
  uploaded_image:  "Image",
  webcam_photo:    "Photo",
  audio_recording: "Audio",
  manual:          "File",
};

function sourceLabel(t: string | null) {
  return SOURCE_LABELS[t ?? ""] ?? "File";
}

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

// ─── File type icon ───────────────────────────────────────────────────────────

function FileTypeIcon({ sourceType, mimeType, fileName }: { sourceType: string | null; mimeType: string | null; fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType ?? "";

  if (sourceType === "pasted_text") {
    return (
      <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </span>
    );
  }
  if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) {
    return (
      <span className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
        </svg>
      </span>
    );
  }
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) {
    return (
      <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </span>
    );
  }
  if (ext === "pdf") {
    return (
      <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </span>
    );
  }
  if (["xls","xlsx","csv"].includes(ext)) {
    return (
      <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </span>
  );
}

// ─── Paste text panel ─────────────────────────────────────────────────────────

function PasteTextPanel({ dealId, onDone }: { dealId: string; onDone: () => void }) {
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
    <div className="border-t border-slate-100 px-4 pt-3 pb-4 bg-slate-50/50">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        <textarea
          rows={5}
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
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            style={{ minHeight: 44 }}
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Saving…
              </>
            ) : "Analyze & Save"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            style={{ minHeight: 44 }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Input file row ───────────────────────────────────────────────────────────

function InputRow({ file, dealId }: { file: EntityFile; dealId: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isText = file.source_type === "pasted_text" || file.metadata_json?.is_text_entry === true;

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/deals/${dealId}/entries/${file.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-slate-50/80 transition-colors group">
      <FileTypeIcon sourceType={file.source_type} mimeType={file.mime_type} fileName={file.file_name} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate leading-tight">
          {file.title ?? file.file_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400">{sourceLabel(file.source_type)}</span>
          <span className="text-[11px] text-slate-300">·</span>
          <span className="text-[11px] text-slate-400">{formatRelativeTime(file.uploaded_at)}</span>
          {file.summary && (
            <>
              <span className="text-[11px] text-slate-300">·</span>
              <span className="text-[11px] text-emerald-600 font-medium">Processed</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.web_view_link && (
          <a
            href={file.web_view_link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Open in Drive"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        {isText && (
          !confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? "…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded-lg text-[11px] text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Keep
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  dealId: string;
  isDriveConnected: boolean;
  files: EntityFile[];
};

export default function IntakeSection({ dealId, isDriveConnected, files }: Props) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showPaste, setShowPaste] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [uploading, setUploading] = useState<"camera" | "audio" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isDriveConnected) return;
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files, "file");
  }, [isDriveConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isDriveConnected) setIsDragOver(true);
  }, [isDriveConnected]);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // Stats
  const totalFiles = files.length;
  const processedFiles = files.filter((f) => f.summary || f.metadata_json?.is_text_entry).length;

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        isDragOver ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-100"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* ── Add input actions ──────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">

        {/* Error banner */}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-red-600 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {!isDriveConnected ? (
          /* Drive not connected */
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Connect Google Drive</p>
              <p className="text-xs text-slate-500 mt-0.5">Required to upload files, photos, and audio.</p>
            </div>
            <Link
              href="/settings/integrations"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Connect
            </Link>
          </div>
        ) : (
          /* Action buttons — horizontal row */
          <div className="flex items-center gap-2">
            {/* Paste Text */}
            <button
              type="button"
              onClick={() => setShowPaste((v) => !v)}
              disabled={!!uploading}
              className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all active:scale-[0.97] disabled:opacity-40 ${
                showPaste
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-[11px] font-semibold leading-tight">Paste Text</span>
            </button>

            {/* Photo */}
            <button
              type="button"
              onClick={isMobile ? () => cameraInputRef.current?.click() : () => setShowWebcam(true)}
              disabled={!!uploading && uploading !== "camera"}
              className="flex-1 flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-slate-700 hover:border-amber-200 hover:bg-amber-50/40 active:scale-[0.97] transition-all disabled:opacity-40 relative"
            >
              {isMobile && (
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => uploadFiles(e.target.files, "camera")}
                  disabled={!!uploading}
                />
              )}
              {uploading === "camera" ? (
                <svg className="w-5 h-5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span className="text-[11px] font-semibold leading-tight">
                {uploading === "camera" ? "Uploading…" : "Photo"}
              </span>
            </button>

            {/* Audio */}
            <button
              type="button"
              onClick={() => setShowAudio(true)}
              disabled={!!uploading && uploading !== "audio"}
              className="flex-1 flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center text-slate-700 hover:border-violet-200 hover:bg-violet-50/40 active:scale-[0.97] transition-all disabled:opacity-40"
            >
              {uploading === "audio" ? (
                <svg className="w-5 h-5 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
                </svg>
              )}
              <span className="text-[11px] font-semibold leading-tight">
                {uploading === "audio" ? "Uploading…" : "Audio"}
              </span>
            </button>

            {/* Upload File */}
            <div className="flex-1 relative">
              <input
                ref={uploadInputRef}
                type="file"
                accept={ALL_ACCEPT}
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => uploadFiles(e.target.files, "file")}
                disabled={!!uploading}
              />
              <div className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-slate-700 transition-all ${
                uploading === "file"
                  ? "border-emerald-200 bg-emerald-50/40 opacity-70"
                  : "border-dashed border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
              }`}>
                {uploading === "file" ? (
                  <svg className="w-5 h-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                <span className="text-[11px] font-semibold leading-tight">
                  {uploading === "file" ? "Uploading…" : "Upload"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Drag-over hint */}
        {isDragOver && (
          <p className="mt-2 text-center text-xs font-medium text-indigo-600 animate-pulse">Drop to upload…</p>
        )}
      </div>

      {/* ── Paste text panel (expandable) ─────────────────────────────────── */}
      {showPaste && (
        <PasteTextPanel dealId={dealId} onDone={() => setShowPaste(false)} />
      )}

      {/* ── Inputs list ───────────────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="border-t border-slate-100">
          {/* Summary row */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {totalFiles} input{totalFiles !== 1 ? "s" : ""}
            </p>
            {processedFiles > 0 && (
              <span className="text-[11px] text-emerald-600 font-medium">
                {processedFiles} processed
              </span>
            )}
          </div>

          {/* File rows */}
          <div className="divide-y divide-slate-50">
            {files.map((file) => (
              <InputRow key={file.id} file={file} dealId={dealId} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no files yet */}
      {files.length === 0 && isDriveConnected && !showPaste && (
        <div className="border-t border-slate-100 px-4 py-6 text-center">
          <p className="text-sm text-slate-400">No inputs yet.</p>
          <p className="text-xs text-slate-400 mt-1">Upload a file, paste text, or record audio to get started.</p>
        </div>
      )}

      {/* Modals */}
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
    </div>
  );
}
