"use client";

/**
 * QuickAddBar
 *
 * The four tinted action buttons (Upload / Note / Photo / Audio) that appear
 * above the tab bar on the deal detail page so they are always reachable
 * regardless of which tab is active.
 *
 * All upload state, modals, and file-input refs live here so this component
 * is fully self-contained. IntakeSection's file workspace pane no longer
 * renders these buttons — it only renders the file list.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import WebcamCaptureModal from "./WebcamCaptureModal";
import AudioRecordModal from "./AudioRecordModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 100 * 1024 * 1024;
const ALL_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac";
const ALLOWED_EXTENSIONS = new Set([
  ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".aac",
]);

function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) return `"${file.name}" exceeds 100 MB.`;
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return `"${file.name}" is not a supported type.`;
  return null;
}

// ─── Button palette ───────────────────────────────────────────────────────────

type ActionVariant = "upload" | "note" | "photo" | "audio";

const ACTION_STYLES: Record<
  ActionVariant,
  { bg: string; border: string; text: string; hover: string }
> = {
  upload: {
    bg: "bg-[#EEF4FF]",
    border: "border-[#C7D9FF]",
    text: "text-[#3B6FE8]",
    hover: "hover:bg-[#E2ECFF] hover:border-[#A8C4FF]",
  },
  note: {
    bg: "bg-[#F4EEFF]",
    border: "border-[#D9C7FF]",
    text: "text-[#7C3AED]",
    hover: "hover:bg-[#EDE4FF] hover:border-[#C4A8FF]",
  },
  photo: {
    bg: "bg-[#EEF9F0]",
    border: "border-[#C2E8C8]",
    text: "text-[#2D8A45]",
    hover: "hover:bg-[#E2F5E5] hover:border-[#A3D9AC]",
  },
  audio: {
    bg: "bg-[#FFF4E8]",
    border: "border-[#FFD9A8]",
    text: "text-[#C2620A]",
    hover: "hover:bg-[#FFEDD6] hover:border-[#FFC47A]",
  },
};

function ActionButton({
  label,
  iconPath,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  iconPath: string;
  onClick: () => void;
  disabled?: boolean;
  variant: ActionVariant;
}) {
  const s = ACTION_STYLES[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors disabled:opacity-40 flex-1 min-w-0 ${s.bg} ${s.border} ${s.text} ${s.hover}`}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <span className="leading-none">{label}</span>
    </button>
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
        const d = (await res.json().catch(() => ({}))) as { error?: string };
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
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 pt-3 pb-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">Add note or paste text</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
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
              ) : (
                "Save & Analyze"
              )}
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
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuickAddBar({ dealId }: { dealId: string }) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [showNote, setShowNote] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [uploading, setUploading] = useState<"camera" | "audio" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  async function uploadFiles(
    fileList: FileList | File[] | null,
    source: "camera" | "audio" | "file"
  ) {
    const list = fileList ? Array.from(fileList) : [];
    if (!list.length) return;
    setError(null);
    setUploading(source);
    for (const f of list) {
      const err = validateFile(f);
      if (err) {
        setError(err);
        setUploading(null);
        return;
      }
    }
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      form.append("captureSource", source);
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
    } finally {
      setUploading(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files, "file");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealId]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

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

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div
        className="flex gap-2"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <ActionButton
          label={uploading === "file" ? "Uploading…" : "Upload"}
          iconPath="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          onClick={() => uploadInputRef.current?.click()}
          disabled={!!uploading}
          variant="upload"
        />
        <ActionButton
          label="Note"
          iconPath="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          onClick={() => setShowNote((v) => !v)}
          disabled={!!uploading}
          variant="note"
        />
        <ActionButton
          label="Photo"
          iconPath="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          onClick={() => (isMobile ? cameraInputRef.current?.click() : setShowWebcam(true))}
          disabled={!!uploading}
          variant="photo"
        />
        <ActionButton
          label="Audio"
          iconPath="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z"
          onClick={() => setShowAudio(true)}
          disabled={!!uploading}
          variant="audio"
        />
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 mt-2">
          <svg
            className="w-3.5 h-3.5 text-red-500 shrink-0 mt-px"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-red-600 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Note panel ─────────────────────────────────────────────────────── */}
      {showNote && (
        <div className="mt-2">
          <AddNotePanel dealId={dealId} onDone={() => setShowNote(false)} />
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showWebcam && (
        <WebcamCaptureModal
          onCapture={(fileList) => {
            if (fileList.length > 0) uploadFiles(fileList, "camera");
          }}
          onClose={() => setShowWebcam(false)}
          onError={(msg) => {
            setShowWebcam(false);
            setError(msg ?? "Camera access denied.");
          }}
        />
      )}
      {showAudio && (
        <AudioRecordModal
          onCapture={(file) => uploadFiles([file], "audio")}
          onClose={() => setShowAudio(false)}
          onError={(msg) => {
            setShowAudio(false);
            setError(msg ?? "Microphone access denied.");
          }}
        />
      )}
    </>
  );
}
