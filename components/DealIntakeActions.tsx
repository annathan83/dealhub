"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WebcamCaptureModal from "./WebcamCaptureModal";
import AudioRecordModal from "./AudioRecordModal";

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

function Spinner() {
  return (
    <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}

type Props = {
  dealId: string;
  isDriveConnected: boolean;
};

export default function DealIntakeActions({ dealId, isDriveConnected }: Props) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [showWebcam, setShowWebcam] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [uploading, setUploading] = useState<"camera" | "audio" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function scrollToAddEntry() {
    document.getElementById("add-entry")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function uploadFiles(files: FileList | File[] | null, source: "camera" | "audio" | "file") {
    const list = files ? Array.from(files) : [];
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

      const res = await fetch(`/api/deals/${dealId}/files`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({})) as { error?: string; results?: { success: boolean; error?: string }[] };

      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      const results = data.results ?? [];
      const failed = results.find((r) => !r.success);
      if (failed) throw new Error(failed.error ?? "Upload failed.");

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  function handleWebcamCapture(files: File[]) {
    if (files.length > 0) uploadFiles(files, "camera");
  }

  function handleAudioCapture(file: File) {
    uploadFiles([file], "audio");
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isDriveConnected) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFiles(files, "file");
  }, [isDriveConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isDriveConnected) setIsDragOver(true);
  }, [isDriveConnected]);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  if (!isDriveConnected) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-5 py-4 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 mb-0.5">Connect Google Drive</p>
            <p className="text-xs text-slate-500">Connect Google Drive to capture photos, record audio, and upload files to this deal.</p>
          </div>
          <Link
            href="/settings/integrations"
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Connect Drive
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm px-5 py-4 mb-5 transition-all ${isDragOver ? "border-indigo-300 bg-indigo-50/30 ring-2 ring-indigo-100" : "border-slate-100"}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Add Information</h3>
          <p className="text-xs text-slate-400 mt-0.5">Capture or upload new information for this deal</p>
        </div>
        {isDragOver && (
          <span className="text-xs font-medium text-indigo-600 animate-pulse">Drop to upload…</span>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Paste Text */}
        <button
          type="button"
          onClick={scrollToAddEntry}
          className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-5 min-h-[100px] hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm transition-all active:scale-[0.97]"
        >
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </span>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-700">Paste Text</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Notes & emails</p>
          </div>
        </button>

        {/* Take Photo */}
        <button
          type="button"
          onClick={() => setShowWebcam(true)}
          disabled={!!uploading}
          className={`group flex flex-col items-center justify-center gap-2.5 rounded-xl border px-3 py-5 min-h-[100px] transition-all active:scale-[0.97] ${
            uploading === "camera"
              ? "border-amber-200 bg-amber-50 cursor-wait"
              : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-sm"
          }`}
        >
          <span className={`flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${uploading === "camera" ? "bg-amber-100" : "bg-amber-50 group-hover:bg-amber-100"}`}>
            {uploading === "camera" ? <Spinner /> : (
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </span>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-700">{uploading === "camera" ? "Uploading…" : "Take Photo"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Webcam capture</p>
          </div>
        </button>

        {/* Record Audio */}
        <button
          type="button"
          onClick={() => setShowAudio(true)}
          disabled={!!uploading}
          className={`group flex flex-col items-center justify-center gap-2.5 rounded-xl border px-3 py-5 min-h-[100px] transition-all active:scale-[0.97] ${
            uploading === "audio"
              ? "border-violet-200 bg-violet-50 cursor-wait"
              : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-sm"
          }`}
        >
          <span className={`flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${uploading === "audio" ? "bg-violet-100" : "bg-violet-50 group-hover:bg-violet-100"}`}>
            {uploading === "audio" ? <Spinner /> : (
              <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
              </svg>
            )}
          </span>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-700">{uploading === "audio" ? "Uploading…" : "Record Audio"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Mic recording</p>
          </div>
        </button>

        {/* Upload File — drag-and-drop target */}
        <div className="relative">
          <input
            ref={uploadInputRef}
            type="file"
            accept={ALL_ACCEPT}
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(e) => uploadFiles(e.target.files, "file")}
            disabled={!!uploading}
          />
          <div
            className={`group flex flex-col items-center justify-center gap-2.5 rounded-xl border px-3 py-5 min-h-[100px] transition-all ${
              uploading === "file"
                ? "border-emerald-200 bg-emerald-50 cursor-wait"
                : isDragOver
                ? "border-indigo-300 bg-indigo-50"
                : "border-dashed border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-sm cursor-pointer"
            }`}
          >
            <span className={`flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${uploading === "file" ? "bg-emerald-100" : "bg-emerald-50 group-hover:bg-emerald-100"}`}>
              {uploading === "file" ? <Spinner /> : (
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
            </span>
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-700">{uploading === "file" ? "Uploading…" : "Upload File"}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Browse or drag & drop</p>
            </div>
          </div>
        </div>
      </div>

      {showWebcam && (
        <WebcamCaptureModal
          onCapture={handleWebcamCapture}
          onClose={() => setShowWebcam(false)}
          onError={() => {}}
        />
      )}

      {showAudio && (
        <AudioRecordModal
          onCapture={handleAudioCapture}
          onClose={() => setShowAudio(false)}
          onError={() => {}}
        />
      )}
    </div>
  );
}
