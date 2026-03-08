"use client";

import { useRef, useState } from "react";
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

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      const results = data.results ?? [];
      const failed = results.find((r) => !r.success);
      if (failed) {
        throw new Error(failed.error ?? "Upload failed.");
      }

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

  if (!isDriveConnected) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
          Add to Deal
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Capture or upload new information for this deal.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-xs text-slate-600">
            Connect Google Drive to capture photos, audio, or upload files.
          </p>
          <Link
            href="/settings/integrations"
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Connect
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-white px-4 py-4">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
        Add to Deal
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Capture or upload new information for this deal.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Add Note */}
        <button
          type="button"
          onClick={scrollToAddEntry}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-5 min-h-[88px] hover:bg-slate-100 hover:border-slate-200 transition-colors active:scale-[0.98]"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-200/80">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </span>
          <span className="text-xs font-medium text-slate-700">Add Note</span>
          <span className="text-[10px] text-slate-400">Paste text</span>
        </button>

        {/* Take Picture — opens webcam modal */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowWebcam(true)}
            disabled={!!uploading}
            className={`w-full flex flex-col items-center justify-center gap-2 rounded-lg border px-4 py-5 min-h-[88px] transition-all ${
              uploading === "camera"
                ? "border-indigo-200 bg-indigo-50"
                : "border-slate-100 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98]"
            }`}
          >
            {uploading === "camera" ? (
              <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            ) : (
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </span>
            )}
            <span className="text-xs font-medium text-slate-700">Take Picture</span>
            <span className="text-[10px] text-slate-400">Use webcam</span>
          </button>
        </div>

        {/* Record Audio — opens mic recording modal */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAudio(true)}
            disabled={!!uploading}
            className={`w-full flex flex-col items-center justify-center gap-2 rounded-lg border px-4 py-5 min-h-[88px] transition-all ${
              uploading === "audio"
                ? "border-indigo-200 bg-indigo-50"
                : "border-slate-100 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98]"
            }`}
          >
            {uploading === "audio" ? (
              <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            ) : (
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-100">
                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
                </svg>
              </span>
            )}
            <span className="text-xs font-medium text-slate-700">Record Audio</span>
            <span className="text-[10px] text-slate-400">Use mic</span>
          </button>
        </div>

        {/* Upload File */}
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
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border px-4 py-5 min-h-[88px] transition-all ${
              uploading === "file"
                ? "border-indigo-200 bg-indigo-50"
                : "border-slate-100 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98]"
            }`}
          >
            {uploading === "file" ? (
              <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            ) : (
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span>
            )}
            <span className="text-xs font-medium text-slate-700">Upload File</span>
            <span className="text-[10px] text-slate-400">From device</span>
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
