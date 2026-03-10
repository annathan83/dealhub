"use client";

/**
 * FactsTab — Score Input Sheet
 *
 * One clean section: 5 scoring-fact cards + progress bar.
 * Each card is a single tap target that opens a focused edit modal.
 * No duplication: facts appear exactly once.
 *
 * Sections:
 *   1. Score Input Sheet  — progress header + 5 fact cards
 *   2. Additional Facts   — secondary facts, collapsible
 *   3. Calculated Metrics — derived values, read-only
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
};

// ─── Scoring fact registry ────────────────────────────────────────────────────

type ScoringFactMeta = {
  key: string;
  kpiLabel: string;
  weight: number;
  weightLabel: string;
  placeholder: string;
  dataType: string;
};

const SCORING_FACTS: ScoringFactMeta[] = [
  { key: "asking_price",      kpiLabel: "Price Multiple",   weight: 0.12, weightLabel: "12%", placeholder: "e.g. 1200000",  dataType: "currency" },
  { key: "sde_latest",        kpiLabel: "SDE / EBITDA",     weight: 0.12, weightLabel: "12%", placeholder: "e.g. 250000",   dataType: "currency" },
  { key: "revenue_latest",    kpiLabel: "Revenue",          weight: 0.10, weightLabel: "10%", placeholder: "e.g. 820000",   dataType: "currency" },
  { key: "employees_ft",      kpiLabel: "Management Depth", weight: 0.07, weightLabel: "7%",  placeholder: "e.g. 8",        dataType: "number"   },
  { key: "years_in_business", kpiLabel: "Stability",        weight: 0.05, weightLabel: "5%",  placeholder: "e.g. 12",       dataType: "number"   },
];

const DERIVED_KEYS = new Set(["purchase_multiple", "sde_margin", "revenue_per_employee", "sde_per_employee"]);

const OPTIONAL_FACT_KEYS = [
  "ebitda_latest",
  "revenue_year_1",
  "sde_year_1",
  "employees_pt",
  "manager_in_place",
  "owner_hours_per_week",
  "customer_concentration_top1_pct",
  "recurring_revenue_pct",
  "deal_structure",
  "seller_financing",
  "lease_monthly_rent",
];

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

function confidenceLabel(c: number | null): string {
  if (c === null) return "Unknown";
  if (c >= 0.8) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
// Focused, mobile-first modal for entering / accepting a fact value.

type EditModalProps = {
  fd: FactDefinition;
  meta: ScoringFactMeta | null;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  dealId: string;
  onClose: () => void;
  onSaved: (updated: EntityFactValue) => void;
};

function EditModal({ fd, meta, val, evidence, sourceName, dealId, onClose, onSaved }: EditModalProps) {
  const hasSuggestion = !!val && val.status !== "missing" && val.value_source_type !== "user_override";
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
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-800 text-base leading-tight">{fd.label}</p>
            {meta && (
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
          {/* ── AI suggestion block ── */}
          {hasSuggestion && mode !== "reasoning" && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                  AI Suggested
                </span>
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                  confidenceLabel(confidence) === "High"   ? "bg-emerald-100 text-emerald-700" :
                  confidenceLabel(confidence) === "Medium" ? "bg-amber-100 text-amber-700" :
                                                             "bg-slate-100 text-slate-500"
                }`}>
                  {confidenceLabel(confidence)} confidence
                </span>
              </div>
              <p className="text-xl font-bold text-slate-800 tabular-nums leading-tight">
                {suggestedFormatted}
              </p>
              {sourceName && (
                <p className="text-[11px] text-slate-400 mt-1 truncate">from {sourceName}</p>
              )}
              {evidence?.snippet && (
                <p className="text-[11px] text-slate-400 mt-1 italic line-clamp-2">
                  &ldquo;{evidence.snippet.slice(0, 140)}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* ── Reasoning panel ── */}
          {mode === "reasoning" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">How was this estimated?</span>
                <button
                  type="button"
                  onClick={() => setMode("default")}
                  className="text-[11px] text-slate-400 hover:text-slate-600"
                >
                  ← Back
                </button>
              </div>
              {evidence?.snippet ? (
                <div className="text-[12px] text-slate-600 leading-relaxed">
                  <p className="font-medium text-slate-700 mb-1">Source excerpt:</p>
                  <p className="italic text-slate-500">&ldquo;{evidence.snippet.slice(0, 300)}&rdquo;</p>
                  {sourceName && (
                    <p className="mt-1.5 text-[11px] text-slate-400 not-italic">— {sourceName}</p>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-slate-400">
                  No source excerpt available. The value was extracted from document text.
                </p>
              )}
              {confidence !== null && (
                <p className="text-[11px] text-slate-400">
                  Confidence: {confidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
                </p>
              )}
            </div>
          )}

          {/* ── Manual input ── */}
          {mode === "manual" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Enter value
                <span className="text-slate-400 font-normal ml-1">({fd.data_type})</span>
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
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ── Action buttons ── */}
          {mode === "default" && hasSuggestion && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => submit("confirm", suggestedRaw)}
                className="w-full py-3 rounded-xl bg-[#1F7A63] text-white font-semibold text-sm hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : "Accept suggestion"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Edit manually
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reasoning")}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Why?
                </button>
              </div>
            </div>
          )}

          {mode === "manual" && (
            <div className="flex gap-2">
              {hasSuggestion && (
                <button
                  type="button"
                  onClick={() => setMode("default")}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => submit(hasSuggestion ? "override" : "edit", manualValue)}
                className="flex-1 py-2.5 rounded-xl bg-[#1F7A63] text-white font-semibold text-sm hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}

          {mode === "reasoning" && (
            <button
              type="button"
              disabled={isPending}
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

// ─── Score input card ─────────────────────────────────────────────────────────
// One card per scoring fact. Three visual states: Missing / Filled / AI Suggested.

function ScoreInputCard({
  fd,
  meta,
  val,
  evidence,
  sourceName,
  onEdit,
}: {
  fd: FactDefinition;
  meta: ScoringFactMeta;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  onEdit: () => void;
}) {
  const filled = isFilled(val);
  const isAiSuggested = filled && val!.value_source_type !== "user_override";
  const isManual = filled && val!.value_source_type === "user_override";
  const status: FactValueStatus = val?.status ?? "missing";

  // Card border/bg by state
  const cardStyle = filled
    ? isAiSuggested
      ? "bg-blue-50/60 border-blue-200 hover:border-blue-400"
      : "bg-white border-slate-200 hover:border-[#1F7A63]/50"
    : "bg-red-50/50 border-red-200 hover:border-red-400";

  // Status badge
  const badge = filled ? (
    isAiSuggested ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.353A3.75 3.75 0 0112 18.75a3.75 3.75 0 01-2.652-1.097l-.347-.353z" />
        </svg>
        Suggested
      </span>
    ) : isManual ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
        ✓ Confirmed
      </span>
    ) : (
      <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        status === "confirmed"   ? "text-emerald-700 bg-emerald-100" :
        status === "conflicting" ? "text-red-700 bg-red-100" :
                                   "text-slate-500 bg-slate-100"
      }`}>
        {status === "confirmed" ? "✓ Confirmed" : status === "conflicting" ? "⚠ Conflict" : "Estimated"}
      </span>
    )
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
      Missing
    </span>
  );

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`w-full text-left rounded-2xl border px-4 py-4 transition-all duration-150 hover:-translate-y-px hover:shadow-sm group ${cardStyle}`}
    >
      {/* Top row: label + weight */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {fd.label}
        </span>
        <span className="text-[10px] text-slate-300 font-mono">{meta.weightLabel}</span>
      </div>

      {/* Value */}
      <div className={`text-2xl font-bold tabular-nums leading-tight mb-2 ${
        filled ? "text-slate-800" : "text-red-300"
      }`}>
        {filled ? formatValue(val!.value_raw, fd.data_type) : "—"}
      </div>

      {/* Bottom row: status badge + source */}
      <div className="flex items-center justify-between gap-2">
        {badge}
        {filled && sourceName && (
          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
            {sourceName}
          </span>
        )}
        {!filled && (
          <span className="text-[10px] text-slate-400 group-hover:text-red-500 transition-colors">
            Tap to add →
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Optional fact row ────────────────────────────────────────────────────────

function OptionalFactRow({
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
  const isManual = val?.value_source_type === "user_override";
  const status: FactValueStatus = val?.status ?? "missing";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 group cursor-pointer hover:bg-slate-50 transition-colors"
      onClick={onEdit}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${filled ? "bg-emerald-400" : "bg-slate-200"}`} />

      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-600 truncate">{fd.label}</span>
        {filled && sourceName && (
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">from {sourceName}</div>
        )}
      </div>

      <div className="text-right shrink-0">
        {filled ? (
          <span className="text-sm font-medium text-slate-700 tabular-nums">
            {formatValue(val!.value_raw, fd.data_type)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      {filled && (
        <span className={`text-[10px] font-medium shrink-0 hidden sm:inline ${
          status === "confirmed"   ? "text-emerald-600" :
          isManual                 ? "text-emerald-600" :
          status === "conflicting" ? "text-red-500" :
                                     "text-slate-400"
        }`}>
          {status === "confirmed" || isManual ? "✓" : status === "conflicting" ? "⚠" : "~"}
        </span>
      )}

      <svg
        className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
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
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
          Calculated Metrics
        </p>
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-[10px] text-slate-300 shrink-0">auto-computed</span>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {items.map((m, i) => (
          <div
            key={m.key}
            className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-slate-100" : ""}`}
          >
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
                <span className="text-xs text-slate-300">
                  Need {m.inputs.slice(0, 2).join(" + ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FactsTab({ factDefinitions, factValues, factEvidence, files, dealId }: Props) {
  const [editingFact, setEditingFact] = useState<FactDefinition | null>(null);
  const [showAllOptional, setShowAllOptional] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Map<string, EntityFactValue>>(new Map());

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

  // Resolve scoring facts
  const scoringFacts = SCORING_FACTS.flatMap((meta) => {
    const fd = factDefinitions.find((d) => d.key === meta.key);
    return fd ? [{ fd, meta }] : [];
  });

  const filledCount = scoringFacts.filter(({ fd }) => isFilled(valueMap.get(fd.id))).length;
  const totalCount = scoringFacts.length;
  const pct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  // Optional facts
  const scoringKeys = new Set(SCORING_FACTS.map((m) => m.key));
  const optionalFacts = OPTIONAL_FACT_KEYS
    .filter((key) => !scoringKeys.has(key) && !DERIVED_KEYS.has(key))
    .flatMap((key) => {
      const fd = factDefinitions.find((d) => d.key === key);
      return fd ? [fd] : [];
    });

  const OPTIONAL_INITIAL = 5;
  const visibleOptional = showAllOptional ? optionalFacts : optionalFacts.slice(0, OPTIONAL_INITIAL);

  // Edit modal context
  const editingMeta = editingFact
    ? (SCORING_FACTS.find((m) => m.key === editingFact.key) ?? null)
    : null;
  const editingVal = editingFact ? valueMap.get(editingFact.id) : undefined;
  const editingEvidence = editingFact ? (evidenceMap.get(editingFact.id) ?? null) : null;
  const editingSource = editingEvidence?.file_id ? (fileNameMap.get(editingEvidence.file_id) ?? null) : null;

  // Empty state
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
    <div className="px-4 py-4">

      {/* ── Score Input Sheet header ────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-base font-bold text-slate-800 leading-tight">Score Input Sheet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {filledCount} of {totalCount} facts filled
            </p>
          </div>
          <span className={`text-sm font-bold tabular-nums ${
            pct === 100 ? "text-emerald-600" :
            pct >= 60   ? "text-amber-500" :
                          "text-red-400"
          }`}>
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct === 100 ? "bg-emerald-500" :
              pct >= 60   ? "bg-amber-400" :
                            "bg-red-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Scoring fact cards ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-6">
        {scoringFacts.map(({ fd, meta }) => {
          const val = valueMap.get(fd.id);
          const evidence = evidenceMap.get(fd.id) ?? null;
          const sourceName = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
          return (
            <ScoreInputCard
              key={fd.id}
              fd={fd}
              meta={meta}
              val={val}
              evidence={evidence}
              sourceName={sourceName}
              onEdit={() => setEditingFact(fd)}
            />
          );
        })}
      </div>

      {/* ── Additional facts ────────────────────────────────────────────── */}
      {optionalFacts.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
              Additional Facts
            </p>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{optionalFacts.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {visibleOptional.map((fd) => {
              const val = valueMap.get(fd.id);
              const evidence = evidenceMap.get(fd.id) ?? null;
              const sourceName = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
              return (
                <OptionalFactRow
                  key={fd.id}
                  fd={fd}
                  val={val}
                  evidence={evidence}
                  sourceName={sourceName}
                  onEdit={() => setEditingFact(fd)}
                />
              );
            })}
          </div>
          {optionalFacts.length > OPTIONAL_INITIAL && (
            <button
              type="button"
              onClick={() => setShowAllOptional((v) => !v)}
              className="mt-2 text-[11px] text-slate-400 hover:text-[#1F7A63] transition-colors w-full text-center"
            >
              {showAllOptional
                ? "Show less"
                : `Show all ${optionalFacts.length} additional facts`}
            </button>
          )}
        </div>
      )}

      {/* ── Calculated metrics ──────────────────────────────────────────── */}
      <CalculatedMetricsSection
        factDefs={factDefinitions}
        factValues={effectiveValues}
      />

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
          onSaved={(updated) => {
            setLocalOverrides((prev) => {
              const next = new Map(prev);
              next.set(updated.fact_definition_id, updated);
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
