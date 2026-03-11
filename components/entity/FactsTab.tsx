"use client";

/**
 * FactsTab — Living Structured Fact Layer
 *
 * 3-section layout:
 *   0. Conflict banner       — unresolved conflicts at the top
 *   1. Basic Facts           — always-pinned core deal facts + derived metrics
 *   2. Candidate Facts       — newly extracted facts awaiting review
 *   3. All Facts by Category — grouped: Financials, Operations, Employees, etc.
 */

import { useState, useTransition } from "react";
import type {
  FactDefinition,
  EntityFactValue,
  FactValueStatus,
  FactEvidence,
  EntityFileWithText,
} from "@/types/entity";
import { computeDerivedMetrics } from "@/lib/kpi/derivedMetricsService";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  factDefinitions: FactDefinition[];
  factValues: EntityFactValue[];
  factEvidence: FactEvidence[];
  files: EntityFileWithText[];
  dealId: string;
  overallScore?: number | null;
  buyerFitLabel?: string | null;
};

// ─── Basic Facts config ───────────────────────────────────────────────────────
// These are always pinned at the top of the Facts tab.

type BasicFactMeta = {
  key: string;
  label: string;
  dataType: string;
  kpiLabel?: string;
  weight?: number;
  weightLabel?: string;
  placeholder?: string;
};

const BASIC_FACTS: BasicFactMeta[] = [
  { key: "industry",          label: "Industry",          dataType: "text",     placeholder: "e.g. Childcare, HVAC, Retail" },
  { key: "location",          label: "Location",          dataType: "text",     placeholder: "e.g. Broward County, FL" },
  { key: "asking_price",      label: "Asking Price",      dataType: "currency", kpiLabel: "Purchase Multiple", weight: 0.30, weightLabel: "30%", placeholder: "e.g. 1200000" },
  { key: "sde_latest",        label: "SDE",               dataType: "currency", kpiLabel: "SDE Margin",        weight: 0.20, weightLabel: "20%", placeholder: "e.g. 250000"  },
  { key: "revenue_latest",    label: "Revenue",           dataType: "currency", kpiLabel: "Rev / Employee",    weight: 0.15, weightLabel: "15%", placeholder: "e.g. 820000"  },
  { key: "employees_ft",      label: "Full-Time Employees", dataType: "number", kpiLabel: "Rev / Employee",    weight: 0.15, weightLabel: "15%", placeholder: "e.g. 8"       },
  { key: "lease_monthly_rent",label: "Monthly Rent",      dataType: "currency", kpiLabel: "Rent Ratio",        weight: 0.10, weightLabel: "10%", placeholder: "e.g. 4500"    },
];

// ─── Category config ──────────────────────────────────────────────────────────

type FactCategory = {
  key: string;
  label: string;
  icon: string;
  factKeys: string[];
};

const FACT_CATEGORIES: FactCategory[] = [
  {
    key: "financials",
    label: "Financials",
    icon: "💰",
    factKeys: [
      "ebitda_latest", "revenue_year_1", "revenue_year_2", "sde_year_1",
      "gross_profit", "net_income", "addbacks_summary", "financial_quality_notes",
    ],
  },
  {
    key: "deal_terms",
    label: "Deal Terms",
    icon: "📋",
    factKeys: [
      "deal_structure", "seller_financing", "down_payment",
      "inventory_included", "real_estate_included",
      "lease_expiration_date", "working_capital_intensity", "capex_intensity",
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: "⚙️",
    factKeys: [
      "years_in_business", "seasonality", "seller_reason", "transition_support",
      "recurring_revenue_pct", "repeat_revenue_pct",
    ],
  },
  {
    key: "employees",
    label: "Employees & Management",
    icon: "👥",
    factKeys: [
      "employees_pt", "manager_in_place",
      "owner_hours_per_week", "owner_in_sales", "owner_in_operations",
    ],
  },
  {
    key: "customers",
    label: "Customers & Revenue Quality",
    icon: "🎯",
    factKeys: [
      "customer_concentration_top1_pct", "customer_concentration_top5_pct",
      "vendor_concentration_top1_pct",
    ],
  },
  {
    key: "risk",
    label: "Risk Indicators",
    icon: "⚠️",
    factKeys: [
      "legal_risk_flag", "compliance_risk_flag", "licensing_dependency",
    ],
  },
];

const DERIVED_KEYS = new Set(["purchase_multiple", "sde_margin", "revenue_per_employee", "sde_per_employee"]);
const BASIC_KEYS = new Set(BASIC_FACTS.map((f) => f.key));
const ALL_CATEGORY_KEYS = new Set(FACT_CATEGORIES.flatMap((c) => c.factKeys));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(raw: string | null, dataType: string): string {
  if (!raw) return "—";
  if (dataType === "currency") {
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (!isNaN(n)) {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
      if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
      return `$${n.toLocaleString()}`;
    }
  }
  if (dataType === "percent") {
    const n = parseFloat(raw);
    if (!isNaN(n)) return `${(n > 1 ? n : n * 100).toFixed(1)}%`;
  }
  if (dataType === "boolean") return raw.toLowerCase() === "true" ? "Yes" : "No";
  return raw;
}

function isMissing(val: EntityFactValue | undefined): boolean {
  return !val || val.status === "missing" || val.status === "unclear";
}

function isFilled(val: EntityFactValue | undefined): boolean {
  return !!val && val.status !== "missing" && val.status !== "unclear";
}

function isCandidate(val: EntityFactValue | undefined): boolean {
  return !!val && (val.review_status === "unreviewed") &&
    (val.value_source_type === "ai_extracted" || val.value_source_type === "ai_inferred");
}

function confidenceLabel(c: number | null): string {
  if (c === null) return "Unknown";
  if (c >= 0.8) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
}

function sourceLabel(val: EntityFactValue | undefined, sourceName: string | null): string {
  if (!val || isMissing(val)) return "";
  const st = val.value_source_type;
  if (st === "ai_extracted" && sourceName) return sourceName;
  if (st === "ai_extracted") return "Document";
  if (st === "ai_inferred") return "AI estimate";
  if (st === "user_override") return "Manual entry";
  if (st === "broker_confirmed") return "Broker confirmed";
  return sourceName ?? "Source";
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ val }: { val: EntityFactValue | undefined }) {
  if (!val || isMissing(val)) return null;
  const st = val.value_source_type;
  const status = val.status as FactValueStatus;

  if (status === "conflicting") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
        ⚠ Conflict
      </span>
    );
  }
  if (st === "user_override") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
        Manual
      </span>
    );
  }
  if (st === "ai_extracted") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        Extracted
      </span>
    );
  }
  if (st === "ai_inferred") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.353A3.75 3.75 0 0112 18.75a3.75 3.75 0 01-2.652-1.097l-.347-.353z" />
        </svg>
        AI Estimate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
      Filled
    </span>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

type EditModalProps = {
  fd: FactDefinition;
  meta: BasicFactMeta | null;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  dealId: string;
  onClose: () => void;
  onSaved: (updated: EntityFactValue) => void;
};

function EditModal({ fd, meta, val, evidence, sourceName, dealId, onClose, onSaved }: EditModalProps) {
  const hasSuggestion = !!val && val.status !== "missing" &&
    (val.value_source_type === "ai_extracted" || val.value_source_type === "ai_inferred");
  const suggestedRaw = hasSuggestion ? val!.value_raw : null;
  const suggestedFormatted = suggestedRaw ? formatValue(suggestedRaw, fd.data_type) : null;
  const confidence = hasSuggestion ? val!.confidence ?? null : null;

  const [mode, setMode] = useState<"default" | "manual" | "reasoning">(
    hasSuggestion ? "default" : "manual"
  );
  const [manualValue, setManualValue] = useState(val?.value_raw ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(changeType: "confirm" | "edit" | "override", valueRaw: string | null) {
    setError(null);
    if ((changeType === "edit" || changeType === "override") && !valueRaw?.trim()) {
      setError("Please enter a value.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/facts/${fd.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            change_type: changeType,
            value_raw: changeType === "confirm" ? (val?.value_raw ?? null) : (valueRaw?.trim() ?? null),
            note: note.trim() || null,
            old_value: val?.value_raw ?? null,
            old_status: val?.status ?? null,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error ?? "Failed to save.");
          return;
        }
        const d = await res.json();
        onSaved(d.fact as EntityFactValue);
        onClose();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-800 text-base leading-tight">{fd.label}</p>
            {meta?.kpiLabel && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Feeds: {meta.kpiLabel} · weight {meta.weightLabel}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {hasSuggestion && mode !== "reasoning" && (() => {
            const isExtractedSrc = val?.value_source_type === "ai_extracted";
            const blockStyle = isExtractedSrc ? "border-emerald-100 bg-emerald-50" : "border-blue-100 bg-blue-50";
            const labelStyle = isExtractedSrc ? "text-emerald-700" : "text-blue-600";
            const srcLabel = isExtractedSrc ? "Extracted from document" : "AI Estimate";
            return (
              <div className={`rounded-xl border px-4 py-3 ${blockStyle}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${labelStyle}`}>{srcLabel}</span>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    confidenceLabel(confidence) === "High"   ? "bg-emerald-100 text-emerald-700" :
                    confidenceLabel(confidence) === "Medium" ? "bg-amber-100 text-amber-700" :
                                                               "bg-slate-100 text-slate-500"
                  }`}>
                    {confidenceLabel(confidence)} confidence
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">{suggestedFormatted}</p>
                {sourceName && <p className="text-[11px] text-slate-400 mt-1 truncate">from {sourceName}</p>}
                {evidence?.snippet && (
                  <p className="text-[11px] text-slate-400 mt-1 italic line-clamp-2">&ldquo;{evidence.snippet.slice(0, 140)}&rdquo;</p>
                )}
                {!evidence?.snippet && !isExtractedSrc && (
                  <p className="text-[11px] text-slate-400 mt-1">Estimated from available context — no direct quote found.</p>
                )}
              </div>
            );
          })()}

          {mode === "reasoning" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">How was this estimated?</span>
                <button type="button" onClick={() => setMode("default")} className="text-[11px] text-slate-400 hover:text-slate-600">← Back</button>
              </div>
              {evidence?.snippet ? (
                <div className="text-[12px] text-slate-600 leading-relaxed">
                  <p className="font-medium text-slate-700 mb-1">Source excerpt:</p>
                  <p className="italic text-slate-500">&ldquo;{evidence.snippet.slice(0, 300)}&rdquo;</p>
                  {sourceName && <p className="mt-1.5 text-[11px] text-slate-400 not-italic">— {sourceName}</p>}
                </div>
              ) : (
                <p className="text-[12px] text-slate-400">
                  {val?.value_source_type === "ai_inferred"
                    ? "No direct quote found. The AI estimated this value from the overall context."
                    : "No source excerpt available."}
                </p>
              )}
              {confidence !== null && (
                <p className="text-[11px] text-slate-400">Confidence: {confidenceLabel(confidence)} ({Math.round(confidence * 100)}%)</p>
              )}
            </div>
          )}

          {mode === "manual" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Enter value <span className="text-slate-400 font-normal ml-1">({fd.data_type})</span>
              </label>
              <input
                type="text"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder={meta?.placeholder ?? "Enter value"}
                className="w-full px-3.5 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] transition"
                autoFocus
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional) — e.g. confirmed by broker"
                className="w-full mt-2 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] transition text-slate-600 placeholder-slate-300"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {mode === "default" && hasSuggestion && (
            <div className="space-y-2">
              <button
                type="button" disabled={isPending}
                onClick={() => submit("confirm", suggestedRaw)}
                className="w-full py-3 rounded-xl bg-[#1F7A63] text-white font-semibold text-sm hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : "Accept suggestion"}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode("manual")} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">Edit manually</button>
                <button type="button" onClick={() => setMode("reasoning")} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition-colors">Why?</button>
              </div>
            </div>
          )}

          {mode === "manual" && (
            <div className="flex gap-2">
              {hasSuggestion && (
                <button type="button" onClick={() => setMode("default")} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition-colors">← Back</button>
              )}
              <button
                type="button" disabled={isPending}
                onClick={() => submit(hasSuggestion ? "override" : "edit", manualValue)}
                className="flex-1 py-2.5 rounded-xl bg-[#1F7A63] text-white font-semibold text-sm hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}

          {mode === "reasoning" && (
            <button
              type="button" disabled={isPending}
              onClick={() => submit("confirm", suggestedRaw)}
              className="w-full py-3 rounded-xl bg-[#1F7A63] text-white font-semibold text-sm hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Accept this value"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Conflict resolution modal ────────────────────────────────────────────────

type ConflictModalProps = {
  fd: FactDefinition;
  currentVal: EntityFactValue;
  allEvidence: FactEvidence[];
  fileNameMap: Map<string, string>;
  dealId: string;
  onClose: () => void;
  onResolved: (updated: EntityFactValue) => void;
};

function ConflictModal({ fd, currentVal, allEvidence, fileNameMap, dealId, onClose, onResolved }: ConflictModalProps) {
  const evidenceItems = allEvidence
    .filter((ev) => ev.fact_definition_id === fd.id && !ev.is_superseded)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  const [selectedValue, setSelectedValue] = useState<string>(
    currentVal.value_raw ?? evidenceItems[0]?.extracted_value_raw ?? ""
  );
  const [customValue, setCustomValue] = useState("");
  const [mode, setMode] = useState<"pick" | "custom">("pick");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleResolve() {
    const valueToSave = mode === "custom" ? customValue.trim() : selectedValue;
    if (!valueToSave) { setError("Please select or enter a value."); return; }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/facts/${fd.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            change_type: "override",
            value_raw: valueToSave,
            note: note.trim() || "Conflict resolved",
            old_value: currentVal.value_raw ?? null,
            old_status: "conflicting",
          }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to resolve."); return; }
        const d = await res.json();
        onResolved(d.fact as EntityFactValue);
        onClose();
      } catch { setError("Network error. Please try again."); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-amber-100 bg-amber-50">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="font-semibold text-amber-800 text-sm">Conflicting Values</p>
            </div>
            <p className="text-xs text-amber-600">{fd.label} — pick the correct value</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-100 text-amber-400 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {mode === "pick" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 mb-2">Sources found:</p>
              {evidenceItems.length > 0 ? evidenceItems.map((ev, i) => {
                const sn = ev.file_id ? fileNameMap.get(ev.file_id) ?? "Unknown file" : "Unknown source";
                const isSel = selectedValue === ev.extracted_value_raw;
                return (
                  <button key={ev.id ?? i} type="button"
                    onClick={() => setSelectedValue(ev.extracted_value_raw ?? "")}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${isSel ? "border-[#1F7A63] bg-[#F0FAF7]" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-lg font-bold tabular-nums ${isSel ? "text-[#1F7A63]" : "text-slate-800"}`}>
                        {formatValue(ev.extracted_value_raw, fd.data_type)}
                      </span>
                      {isSel && <svg className="w-4 h-4 text-[#1F7A63] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">from {sn}</p>
                    {ev.snippet && <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1">&ldquo;{ev.snippet.slice(0, 80)}&rdquo;</p>}
                    {ev.confidence !== null && <p className="text-[10px] text-slate-300 mt-0.5">{confidenceLabel(ev.confidence)} confidence</p>}
                  </button>
                );
              }) : <p className="text-sm text-slate-400">No evidence details available.</p>}
              <button type="button" onClick={() => setMode("custom")} className="w-full text-left rounded-xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors">
                + Enter a different value
              </button>
            </div>
          )}
          {mode === "custom" && (
            <div className="space-y-2">
              <button type="button" onClick={() => setMode("pick")} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">← Back to sources</button>
              <input type="text" value={customValue} onChange={(e) => setCustomValue(e.target.value)}
                placeholder={`Enter correct value (${fd.data_type})`}
                className="w-full px-3.5 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] transition" autoFocus />
            </div>
          )}
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. confirmed with broker"
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] transition text-slate-600 placeholder-slate-300" />
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <button type="button" disabled={isPending} onClick={handleResolve}
            className="w-full py-3 rounded-xl bg-[#1F7A63] text-white font-semibold text-sm hover:bg-[#1a6654] disabled:opacity-50 transition-colors">
            {isPending ? "Resolving…" : "Resolve conflict"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Conflict banner ──────────────────────────────────────────────────────────

function ConflictBanner({
  conflictingFacts,
  onResolve,
}: {
  conflictingFacts: { fd: FactDefinition; val: EntityFactValue }[];
  onResolve: (fd: FactDefinition) => void;
}) {
  if (conflictingFacts.length === 0) return null;
  return (
    <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="text-xs font-semibold text-amber-700">
          {conflictingFacts.length} conflicting value{conflictingFacts.length !== 1 ? "s" : ""} — resolve to improve scoring
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {conflictingFacts.map(({ fd }) => (
          <button key={fd.key} type="button" onClick={() => onResolve(fd)}
            className="px-2.5 py-1 bg-white border border-amber-200 text-amber-700 text-xs rounded-lg font-medium hover:bg-amber-100 transition-colors">
            ⚠ {fd.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Basic fact card ──────────────────────────────────────────────────────────

function BasicFactCard({
  fd,
  meta,
  val,
  evidence,
  sourceName,
  onEdit,
}: {
  fd: FactDefinition;
  meta: BasicFactMeta;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  onEdit: () => void;
}) {
  const filled = isFilled(val);
  const status = val?.status as FactValueStatus | undefined;
  const isConflict = filled && status === "conflicting";

  const cardStyle = !filled
    ? "bg-red-50/50 border-red-200 hover:border-red-400"
    : isConflict
      ? "bg-amber-50/50 border-amber-200 hover:border-amber-400"
      : val?.value_source_type === "ai_extracted"
        ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-400"
        : val?.value_source_type === "ai_inferred"
          ? "bg-blue-50/50 border-blue-200 hover:border-blue-400"
          : "bg-white border-slate-200 hover:border-[#1F7A63]/50";

  const snippet = evidence?.extracted_value_raw ?? evidence?.snippet ?? null;
  const snippetTruncated = snippet ? (snippet.length > 80 ? snippet.slice(0, 80) + "…" : snippet) : null;
  const src = sourceLabel(val, sourceName);

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`w-full text-left rounded-2xl border px-4 py-4 transition-all duration-150 hover:-translate-y-px hover:shadow-sm group ${cardStyle}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{meta.label}</span>
        {meta.weightLabel && <span className="text-[10px] text-slate-300 font-mono">{meta.weightLabel}</span>}
      </div>
      <div className={`text-2xl font-bold tabular-nums leading-tight mb-2 ${filled ? "text-slate-800" : "text-red-300"}`}>
        {filled ? formatValue(val!.value_raw, fd.data_type) : "—"}
      </div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <SourceBadge val={val} />
        {filled && src && <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{src}</span>}
        {!filled && <span className="text-[10px] text-slate-400 group-hover:text-red-500 transition-colors">Tap to add →</span>}
      </div>
      {filled && snippetTruncated && (
        <div className="mt-1 px-2 py-1.5 bg-white/70 rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-500 leading-relaxed italic">&ldquo;{snippetTruncated}&rdquo;</p>
        </div>
      )}
      {filled && val?.value_source_type === "ai_inferred" && val?.change_reason && (
        <div className="mt-1 px-2 py-1.5 bg-blue-50/60 rounded-lg border border-blue-100">
          <p className="text-[10px] text-blue-600 leading-relaxed">{val.change_reason}</p>
        </div>
      )}
    </button>
  );
}

// ─── Candidate fact review row ────────────────────────────────────────────────
// Shown for newly extracted, unreviewed AI facts

function CandidateFactRow({
  fd,
  val,
  evidence,
  sourceName,
  onAccept,
  onEdit,
}: {
  fd: FactDefinition;
  val: EntityFactValue;
  evidence: FactEvidence | null;
  sourceName: string | null;
  onAccept: () => void;
  onEdit: () => void;
}) {
  const [accepting, startTransition] = useTransition();
  const isExtracted = val.value_source_type === "ai_extracted";
  const snippet = evidence?.snippet ?? null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${isExtracted ? "border-emerald-200 bg-emerald-50/40" : "border-blue-200 bg-blue-50/40"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-600">{fd.label}</span>
            <SourceBadge val={val} />
          </div>
          <p className="text-lg font-bold text-slate-800 tabular-nums">
            {formatValue(val.value_raw, fd.data_type)}
          </p>
          {sourceName && <p className="text-[10px] text-slate-400 mt-0.5 truncate">from {sourceName}</p>}
          {snippet && (
            <p className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-2">&ldquo;{snippet.slice(0, 120)}&rdquo;</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            disabled={accepting}
            onClick={() => startTransition(onAccept)}
            className="px-3 py-1.5 rounded-lg bg-[#1F7A63] text-white text-xs font-semibold hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
          >
            {accepting ? "…" : "Accept"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Standard fact row (for category sections) ────────────────────────────────

function FactRow({
  fd,
  val,
  evidence,
  sourceName,
  onEdit,
}: {
  fd: FactDefinition;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  onEdit: () => void;
}) {
  const filled = isFilled(val);
  const status = val?.status as FactValueStatus | undefined;
  const isConflict = filled && status === "conflicting";
  const isCand = isCandidate(val);
  const snippet = evidence?.extracted_value_raw ?? evidence?.snippet ?? null;
  const snippetTruncated = snippet ? (snippet.length > 60 ? snippet.slice(0, 60) + "…" : snippet) : null;
  const src = sourceLabel(val, sourceName);

  // Source indicator icon
  const srcIcon = !filled ? null
    : isConflict                                ? { icon: "⚠", cls: "text-amber-500" }
    : val?.value_source_type === "user_override"? { icon: "✎", cls: "text-slate-500" }
    : val?.value_source_type === "ai_extracted" ? { icon: "✓", cls: "text-emerald-500" }
    : val?.value_source_type === "ai_inferred"  ? { icon: "~", cls: "text-blue-400" }
    :                                             { icon: "·", cls: "text-slate-400" };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 group cursor-pointer transition-colors ${
        isCand ? "bg-blue-50/30 hover:bg-blue-50/60" : "hover:bg-slate-50"
      }`}
      onClick={onEdit}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
        isConflict ? "bg-amber-400" : filled ? "bg-emerald-400" : "bg-slate-200"
      }`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-600 truncate">{fd.label}</span>
          {srcIcon && (
            <span className={`text-[10px] font-medium shrink-0 ${srcIcon.cls}`}
              title={
                val?.value_source_type === "user_override" ? "Manually entered" :
                val?.value_source_type === "ai_extracted"  ? "Extracted from document" :
                val?.value_source_type === "ai_inferred"   ? "AI estimate" :
                isConflict                                 ? "Conflict — needs review" : ""
              }
            >
              {srcIcon.icon}
            </span>
          )}
          {isCand && (
            <span className="text-[9px] font-semibold text-blue-500 bg-blue-100 px-1 py-0.5 rounded shrink-0">NEW</span>
          )}
        </div>
        {filled && src && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{src}</div>}
        {filled && snippetTruncated && <div className="text-[10px] text-slate-400 italic mt-0.5 truncate">&ldquo;{snippetTruncated}&rdquo;</div>}
      </div>

      <div className="text-right shrink-0">
        {filled ? (
          <span className="text-sm font-medium text-slate-700 tabular-nums">{formatValue(val!.value_raw, fd.data_type)}</span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      <svg className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

// ─── Calculated metrics ───────────────────────────────────────────────────────

function CalculatedMetricsSection({
  factDefs,
  factValues,
}: {
  factDefs: FactDefinition[];
  factValues: EntityFactValue[];
}) {
  const metrics = computeDerivedMetrics(factValues, factDefs);
  const items = Object.values(metrics);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Calculated Metrics</p>
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-[10px] text-slate-300 shrink-0">auto-computed</span>
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {items.map((m, i) => (
          <div key={m.key} className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-slate-100" : ""}`}>
            <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-slate-500 font-mono">fx</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-600">{m.label}</div>
              <div className="text-[10px] text-slate-400">{m.description}</div>
            </div>
            <div className="text-right shrink-0">
              {m.available ? (
                <span className="text-sm font-bold text-slate-800 tabular-nums">{m.formatted}</span>
              ) : (
                <span className="text-xs text-slate-300">Need {m.inputs.slice(0, 2).join(" + ")}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  category,
  factDefs,
  valueMap,
  evidenceMap,
  fileNameMap,
  onEdit,
}: {
  category: FactCategory;
  factDefs: FactDefinition[];
  valueMap: Map<string, EntityFactValue>;
  evidenceMap: Map<string, FactEvidence>;
  fileNameMap: Map<string, string>;
  onEdit: (fd: FactDefinition) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const factsInCategory = category.factKeys
    .map((key) => factDefs.find((d) => d.key === key))
    .filter((fd): fd is FactDefinition => !!fd);

  if (factsInCategory.length === 0) return null;

  const filledCount = factsInCategory.filter((fd) => isFilled(valueMap.get(fd.id))).length;
  const candidateCount = factsInCategory.filter((fd) => isCandidate(valueMap.get(fd.id))).length;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 py-2 text-left group"
      >
        <span className="text-sm">{category.icon}</span>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">{category.label}</span>
        {candidateCount > 0 && (
          <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
            {candidateCount} new
          </span>
        )}
        <span className="text-[10px] text-slate-400 tabular-nums">
          {filledCount}/{factsInCategory.length}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-all ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {factsInCategory.map((fd) => {
            const val = valueMap.get(fd.id);
            const evidence = evidenceMap.get(fd.id) ?? null;
            const sn = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
            return (
              <FactRow
                key={fd.id}
                fd={fd}
                val={val}
                evidence={evidence}
                sourceName={sn}
                onEdit={() => onEdit(fd)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FactsTab({ factDefinitions, factValues, factEvidence, files, dealId, overallScore, buyerFitLabel }: Props) {
  const [editingFact, setEditingFact] = useState<FactDefinition | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState<FactDefinition | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<string, EntityFactValue>>(new Map());
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Merge server values with local optimistic overrides
  const effectiveValues = [...factValues];
  for (const [factDefId, override] of localOverrides) {
    const idx = effectiveValues.findIndex((v) => v.fact_definition_id === factDefId);
    if (idx >= 0) effectiveValues[idx] = override;
    else effectiveValues.push(override);
  }

  const valueMap = new Map<string, EntityFactValue>();
  for (const v of effectiveValues) valueMap.set(v.fact_definition_id, v);

  // Best non-superseded evidence per fact
  const evidenceMap = new Map<string, FactEvidence>();
  for (const ev of factEvidence) {
    if (!ev.is_superseded) {
      const existing = evidenceMap.get(ev.fact_definition_id);
      if (!existing || (ev.confidence ?? 0) > (existing.confidence ?? 0)) {
        evidenceMap.set(ev.fact_definition_id, ev);
      }
    }
  }

  const fileNameMap = new Map<string, string>();
  for (const f of files) fileNameMap.set(f.id, f.file_name ?? "Unknown file");

  // Resolve basic facts
  const basicFacts = BASIC_FACTS.flatMap((meta) => {
    const fd = factDefinitions.find((d) => d.key === meta.key);
    return fd ? [{ fd, meta }] : [];
  });

  // Conflicting facts
  const conflictingFacts = factDefinitions
    .map((fd) => ({ fd, val: valueMap.get(fd.id) }))
    .filter((x): x is { fd: FactDefinition; val: EntityFactValue } =>
      !!x.val && x.val.status === "conflicting"
    );

  // Candidate facts — newly extracted, unreviewed, NOT in basic facts
  const candidateFacts = factDefinitions
    .filter((fd) => !BASIC_KEYS.has(fd.key) && !DERIVED_KEYS.has(fd.key))
    .flatMap((fd) => {
      const val = valueMap.get(fd.id);
      return val && isCandidate(val) ? [{ fd, val }] : [];
    });

  // Stats
  const basicFilledCount = basicFacts.filter(({ fd }) => isFilled(valueMap.get(fd.id))).length;
  const totalFactsWithValues = effectiveValues.filter((v) => isFilled(v)).length;

  // Edit modal context
  const editingMeta = editingFact ? (BASIC_FACTS.find((m) => m.key === editingFact.key) ?? null) : null;
  const editingVal = editingFact ? valueMap.get(editingFact.id) : undefined;
  const editingEvidence = editingFact ? (evidenceMap.get(editingFact.id) ?? null) : null;
  const editingSource = editingEvidence?.file_id ? (fileNameMap.get(editingEvidence.file_id) ?? null) : null;

  // Conflict resolution context
  const resolvingVal = resolvingConflict ? valueMap.get(resolvingConflict.id) : undefined;

  function handleSaved(updated: EntityFactValue) {
    setLocalOverrides((prev) => {
      const next = new Map(prev);
      next.set(updated.fact_definition_id, updated);
      return next;
    });
  }

  async function acceptCandidate(fd: FactDefinition, val: EntityFactValue) {
    try {
      const res = await fetch(`/api/deals/${dealId}/facts/${fd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_type: "confirm",
          value_raw: val.value_raw,
          note: "Accepted from AI extraction",
          old_value: val.value_raw,
          old_status: val.status,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        handleSaved(d.fact as EntityFactValue);
      }
    } catch {
      // non-fatal
    }
  }

  if (factDefinitions.length === 0) {
    return (
      <div className="py-16 text-center px-4">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-medium">No facts extracted yet</p>
        <p className="text-slate-400 text-xs mt-1">Upload documents or paste text to extract structured facts.</p>
      </div>
    );
  }

  return (
    <div className="px-0 py-4">

      {/* ── Conflict banner ─────────────────────────────────────────────── */}
      <ConflictBanner conflictingFacts={conflictingFacts} onResolve={setResolvingConflict} />

      <div className="px-4">

        {/* ── Summary header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-base font-bold text-slate-800 leading-tight">Facts</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalFactsWithValues} fact{totalFactsWithValues !== 1 ? "s" : ""} collected
              {candidateFacts.length > 0 && (
                <span className="ml-1.5 text-blue-500 font-medium">· {candidateFacts.length} awaiting review</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {overallScore !== null && overallScore !== undefined && (
              <div className={`text-center px-3 py-1.5 rounded-xl border ${
                overallScore >= 8 ? "bg-emerald-50 border-emerald-200" :
                overallScore >= 5 ? "bg-amber-50 border-amber-200" :
                                    "bg-red-50 border-red-200"
              }`}>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Score</p>
                <p className={`text-base font-bold tabular-nums ${
                  overallScore >= 8 ? "text-emerald-700" :
                  overallScore >= 5 ? "text-amber-700" :
                                      "text-red-600"
                }`}>{overallScore.toFixed(1)}</p>
              </div>
            )}
            {buyerFitLabel && (
              <div className={`text-center px-3 py-1.5 rounded-xl border ${
                buyerFitLabel === "High" ? "bg-emerald-50 border-emerald-200" :
                buyerFitLabel === "Medium" ? "bg-amber-50 border-amber-200" :
                                             "bg-red-50 border-red-200"
              }`}>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Fit</p>
                <p className={`text-base font-bold ${
                  buyerFitLabel === "High" ? "text-emerald-700" :
                  buyerFitLabel === "Medium" ? "text-amber-700" :
                                               "text-red-600"
                }`}>{buyerFitLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── LAYER 1: Basic Facts ─────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Core Facts</p>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{basicFilledCount}/{basicFacts.length} filled</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                basicFilledCount === basicFacts.length ? "bg-emerald-500" :
                basicFilledCount >= basicFacts.length * 0.6 ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${basicFacts.length > 0 ? Math.round((basicFilledCount / basicFacts.length) * 100) : 0}%` }}
            />
          </div>

          <div className="flex flex-col gap-3">
            {basicFacts.map(({ fd, meta }) => {
              const val = valueMap.get(fd.id);
              const evidence = evidenceMap.get(fd.id) ?? null;
              const sn = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
              return (
                <BasicFactCard
                  key={fd.id}
                  fd={fd}
                  meta={meta}
                  val={val}
                  evidence={evidence}
                  sourceName={sn}
                  onEdit={() => setEditingFact(fd)}
                />
              );
            })}
          </div>
        </div>

        {/* ── LAYER 2: Candidate Facts (awaiting review) ───────────────────── */}
        {candidateFacts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest shrink-0">Awaiting Review</p>
              <div className="flex-1 h-px bg-blue-100" />
              <span className="text-[10px] text-blue-400 tabular-nums shrink-0">{candidateFacts.length} new</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              AI extracted these facts from your documents. Review and accept to include in scoring.
            </p>
            <div className="flex flex-col gap-2">
              {candidateFacts.map(({ fd, val }) => {
                const evidence = evidenceMap.get(fd.id) ?? null;
                const sn = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
                return (
                  <CandidateFactRow
                    key={fd.id}
                    fd={fd}
                    val={val}
                    evidence={evidence}
                    sourceName={sn}
                    onAccept={() => acceptCandidate(fd, val)}
                    onEdit={() => setEditingFact(fd)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Calculated metrics ──────────────────────────────────────────── */}
        <CalculatedMetricsSection factDefs={factDefinitions} factValues={effectiveValues} />

        {/* ── LAYER 3: All Facts by Category ──────────────────────────────── */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowAllCategories((v) => !v)}
            className="w-full flex items-center gap-3 py-2 group"
          >
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">All Facts</p>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{totalFactsWithValues} collected</span>
            <svg
              className={`w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-all ${showAllCategories ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showAllCategories && (
            <div className="mt-3">
              {FACT_CATEGORIES.map((category) => (
                <CategorySection
                  key={category.key}
                  category={category}
                  factDefs={factDefinitions}
                  valueMap={valueMap}
                  evidenceMap={evidenceMap}
                  fileNameMap={fileNameMap}
                  onEdit={setEditingFact}
                />
              ))}

              {/* Other facts not in any category */}
              {(() => {
                const otherFacts = factDefinitions.filter(
                  (fd) => !BASIC_KEYS.has(fd.key) && !ALL_CATEGORY_KEYS.has(fd.key) && !DERIVED_KEYS.has(fd.key)
                );
                if (otherFacts.length === 0) return null;
                return (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 py-2">
                      <span className="text-sm">📎</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-1">Other</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {otherFacts.filter((fd) => isFilled(valueMap.get(fd.id))).length}/{otherFacts.length}
                      </span>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {otherFacts.map((fd) => {
                        const val = valueMap.get(fd.id);
                        const evidence = evidenceMap.get(fd.id) ?? null;
                        const sn = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
                        return (
                          <FactRow
                            key={fd.id}
                            fd={fd}
                            val={val}
                            evidence={evidence}
                            sourceName={sn}
                            onEdit={() => setEditingFact(fd)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </div>{/* end px-4 */}

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      {editingFact && (
        <EditModal
          fd={editingFact}
          meta={editingMeta}
          val={editingVal}
          evidence={editingEvidence}
          sourceName={editingSource}
          dealId={dealId}
          onClose={() => setEditingFact(null)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Conflict resolution modal ────────────────────────────────────── */}
      {resolvingConflict && resolvingVal && (
        <ConflictModal
          fd={resolvingConflict}
          currentVal={resolvingVal}
          allEvidence={factEvidence}
          fileNameMap={fileNameMap}
          dealId={dealId}
          onClose={() => setResolvingConflict(null)}
          onResolved={handleSaved}
        />
      )}
    </div>
  );
}
