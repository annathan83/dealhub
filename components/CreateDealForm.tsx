"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 100 * 1024 * 1024;
const ALL_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac";
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

function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "").toUpperCase();
  if (!s) return null;
  const multiplier = s.endsWith("M") ? 1_000_000 : s.endsWith("K") ? 1_000 : 1;
  const num = parseFloat(s.replace(/[MK]$/, ""));
  return isNaN(num) ? null : num * multiplier;
}

function computeMultiple(asking_price: string, sde: string): string | null {
  const price = parseMoney(asking_price);
  const sdeVal = parseMoney(sde);
  if (!price || !sdeVal || sdeVal === 0) return null;
  return `${(price / sdeVal).toFixed(1)}x`;
}

// ─── Staged file type ─────────────────────────────────────────────────────────

type StagedFile = {
  id: string;
  file: File;
  preview: string; // display name
};

function fileIcon(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type;
  if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) {
    return (
      <span className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
        </svg>
      </span>
    );
  }
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) {
    return (
      <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </span>
    );
  }
  if (ext === "pdf") {
    return (
      <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </span>
    );
  }
  if (["xls","xlsx","csv"].includes(ext)) {
    return (
      <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateDealForm() {
  const router = useRouter();

  // Deal fields
  const [name, setName] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [sde, setSde] = useState("");

  // File staging
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Creating…");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // ── File staging ─────────────────────────────────────────────────────────

  function stageFiles(files: File[]) {
    setError(null);
    const toAdd: StagedFile[] = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) { setError(err); return; }
      toAdd.push({ id: crypto.randomUUID(), file, preview: file.name });
    }
    setStagedFiles((prev) => [...prev, ...toAdd]);
  }

  function removeStaged(id: string) {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    stageFiles(Array.from(e.dataTransfer.files));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Deal name is required."); return; }
    setError(null);
    setLoading(true);
    setLoadingLabel("Creating deal…");

    // 1. Create the deal
    const multiple = computeMultiple(askingPrice, sde);
    let dealId: string;
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || null,
          location: location.trim() || null,
          asking_price: askingPrice.trim() || null,
          sde: sde.trim() || null,
          multiple: multiple || null,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Failed to create deal. Please try again.");
        setLoading(false);
        return;
      }
      dealId = data.id;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return;
    }

    // 2. Submit initial notes (if any)
    if (initialNotes.trim()) {
      setLoadingLabel("Saving notes…");
      try {
        await fetch(`/api/deals/${dealId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: initialNotes.trim() }),
        });
      } catch (err) {
        console.warn("Initial entry submission error:", err);
      }
    }

    // 3. Upload staged files (if any)
    if (stagedFiles.length > 0) {
      setLoadingLabel(`Uploading ${stagedFiles.length} file${stagedFiles.length > 1 ? "s" : ""}…`);
      setUploadProgress({ done: 0, total: stagedFiles.length });

      // Upload in batches of 3 to avoid overwhelming the server
      const BATCH = 3;
      for (let i = 0; i < stagedFiles.length; i += BATCH) {
        const batch = stagedFiles.slice(i, i + BATCH);
        const form = new FormData();
        for (const sf of batch) form.append("files", sf.file);
        form.append("captureSource", "file");

        try {
          const res = await fetch(`/api/deals/${dealId}/files`, { method: "POST", body: form });
          const data = await res.json().catch(() => ({})) as { error?: string };
          if (!res.ok && data.error) {
            // Non-fatal — continue with remaining files, show warning
            console.warn(`[createDeal] File upload batch failed:`, data.error);
          }
        } catch (err) {
          console.warn("[createDeal] File upload batch error:", err);
        }

        setUploadProgress({ done: Math.min(i + BATCH, stagedFiles.length), total: stagedFiles.length });
      }
    }

    router.push(`/deals/${dealId}`);
  }

  const hasContent = stagedFiles.length > 0 || initialNotes.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Deal Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-semibold text-slate-700">
          Deal Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Midwest HVAC Company"
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
        />
      </div>

      {/* Asking Price + SDE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="askingPrice" className="text-sm font-semibold text-slate-700">
            Asking Price <span className="text-slate-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="askingPrice"
            type="text"
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
            placeholder="e.g. $1.2M or 600K"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sde" className="text-sm font-semibold text-slate-700">
            SDE <span className="text-slate-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="sde"
            type="text"
            value={sde}
            onChange={(e) => setSde(e.target.value)}
            placeholder="e.g. $240K or 200K"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
          />
        </div>
      </div>

      {/* Industry + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="industry" className="text-sm font-semibold text-slate-700">
            Industry <span className="text-slate-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="industry"
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. HVAC, SaaS, Retail"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" className="text-sm font-semibold text-slate-700">
            Location <span className="text-slate-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Denver, CO"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
          />
        </div>
      </div>

      {/* ── Intake section ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700">Add Inputs</p>
          <span className="text-slate-400 font-normal text-xs">(optional)</span>
        </div>
        <p className="text-xs text-slate-400 -mt-1">
          Upload files, paste a listing, or add notes. AI will extract facts automatically.
        </p>

        {/* Drop zone + action row */}
        <div
          className={`rounded-xl border-2 border-dashed transition-all ${
            isDragOver
              ? "border-indigo-300 bg-indigo-50"
              : "border-slate-200 bg-slate-50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            {/* Upload file */}
            <div className="relative">
              <input
                ref={uploadInputRef}
                type="file"
                accept={ALL_ACCEPT}
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  if (e.target.files?.length) stageFiles(Array.from(e.target.files));
                  e.target.value = "";
                }}
                disabled={loading}
              />
              <button
                type="button"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload File
              </button>
            </div>

            {/* Photo */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  if (e.target.files?.length) stageFiles(Array.from(e.target.files));
                  e.target.value = "";
                }}
                disabled={loading}
              />
              <button
                type="button"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Photo
              </button>
            </div>

            {/* Audio */}
            <div className="relative">
              <input
                type="file"
                accept="audio/*"
                capture="user"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  if (e.target.files?.length) stageFiles(Array.from(e.target.files));
                  e.target.value = "";
                }}
                disabled={loading}
              />
              <button
                type="button"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
                </svg>
                Audio
              </button>
            </div>

            {isDragOver && (
              <p className="text-xs font-medium text-indigo-600 animate-pulse ml-1">Drop to add…</p>
            )}
            {!isDragOver && stagedFiles.length === 0 && (
              <p className="text-xs text-slate-400 ml-1">or drag & drop files here</p>
            )}
          </div>

          {/* Staged file list */}
          {stagedFiles.length > 0 && (
            <div className="border-t border-slate-200 divide-y divide-slate-100">
              {stagedFiles.map((sf) => (
                <div key={sf.id} className="flex items-center gap-2.5 px-4 py-2">
                  {fileIcon(sf.file)}
                  <span className="flex-1 text-xs text-slate-700 truncate min-w-0">{sf.preview}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {sf.file.size > 1024 * 1024
                      ? `${(sf.file.size / 1024 / 1024).toFixed(1)} MB`
                      : `${Math.round(sf.file.size / 1024)} KB`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStaged(sf.id)}
                    disabled={loading}
                    className="shrink-0 text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes / paste text */}
        <textarea
          id="initialNotes"
          rows={4}
          value={initialNotes}
          onChange={(e) => setInitialNotes(e.target.value)}
          placeholder="Paste a listing, broker email, financial summary, or any raw notes…"
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-y disabled:opacity-60"
        />
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-indigo-700">
              Uploading files… {uploadProgress.done}/{uploadProgress.total}
            </p>
          </div>
          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              {loadingLabel}
            </>
          ) : (
            <>
              {hasContent ? "Create Deal & Upload" : "Create Deal"}
            </>
          )}
        </button>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          Cancel
        </Link>
      </div>

      {hasContent && !loading && (
        <p className="text-xs text-slate-400 -mt-2">
          {[
            stagedFiles.length > 0 && `${stagedFiles.length} file${stagedFiles.length > 1 ? "s" : ""} staged`,
            initialNotes.trim() && "notes ready",
          ].filter(Boolean).join(" · ")} — will be processed after the deal is created.
        </p>
      )}
    </form>
  );
}
