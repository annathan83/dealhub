"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp3", ".m4a", ".wav", ".webm", ".ogg", ".aac"];
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileColor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "text-red-500";
  if (ext === "doc" || ext === "docx") return "text-blue-600";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "text-green-600";
  return "text-slate-400";
}

function FileIcon({ name }: { name: string }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${getFileColor(name)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function validateClientFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) return `"${file.name}" exceeds 100 MB.`;
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext))
    return `"${file.name}" is not a supported type.`;
  return null;
}

type UploadResult = {
  fileName: string;
  success: boolean;
  error?: string;
};

type Props = {
  dealId: string;
  isDriveConnected: boolean;
};

export default function FileUploadForm({ dealId, isDriveConnected }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of arr) {
      const err = validateClientFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }
    if (errors.length) setGlobalError(errors.join(" "));
    else setGlobalError(null);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...valid.filter((f) => !existing.has(f.name + f.size))];
    });
    setResults(null);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults(null);
  }

  async function handleUpload() {
    if (!files.length) return;
    setGlobalError(null);
    setResults(null);
    setLoading(true);

    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);

      const res = await fetch(`/api/deals/${dealId}/files`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({})) as {
        results?: UploadResult[];
        error?: string;
      };

      if (!res.ok && !data.results) {
        setGlobalError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      const uploadResults: UploadResult[] = data.results ?? [];
      setResults(uploadResults);

      const anySuccess = uploadResults.some((r) => r.success);
      if (anySuccess) {
        setFiles((prev) => prev.filter((f) => {
          const r = uploadResults.find((r) => r.fileName === f.name);
          return r ? !r.success : true;
        }));
        router.refresh();
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!isDriveConnected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">
          Connect Google Drive to upload files to this deal.
        </p>
        <Link
          href={`/api/google/connect?returnTo=/deals/${dealId}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Connect Drive
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-6 cursor-pointer transition-colors ${
          isDragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-slate-100/60"
        }`}
      >
        <svg
          className={`w-6 h-6 transition-colors ${isDragging ? "text-indigo-400" : "text-slate-300"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">Drop files here</span> or{" "}
          <span className="text-indigo-600 underline underline-offset-2">browse</span>
        </p>
        <p className="text-xs text-slate-400">PDF · Word · Excel · TXT · CSV · Images · Audio — max 100 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="sr-only"
        />
      </div>

      {/* Selected files list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map((file, i) => {
            const result = results?.find((r) => r.fileName === file.name);
            return (
              <div
                key={`${file.name}-${i}`}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  result?.success
                    ? "border-green-100 bg-green-50"
                    : result?.error
                    ? "border-red-100 bg-red-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <FileIcon name={file.name} />
                <span className="flex-1 min-w-0 truncate font-medium text-slate-700">
                  {file.name}
                </span>
                <span className="text-slate-400 shrink-0">{formatBytes(file.size)}</span>
                {result?.success && (
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {result?.error && (
                  <span className="text-red-500 text-xs shrink-0">Failed</span>
                )}
                {!result && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    disabled={loading}
                    className="p-0.5 rounded text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-40"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Errors */}
      {globalError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {globalError}
        </p>
      )}

      {/* Partial failures */}
      {results?.some((r) => !r.success) && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {results.filter((r) => !r.success).map((r) => (
            <p key={r.fileName}>{r.fileName}: {r.error}</p>
          ))}
        </div>
      )}

      {/* Upload button */}
      {files.filter((f) => !results?.find((r) => r.fileName === f.name && r.success)).length > 0 && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={loading}
          className="self-start inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Uploading & analyzing…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload {files.filter((f) => !results?.find((r) => r.fileName === f.name && r.success)).length > 1
                ? `${files.filter((f) => !results?.find((r) => r.fileName === f.name && r.success)).length} files`
                : "file"}
            </>
          )}
        </button>
      )}
    </div>
  );
}
