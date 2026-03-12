"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DealMetadataFields, { type DealMetadataValues } from "@/components/DealMetadataFields";
import { formatLocation } from "@/lib/config/dealMetadata";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 100 * 1024 * 1024;
const ALL_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp3,.m4a,.mp4,.wav,.webm,.ogg,.aac";
const ALLOWED_EXTENSIONS = new Set([
  ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".aac",
]);

const MIN_REQUIRED_KEYS = ["asking_price", "sde_latest", "industry", "location"] as const;
type MinRequiredKey = typeof MIN_REQUIRED_KEYS[number];

const MIN_REQUIRED_LABELS: Record<MinRequiredKey, string> = {
  asking_price: "Asking Price",
  sde_latest:   "SDE / Cash Flow",
  industry:     "Industry",
  location:     "Location",
};

const US_STATE_ABBREVS = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;
const DEAL_NAME_PREFIXES = /^(Listing:|Business:|For Sale:|BUSINESS FOR SALE|Property:)\s*/i;

/** Extract a suggested deal name from pasted listing text (first 500 chars, first 2 lines). */
function suggestDealNameFromPaste(text: string): string | null {
  const head = text.slice(0, 500).trim();
  if (!head) return null;
  const lines = head.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "";
  let name = firstLine.replace(DEAL_NAME_PREFIXES, "").trim();
  if (!name) return null;
  if (name.length > 60) name = name.slice(0, 57) + "...";
  const stateMatch = head.match(US_STATE_ABBREVS);
  const state = stateMatch ? stateMatch[1].toUpperCase() : null;
  return state ? `${name} — ${state}` : name;
}

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

function formatCurrency(raw: string): string {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StagedFile = { id: string; file: File; preview: string };

type ExtractedFact = {
  fact_key: string;
  label: string;
  extracted_value_raw: string;
  confidence: number;
  snippet: string | null;
  required: boolean;
  userValue?: string;
  accepted: boolean;
};

type ExtractionState =
  | { status: "idle" }
  | { status: "extracting" }
  | { status: "done"; facts: ExtractedFact[]; missingRequired: string[] }
  | { status: "error"; message: string };

const EXTRACTION_STEPS = ["reading", "extracting", "calculating", "scoring"] as const;
type ExtractionStepId = (typeof EXTRACTION_STEPS)[number];
type StepStatus = "waiting" | "active" | "done";
const EXTRACTION_STEP_LABELS: Record<ExtractionStepId, string> = {
  reading: "Reading document",
  extracting: "Extracting key facts",
  calculating: "Calculating metrics",
  scoring: "Scoring deal",
};

type IntakeRejection = {
  dealId: string;
  verdict: string;
  flags: string[];
  score: number | null;
  opinion: string | null;
  industry: string | null;
  location: string | null;
  price: string | null;
  sde: string | null;
};

// ─── File icon helper ─────────────────────────────────────────────────────────

function fileIcon(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type;
  if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) {
    return <span className="w-6 h-6 rounded bg-violet-50 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" /></svg></span>;
  }
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) {
    return <span className="w-6 h-6 rounded bg-amber-50 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></span>;
  }
  if (ext === "pdf") {
    return <span className="w-6 h-6 rounded bg-red-50 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></span>;
  }
  return <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></span>;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) return <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">High</span>;
  if (confidence >= 0.5) return <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Med</span>;
  return <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Low</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateDealForm() {
  const router = useRouter();

  // Mode: "paste" = AI extraction first, "manual" = fill fields directly
  const [mode, setMode] = useState<"paste" | "manual">("paste");

  // Shared
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Creating…");
  const [intakeRejection, setIntakeRejection] = useState<IntakeRejection | null>(null);
  const [keepingAnyway, setKeepingAnyway] = useState(false);

  // Paste mode
  const [pasteText, setPasteText] = useState("");
  const [extraction, setExtraction] = useState<ExtractionState>({ status: "idle" });
  const [stepStatus, setStepStatus] = useState<Record<ExtractionStepId, StepStatus>>({
    reading: "waiting",
    extracting: "waiting",
    calculating: "waiting",
    scoring: "waiting",
  });
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [suggestedDealName, setSuggestedDealName] = useState<string | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Manual mode
  const [askingPrice, setAskingPrice] = useState("");
  const [sde, setSde] = useState("");
  const [metadata, setMetadata] = useState<DealMetadataValues>({
    deal_source_category: "",
    deal_source_detail: "",
    industry_category: "",
    industry: "",
    state: "",
    county: "",
    city: "",
  });
  const [manualNotes, setManualNotes] = useState("");
  const [manualFiles, setManualFiles] = useState<StagedFile[]>([]);

  function setMeta(field: keyof DealMetadataValues, value: string) {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  }

  // ── File staging ──────────────────────────────────────────────────────────

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

  function stageManualFiles(files: File[]) {
    setError(null);
    const toAdd: StagedFile[] = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) { setError(err); return; }
      toAdd.push({ id: crypto.randomUUID(), file, preview: file.name });
    }
    setManualFiles((prev) => [...prev, ...toAdd]);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    stageFiles(Array.from(e.dataTransfer.files));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  // ── AI Extraction ─────────────────────────────────────────────────────────

  async function runExtraction() {
    const text = pasteText.trim();
    if (text.length < 30) {
      setError("Please paste more text — at least a few lines from the listing.");
      return;
    }
    setError(null);
    setExtraction({ status: "extracting" });
    setStepStatus({ reading: "active", extracting: "waiting", calculating: "waiting", scoring: "waiting" });

    const tExtracting = window.setTimeout(() => {
      setStepStatus((s) => ({ ...s, reading: "done", extracting: "active" }));
    }, 2500);

    try {
      const res = await fetch("/api/deals/pre-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as {
        candidates?: Array<{
          fact_key: string; label: string; extracted_value_raw: string;
          confidence: number; snippet: string | null; required: boolean;
        }>;
        missing_required?: string[];
        error?: string;
      };

      if (!res.ok || data.error) {
        clearTimeout(tExtracting);
        setStepStatus({ reading: "waiting", extracting: "waiting", calculating: "waiting", scoring: "waiting" });
        setExtraction({ status: "error", message: data.error ?? "Extraction failed." });
        return;
      }

      clearTimeout(tExtracting);
      setStepStatus((s) => ({ ...s, extracting: "done", calculating: "active" }));
      window.setTimeout(() => {
        setStepStatus((s) => ({ ...s, calculating: "done", scoring: "active" }));
        window.setTimeout(() => {
          const facts: ExtractedFact[] = (data.candidates ?? []).map((c) => ({
            ...c,
            accepted: c.confidence >= 0.5,
          }));
          setExtraction({
            status: "done",
            facts,
            missingRequired: data.missing_required ?? [],
          });
          setStepStatus({ reading: "waiting", extracting: "waiting", calculating: "waiting", scoring: "waiting" });
          if (!name.trim()) {
            const industry = facts.find((f) => f.fact_key === "industry");
            const location = facts.find((f) => f.fact_key === "location");
            if (industry && location) {
              setName(`${industry.extracted_value_raw} — ${location.extracted_value_raw}`);
            } else if (industry) {
              setName(industry.extracted_value_raw);
            }
          }
        }, 500);
      }, 500);
    } catch {
      clearTimeout(tExtracting);
      setStepStatus({ reading: "waiting", extracting: "waiting", calculating: "waiting", scoring: "waiting" });
      setExtraction({ status: "error", message: "Network error. Please try again." });
    }
  }

  function updateFactValue(factKey: string, value: string) {
    if (extraction.status !== "done") return;
    setExtraction({
      ...extraction,
      facts: extraction.facts.map((f) =>
        f.fact_key === factKey ? { ...f, userValue: value } : f
      ),
      missingRequired: extraction.missingRequired.filter((k) => k !== factKey || value.trim()),
    });
  }

  function toggleFactAccepted(factKey: string) {
    if (extraction.status !== "done") return;
    setExtraction({
      ...extraction,
      facts: extraction.facts.map((f) =>
        f.fact_key === factKey ? { ...f, accepted: !f.accepted } : f
      ),
    });
  }

  // ── Missing required facts ────────────────────────────────────────────────

  function getMissingRequired(): MinRequiredKey[] {
    if (mode === "manual") {
      const missing: MinRequiredKey[] = [];
      if (!askingPrice.trim()) missing.push("asking_price");
      if (!sde.trim()) missing.push("sde_latest");
      if (!metadata.industry.trim()) missing.push("industry");
      const loc = formatLocation(metadata.city, metadata.county, metadata.state);
      if (!loc) missing.push("location");
      return missing;
    }

    if (extraction.status !== "done") return [...MIN_REQUIRED_KEYS];

    const missing: MinRequiredKey[] = [];
    for (const key of MIN_REQUIRED_KEYS) {
      const fact = extraction.facts.find((f) => f.fact_key === key);
      const effectiveValue = fact?.userValue ?? fact?.extracted_value_raw ?? "";
      if (!effectiveValue.trim()) missing.push(key);
    }
    return missing;
  }

  const missingRequired = getMissingRequired();
  const canSubmit = missingRequired.length === 0 && name.trim().length > 0;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Deal name is required."); return; }
    if (missingRequired.length > 0) {
      setError(`Please provide: ${missingRequired.map((k) => MIN_REQUIRED_LABELS[k]).join(", ")}`);
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingLabel("Creating deal…");

    let extractedFacts: Array<{ fact_key: string; value_raw: string; confidence: number; snippet?: string | null }> | null = null;

    if (mode === "paste" && extraction.status === "done") {
      extractedFacts = extraction.facts
        .filter((f) => f.accepted)
        .map((f) => ({
          fact_key: f.fact_key,
          value_raw: f.userValue ?? f.extracted_value_raw,
          confidence: f.confidence,
          snippet: f.snippet,
        }));
    }

    let askingPriceVal: string | null = null;
    let sdeVal: string | null = null;
    let industryVal: string | null = null;
    let locationVal: string | null = null;

    if (mode === "paste" && extraction.status === "done") {
      const getVal = (key: string) => {
        const f = extraction.facts.find((f) => f.fact_key === key);
        return (f?.userValue ?? f?.extracted_value_raw ?? "").trim() || null;
      };
      askingPriceVal = getVal("asking_price");
      sdeVal = getVal("sde_latest");
      industryVal = getVal("industry");
      locationVal = getVal("location");
    } else {
      askingPriceVal = askingPrice.trim() || null;
      sdeVal = sde.trim() || null;
      industryVal = metadata.industry.trim() || null;
      locationVal = formatLocation(metadata.city, metadata.county, metadata.state) || null;
    }

    const multiple = askingPriceVal && sdeVal ? computeMultiple(askingPriceVal, sdeVal) : null;

    setLoadingLabel("Creating deal & running initial score…");
    let dealId: string;
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry_category: mode === "manual" ? (metadata.industry_category || null) : null,
          industry: industryVal,
          state: mode === "manual" ? (metadata.state || null) : null,
          county: mode === "manual" ? (metadata.county || null) : null,
          city: mode === "manual" ? (metadata.city || null) : null,
          location: locationVal,
          deal_source_category: mode === "manual" ? (metadata.deal_source_category || null) : null,
          deal_source_detail: mode === "manual" ? (metadata.deal_source_detail || null) : null,
          asking_price: askingPriceVal,
          sde: sdeVal,
          multiple: multiple || null,
          extracted_facts: extractedFacts,
        }),
      });
      const data = await res.json() as {
        id?: string;
        error?: string;
        intake_verdict?: string | null;
        intake_flags?: string[];
        intake_score?: number | null;
        intake_opinion?: string | null;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Failed to create deal. Please try again.");
        setLoading(false);
        return;
      }
      dealId = data.id;

      // ── Intake rejection check ─────────────────────────────────────────────
      // If the initial assessment verdict is PROBABLY_PASS, show the rejection
      // screen instead of navigating to the deal. The user can dismiss or keep.
      if (data.intake_verdict === "PROBABLY_PASS") {
        // Upload files and notes first so they're available if user keeps the deal
        const filesToUploadEarly = mode === "paste" ? stagedFiles : manualFiles;
        if (filesToUploadEarly.length > 0) {
          setLoadingLabel(`Uploading ${filesToUploadEarly.length} file${filesToUploadEarly.length > 1 ? "s" : ""}…`);
          const BATCH = 3;
          for (let i = 0; i < filesToUploadEarly.length; i += BATCH) {
            const batch = filesToUploadEarly.slice(i, i + BATCH);
            const form = new FormData();
            for (const sf of batch) form.append("files", sf.file);
            form.append("captureSource", "file");
            try {
              await fetch(`/api/deals/${dealId}/files`, { method: "POST", body: form });
            } catch (err) {
              console.warn("[createDeal] File upload batch error:", err);
            }
          }
        }

        // Fire-and-forget: record the rejection in the audit log and clean up Drive
        fetch(`/api/deals/${dealId}/intake-reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            rejection_reason: "PROBABLY_PASS",
            rejection_flags: data.intake_flags ?? [],
            score: data.intake_score ?? null,
            ai_summary_short: data.intake_opinion ?? null,
            extracted_industry: industryVal,
            extracted_location: locationVal,
            extracted_price: askingPriceVal,
            extracted_sde: sdeVal,
          }),
        }).catch(() => {});

        setIntakeRejection({
          dealId,
          verdict: "PROBABLY_PASS",
          flags: data.intake_flags ?? [],
          score: data.intake_score ?? null,
          opinion: data.intake_opinion ?? null,
          industry: industryVal,
          location: locationVal,
          price: askingPriceVal,
          sde: sdeVal,
        });
        setLoading(false);
        return;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      return;
    }

    const filesToUpload = mode === "paste" ? stagedFiles : manualFiles;
    if (filesToUpload.length > 0) {
      setLoadingLabel(`Uploading ${filesToUpload.length} file${filesToUpload.length > 1 ? "s" : ""}…`);
      const BATCH = 3;
      for (let i = 0; i < filesToUpload.length; i += BATCH) {
        const batch = filesToUpload.slice(i, i + BATCH);
        const form = new FormData();
        for (const sf of batch) form.append("files", sf.file);
        form.append("captureSource", "file");
        try {
          await fetch(`/api/deals/${dealId}/files`, { method: "POST", body: form });
        } catch (err) {
          console.warn("[createDeal] File upload batch error:", err);
        }
      }
    }

    const notes = mode === "manual" ? manualNotes.trim() : "";
    if (notes) {
      try {
        await fetch(`/api/deals/${dealId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: notes }),
        });
      } catch (err) {
        console.warn("[createDeal] Notes submission error:", err);
      }
    }

    router.push(`/deals/${dealId}?tab=analysis`);
  }

  // ── Keep Anyway handler ───────────────────────────────────────────────────
  async function handleKeepAnyway() {
    if (!intakeRejection) return;
    setKeepingAnyway(true);
    try {
      await fetch(`/api/deals/${intakeRejection.dealId}/intake-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "keep" }),
      });
    } catch {
      // Non-fatal — navigate anyway
    }
    router.push(`/deals/${intakeRejection.dealId}?tab=analysis`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── Intake rejection screen ───────────────────────────────────────────────
  if (intakeRejection) {
    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-red-800 leading-snug">
                This listing was screened out
              </h2>
              <p className="mt-1 text-sm text-red-700 leading-relaxed">
                The initial assessment flagged this deal as unlikely to meet your criteria. It was not added to your deal list.
              </p>
            </div>
          </div>
        </div>

        {/* Score & opinion */}
        {(intakeRejection.score !== null || intakeRejection.opinion) && (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex flex-col gap-3">
            {intakeRejection.score !== null && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-medium">Initial score</span>
                <span className="text-sm font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                  {intakeRejection.score.toFixed(1)}/10
                </span>
              </div>
            )}
            {intakeRejection.opinion && (
              <p className="text-sm text-slate-600 leading-relaxed">{intakeRejection.opinion}</p>
            )}
          </div>
        )}

        {/* Flags */}
        {intakeRejection.flags.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reasons</p>
            <ul className="flex flex-col gap-1.5">
              {intakeRejection.flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Deal summary */}
        {(intakeRejection.industry || intakeRejection.location || intakeRejection.price || intakeRejection.sde) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extracted details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {intakeRejection.industry && (
                <>
                  <span className="text-slate-500">Industry</span>
                  <span className="text-slate-800 font-medium">{intakeRejection.industry}</span>
                </>
              )}
              {intakeRejection.location && (
                <>
                  <span className="text-slate-500">Location</span>
                  <span className="text-slate-800 font-medium">{intakeRejection.location}</span>
                </>
              )}
              {intakeRejection.price && (
                <>
                  <span className="text-slate-500">Asking Price</span>
                  <span className="text-slate-800 font-medium">{formatCurrency(intakeRejection.price)}</span>
                </>
              )}
              {intakeRejection.sde && (
                <>
                  <span className="text-slate-500">SDE</span>
                  <span className="text-slate-800 font-medium">{formatCurrency(intakeRejection.sde)}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleKeepAnyway}
            disabled={keepingAnyway}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {keepingAnyway ? "Opening deal…" : "Keep anyway — open the deal"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Dismiss — go back to dashboard
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Screened-out listings are not saved to your deal list and do not affect your statistics.
        </p>
      </div>
    );
  }

  const showReviewPanel = mode === "paste" && extraction.status === "done";
  const showSubmit = mode === "manual" || showReviewPanel;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">

      {/* ── Mode switcher ─────────────────────────────────────────────────── */}
      <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1 mb-5">
        <button
          type="button"
          onClick={() => { setMode("paste"); setError(null); }}
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
            mode === "paste"
              ? "bg-white shadow-sm text-slate-800 border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Paste Listing
          </span>
          {mode === "paste" && (
            <p className="text-[10px] text-slate-400 font-normal mt-0.5">AI extracts facts automatically</p>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setMode("manual"); setError(null); }}
          data-testid="manual-entry-mode"
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
            mode === "manual"
              ? "bg-white shadow-sm text-slate-800 border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manual Entry
          </span>
          {mode === "manual" && (
            <p className="text-[10px] text-slate-400 font-normal mt-0.5">Fill in the key fields directly</p>
          )}
        </button>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASTE MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "paste" && (
        <div className="flex flex-col gap-4">

          {/* Step 1: Input area (idle / error) */}
          {(extraction.status === "idle" || extraction.status === "error") && (
            <>
              {/* Paste textarea */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Listing text or broker email
                </label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  onBlur={() => {
                    if (pasteText.trim().length >= 20 && !suggestionDismissed) {
                      const suggested = suggestDealNameFromPaste(pasteText);
                      if (suggested) setSuggestedDealName(suggested);
                    }
                  }}
                  placeholder="Paste the full listing, broker email, or any description of the business here…"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition resize-y disabled:opacity-60"
                  data-testid="paste-listing"
                />
                {suggestedDealName && !suggestionDismissed && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span className="shrink-0">💡</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">Suggested name: </span>
                      <span className="italic">&quot;{suggestedDealName}&quot;</span>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => { setName(suggestedDealName); setSuggestedDealName(null); setSuggestionDismissed(true); }}
                        className="underline text-[#1F7A63] hover:text-[#176B55] font-medium transition-colors"
                      >
                        Use this
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSuggestionDismissed(true); setSuggestedDealName(null); }}
                      className="shrink-0 p-0.5 rounded text-amber-600 hover:bg-amber-100 transition-colors"
                      aria-label="Dismiss suggestion"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* File attachment area */}
              <div
                className={`rounded-xl border-2 border-dashed transition-all ${isDragOver ? "border-[#1F7A63] bg-emerald-50" : "border-slate-200 bg-slate-50/60"}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept={ALL_ACCEPT}
                      multiple
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      onChange={(e) => { if (e.target.files?.length) stageFiles(Array.from(e.target.files)); e.target.value = ""; }}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1F7A63] hover:text-[#1F7A63] transition-colors shadow-sm disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Attach files
                    </button>
                  </div>
                  {stagedFiles.length === 0 && !isDragOver && (
                    <p className="text-xs text-slate-400">or drag & drop · PDF, Excel, images, audio</p>
                  )}
                  {isDragOver && <p className="text-xs font-medium text-[#1F7A63] animate-pulse">Drop to attach…</p>}
                </div>

                {stagedFiles.length > 0 && (
                  <div className="border-t border-slate-200 divide-y divide-slate-100">
                    {stagedFiles.map((sf) => (
                      <div key={sf.id} className="flex items-center gap-2 px-4 py-1.5">
                        {fileIcon(sf.file)}
                        <span className="flex-1 text-xs text-slate-700 truncate">{sf.preview}</span>
                        <button
                          type="button"
                          onClick={() => setStagedFiles((p) => p.filter((f) => f.id !== sf.id))}
                          disabled={loading}
                          className="text-slate-300 hover:text-red-400 transition-colors"
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

              {extraction.status === "error" && (
                <p className="text-xs text-red-600">{extraction.message}</p>
              )}

              {/* Extract button */}
              <button
                type="button"
                onClick={runExtraction}
                disabled={pasteText.trim().length < 30 || loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F7A63] px-5 py-3 text-sm font-semibold text-white hover:bg-[#176B55] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                data-testid="extract-facts"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Extract Facts with AI
              </button>
            </>
          )}

          {/* Step 2: Extracting — 4-step progress */}
          {extraction.status === "extracting" && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800 mb-4">✦ Analyzing your document...</p>
              <ul className="space-y-2.5">
                {EXTRACTION_STEPS.map((stepId) => {
                  const status = stepStatus[stepId];
                  const label = EXTRACTION_STEP_LABELS[stepId];
                  return (
                    <li key={stepId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {status === "waiting" && (
                          <span className="shrink-0 w-3 h-3 rounded-full border border-gray-300" aria-hidden />
                        )}
                        {status === "active" && (
                          <span className="shrink-0 w-3 h-3 rounded-full bg-[#0F6E56] animate-pulse" aria-hidden />
                        )}
                        {status === "done" && (
                          <svg className="w-3.5 h-3.5 shrink-0 text-[#0F6E56]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span
                          className={`text-sm truncate ${
                            status === "active" ? "text-gray-900" : status === "done" ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {status === "done" ? "✓ done" : status === "active" ? "→ in progress" : "waiting"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-gray-400 mt-4">This usually takes 10–20 seconds</p>
            </div>
          )}

          {/* Step 3: Review extracted facts */}
          {extraction.status === "done" && (
            <ExtractedFactsReview
              extraction={extraction}
              name={name}
              setName={setName}
              onUpdateValue={updateFactValue}
              onToggleAccepted={toggleFactAccepted}
              onReset={() => { setExtraction({ status: "idle" }); }}
              missingRequired={missingRequired}
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MANUAL MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "manual" && (
        <div className="flex flex-col gap-4">

          {/* Deal Name — first field in manual mode */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="deal-name" className="text-sm font-semibold text-slate-700">
              Deal Name <span className="text-red-400">*</span>
            </label>
            <input
              id="deal-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Midwest HVAC Company — Chicago, IL"
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition disabled:opacity-60"
              data-testid="deal-name-input"
            />
          </div>

          {/* Core financials */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="asking-price" className="text-sm font-semibold text-slate-700">
                Asking Price <span className="text-red-400">*</span>
              </label>
              <input
                id="asking-price"
                type="text"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="e.g. $1.2M or 600K"
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sde-cashflow" className="text-sm font-semibold text-slate-700">
                SDE / Cash Flow <span className="text-red-400">*</span>
              </label>
              <input
                id="sde-cashflow"
                type="text"
                value={sde}
                onChange={(e) => setSde(e.target.value)}
                placeholder="e.g. $240K or 200K"
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition disabled:opacity-60"
              />
            </div>
          </div>

          {/* Industry + Location */}
          <DealMetadataFields values={metadata} onChange={setMeta} disabled={loading} compact />

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Notes <span className="text-slate-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Any additional context, broker notes, or raw listing text…"
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition resize-y disabled:opacity-60"
            />
          </div>

          {/* Files */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Files <span className="text-slate-400 font-normal text-xs">(optional)</span>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50">
              <div className="px-4 py-2.5 flex items-center gap-2">
                <div className="relative">
                  <input
                    type="file"
                    accept={ALL_ACCEPT}
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={(e) => { if (e.target.files?.length) stageManualFiles(Array.from(e.target.files)); e.target.value = ""; }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1F7A63] hover:text-[#1F7A63] transition-colors shadow-sm disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Attach files
                  </button>
                </div>
                <p className="text-xs text-slate-400">CIM, financials, photos, audio…</p>
              </div>
              {manualFiles.length > 0 && (
                <div className="border-t border-slate-200 divide-y divide-slate-100">
                  {manualFiles.map((sf) => (
                    <div key={sf.id} className="flex items-center gap-2 px-4 py-1.5">
                      {fileIcon(sf.file)}
                      <span className="flex-1 text-xs text-slate-700 truncate">{sf.preview}</span>
                      <button
                        type="button"
                        onClick={() => setManualFiles((p) => p.filter((f) => f.id !== sf.id))}
                        disabled={loading}
                        className="text-slate-300 hover:text-red-400 transition-colors"
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
          </div>
        </div>
      )}

      {/* ── Deal Name (paste mode only; manual has it at top) ───────────────── */}
      {showSubmit && mode === "paste" && (
        <div className="flex flex-col gap-1.5 mt-4">
          <label htmlFor="deal-name" className="text-sm font-semibold text-slate-700">
            Deal Name <span className="text-red-400">*</span>
          </label>
          <input
            id="deal-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Midwest HVAC Company — Chicago, IL"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition disabled:opacity-60"
            data-testid="deal-name-input"
          />
        </div>
      )}

      {/* ── Missing required facts gate ───────────────────────────────────── */}
      {showSubmit && missingRequired.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">Still needed before scoring:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingRequired.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-white border border-amber-200 px-2 py-0.5 rounded-full shadow-sm"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                </svg>
                {MIN_REQUIRED_LABELS[key]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Submit / Cancel ───────────────────────────────────────────────── */}
      {showSubmit && (
        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F7A63] px-6 py-3 text-sm font-semibold text-white hover:bg-[#176B55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            data-testid="create-deal-submit"
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
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Create Deal & Score
              </>
            )}
          </button>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      )}

      {/* Cancel link for paste idle state */}
      {mode === "paste" && extraction.status === "idle" && (
        <div className="flex justify-end mt-2">
          <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors">
            Cancel
          </Link>
        </div>
      )}

    </form>
  );
}

// ─── Extracted Facts Review Panel ─────────────────────────────────────────────

function ExtractedFactsReview({
  extraction,
  name,
  setName,
  onUpdateValue,
  onToggleAccepted,
  onReset,
  missingRequired,
}: {
  extraction: Extract<ExtractionState, { status: "done" }>;
  name: string;
  setName: (v: string) => void;
  onUpdateValue: (key: string, value: string) => void;
  onToggleAccepted: (key: string) => void;
  onReset: () => void;
  missingRequired: MinRequiredKey[];
}) {
  const requiredFacts = extraction.facts.filter((f) => f.required);
  const otherFacts = extraction.facts.filter((f) => !f.required);
  const [showAll, setShowAll] = useState(false);
  const acceptedCount = extraction.facts.filter((f) => f.accepted).length;

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {extraction.facts.length} facts extracted
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {acceptedCount} accepted · review before creating
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-paste
        </button>
      </div>

      {/* Required facts — always visible */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Required for scoring</p>
          {missingRequired.length === 0 && (
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              All found
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {requiredFacts.map((fact) => (
            <FactReviewRow
              key={fact.fact_key}
              fact={fact}
              isMissing={missingRequired.includes(fact.fact_key as MinRequiredKey)}
              onUpdateValue={onUpdateValue}
              onToggleAccepted={onToggleAccepted}
            />
          ))}
          {missingRequired.map((key) => {
            const alreadyShown = requiredFacts.some((f) => f.fact_key === key);
            if (alreadyShown) return null;
            return (
              <MissingFactRow
                key={key}
                factKey={key}
                label={MIN_REQUIRED_LABELS[key]}
                onFill={(value) => onUpdateValue(key, value)}
              />
            );
          })}
        </div>
      </div>

      {/* Deal name (auto-filled) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700">
          Deal Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Midwest HVAC Company"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#1F7A63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition"
        />
      </div>

      {/* Additional facts (collapsible) */}
      {otherFacts.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors"
          >
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Additional facts ({otherFacts.length})
            </p>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showAll ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAll && (
            <div className="divide-y divide-slate-100">
              {otherFacts.map((fact) => (
                <FactReviewRow
                  key={fact.fact_key}
                  fact={fact}
                  isMissing={false}
                  onUpdateValue={onUpdateValue}
                  onToggleAccepted={onToggleAccepted}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fact review row ──────────────────────────────────────────────────────────

function FactReviewRow({
  fact,
  isMissing,
  onUpdateValue,
  onToggleAccepted,
}: {
  fact: ExtractedFact;
  isMissing: boolean;
  onUpdateValue: (key: string, value: string) => void;
  onToggleAccepted: (key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(fact.userValue ?? fact.extracted_value_raw);

  const displayValue = fact.userValue ?? fact.extracted_value_raw;
  const isEdited = !!fact.userValue && fact.userValue !== fact.extracted_value_raw;

  const formattedDisplay = (() => {
    if (["asking_price", "sde_latest", "revenue_latest", "ebitda_latest", "lease_monthly_rent"].includes(fact.fact_key)) {
      return formatCurrency(displayValue);
    }
    if (fact.fact_key === "manager_in_place") return displayValue === "true" ? "Yes" : displayValue === "false" ? "No" : displayValue;
    return displayValue;
  })();

  function commitEdit() {
    if (editValue.trim()) onUpdateValue(fact.fact_key, editValue.trim());
    setEditing(false);
  }

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 ${isMissing ? "bg-red-50/40" : ""}`}>
      {/* Accept toggle */}
      <button
        type="button"
        onClick={() => onToggleAccepted(fact.fact_key)}
        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          fact.accepted ? "bg-[#1F7A63] border-[#1F7A63]" : "border-slate-300 bg-white"
        }`}
      >
        {fact.accepted && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-slate-600">{fact.label}</span>
          <ConfidenceBadge confidence={fact.confidence} />
          {isEdited && <span className="text-[10px] text-[#1F7A63] font-medium">edited</span>}
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="flex-1 rounded-lg border border-[#1F7A63] bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F7A63]"
            />
            <button type="button" onClick={commitEdit} className="text-[11px] font-semibold text-[#1F7A63] hover:underline">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-slate-400 hover:underline">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isMissing ? "text-red-400" : "text-slate-800"}`}>
              {formattedDisplay}
            </span>
            <button
              type="button"
              onClick={() => { setEditValue(displayValue); setEditing(true); }}
              className="text-[10px] text-slate-400 hover:text-[#1F7A63] transition-colors"
            >
              edit
            </button>
          </div>
        )}

        {fact.snippet && !editing && (
          <p className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">
            &ldquo;{fact.snippet.slice(0, 100)}{fact.snippet.length > 100 ? "…" : ""}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Missing fact row (inline fill) ──────────────────────────────────────────

function MissingFactRow({
  factKey,
  label,
  onFill,
}: {
  factKey: string;
  label: string;
  onFill: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  void factKey;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-red-50/50">
      <div className="w-4 h-4 rounded border-2 border-red-300 bg-white flex items-center justify-center shrink-0">
        <svg className="w-2.5 h-2.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-red-600 mb-1">{label} — not found</p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => { if (value.trim()) onFill(value.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onFill(value.trim()); }}
            placeholder={`Enter ${label.toLowerCase()}…`}
            className="flex-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder-red-300 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
          />
          {value.trim() && (
            <button type="button" onClick={() => onFill(value.trim())} className="text-[11px] font-semibold text-[#1F7A63] hover:underline">
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
