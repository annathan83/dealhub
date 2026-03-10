"use client";

/**
 * FactsTab
 *
 * The structured score-input sheet for a deal.
 * Architecture:
 *   1. Summary cards  — the 5 key scoring inputs at a glance
 *   2. Missing facts  — only scoring-relevant gaps, red-tinted
 *   3. Core scoring facts — ordered by KPI weight, editable rows with weight badge
 *   4. Optional facts — secondary facts the user can review/edit
 *   5. Calculated metrics — derived values, visually distinct, read-only
 */

import { useState, useTransition } from "react";
import type {
  FactDefinition,
  EntityFactValue,
  FactValueStatus,
  FactEvidence,
  EntityFileWithText,
  FactChangeType,
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
// Ordered by KPI weight (highest first). These are the facts that drive scoring.
// Each entry maps a fact key → the KPI(s) it feeds and its display weight.

type ScoringFactMeta = {
  key: string;
  kpiLabel: string;       // which KPI this primarily feeds
  weight: number;         // KPI weight (0–1) for display
  weightLabel: string;    // e.g. "12%"
};

const SCORING_FACTS: ScoringFactMeta[] = [
  { key: "sde_latest",      kpiLabel: "SDE / EBITDA",     weight: 0.12, weightLabel: "12%" },
  { key: "asking_price",    kpiLabel: "Price Multiple",   weight: 0.12, weightLabel: "12%" },
  { key: "revenue_latest",  kpiLabel: "Revenue",          weight: 0.10, weightLabel: "10%" },
  { key: "employees_ft",    kpiLabel: "Management Depth", weight: 0.07, weightLabel: "7%"  },
  { key: "years_in_business", kpiLabel: "Stability",      weight: 0.05, weightLabel: "5%"  },
];

// Fact keys that are DERIVED (not editable raw inputs)
const DERIVED_KEYS = new Set(["purchase_multiple", "sde_margin", "revenue_per_employee", "sde_per_employee"]);

// Fact keys that are "optional" — shown in a secondary section
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
  "years_in_business",
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
  if (dataType === "boolean") {
    return raw.toLowerCase() === "true" ? "Yes" : "No";
  }
  return raw;
}

function isMissing(val: EntityFactValue | undefined): boolean {
  return !val || val.status === "missing" || val.status === "unclear";
}

function isFilled(val: EntityFactValue | undefined): boolean {
  return !!val && val.status !== "missing" && val.status !== "unclear";
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status, isManual }: { status: FactValueStatus; isManual?: boolean }) {
  const cfg: Record<FactValueStatus, { dot: string; label: string }> = {
    confirmed:   { dot: "bg-emerald-500", label: "Confirmed" },
    estimated:   { dot: "bg-blue-400",    label: "Estimated" },
    unclear:     { dot: "bg-amber-400",   label: "Unclear"   },
    conflicting: { dot: "bg-red-500",     label: "Conflict"  },
    missing:     { dot: "bg-slate-200",   label: "Missing"   },
  };
  const c = cfg[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
      {isManual && <span className="text-[10px] opacity-60" title="Manually set">✎</span>}
    </span>
  );
}

// ─── Weight badge ─────────────────────────────────────────────────────────────

function WeightBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 tabular-nums">
      {label}
    </span>
  );
}

// ─── Edit drawer ──────────────────────────────────────────────────────────────

type EditDrawerProps = {
  fd: FactDefinition;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  dealId: string;
  onClose: () => void;
  onSaved: (updated: EntityFactValue) => void;
};

function EditDrawer({ fd, val, evidence, sourceName, dealId, onClose, onSaved }: EditDrawerProps) {
  const [changeType, setChangeType] = useState<FactChangeType>(
    isMissing(val) ? "edit" : "confirm"
  );
  const [newValue, setNewValue] = useState(val?.value_raw ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isMarkAction = changeType === "mark_conflict" || changeType === "mark_missing";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isMarkAction && changeType !== "confirm" && !newValue.trim()) {
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
            value_raw: isMarkAction ? null : (changeType === "confirm" ? (val?.value_raw ?? null) : newValue.trim() || null),
            note: note.trim() || null,
            old_value: val?.value_raw ?? null,
            old_status: val?.status ?? null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to save.");
          return;
        }
        const data = await res.json();
        onSaved(data.fact as EntityFactValue);
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
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="font-semibold text-slate-800 text-sm">{fd.label}</div>
            {fd.description && (
              <div className="text-[11px] text-slate-400 mt-0.5">{fd.description}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Current extracted value */}
          {val && val.status !== "missing" && (
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
              <div className="text-[11px] text-slate-400 mb-1">Current value</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-700">{formatValue(val.value_raw, fd.data_type)}</span>
                <StatusDot status={val.status} isManual={val.value_source_type === "user_override"} />
              </div>
              {evidence?.snippet && (
                <div className="mt-1.5 text-[11px] text-slate-400 italic">
                  &ldquo;{evidence.snippet.slice(0, 120)}&rdquo;
                  {sourceName && <span className="not-italic ml-1">— {sourceName}</span>}
                </div>
              )}
              {val.confidence !== null && (
                <div className="mt-1 text-[10px] text-slate-400">{Math.round(val.confidence * 100)}% confidence</div>
              )}
            </div>
          )}

          {/* Action selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Action</label>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { type: "confirm",       label: "Confirm",       desc: "Value is correct" },
                { type: "edit",          label: "Edit",          desc: "Update the value" },
                { type: "override",      label: "Override",      desc: "Replace with my value" },
                { type: "mark_conflict", label: "Mark Conflict", desc: "Values disagree" },
                { type: "mark_missing",  label: "Mark Missing",  desc: "This fact is absent" },
              ] as { type: FactChangeType; label: string; desc: string }[]).map(({ type, label, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChangeType(type)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    changeType === type
                      ? "bg-[#F0FAF7] border-[#1F7A63] text-[#1F7A63]"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Value input */}
          {!isMarkAction && changeType !== "confirm" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                New value
                <span className="text-slate-400 font-normal ml-1">({fd.data_type})</span>
              </label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={
                  fd.data_type === "currency" ? "e.g. 450000 or 450K or 1.2M"
                  : fd.data_type === "percent" ? "e.g. 0.25 or 25"
                  : fd.data_type === "boolean" ? "true or false"
                  : "Enter value"
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63]"
                autoFocus
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`e.g. "Broker confirmed on call"`}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63]"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#1F7A63] rounded-lg hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────
// Top 5 scoring inputs shown as compact cards

const SUMMARY_CARD_KEYS = ["asking_price", "sde_latest", "revenue_latest", "employees_ft", "years_in_business"];

function SummaryCards({
  factDefs,
  valueMap,
  onEdit,
}: {
  factDefs: FactDefinition[];
  valueMap: Map<string, EntityFactValue>;
  onEdit: (fd: FactDefinition) => void;
}) {
  const cards = SUMMARY_CARD_KEYS
    .map((key) => factDefs.find((fd) => fd.key === key))
    .filter((fd): fd is FactDefinition => !!fd);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
      {cards.map((fd) => {
        const val = valueMap.get(fd.id);
        const filled = isFilled(val);
        const isManual = val?.value_source_type === "user_override";

        return (
          <button
            key={fd.key}
            type="button"
            onClick={() => onEdit(fd)}
            className={`text-left rounded-xl border p-3.5 transition-all group ${
              filled
                ? "bg-white border-slate-200 hover:border-[#1F7A63]/40 hover:shadow-sm"
                : "bg-red-50/60 border-red-200 hover:border-red-300"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500 font-medium">{fd.label}</span>
              <svg
                className={`w-3 h-3 transition-opacity ${filled ? "text-slate-300 group-hover:text-[#1F7A63]" : "text-red-300"}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className={`text-base font-bold tabular-nums leading-tight ${filled ? "text-slate-800" : "text-red-400"}`}>
              {filled ? formatValue(val!.value_raw, fd.data_type) : "Missing"}
            </div>
            {filled && (
              <div className="mt-1">
                <StatusDot status={val!.status} isManual={isManual} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Missing facts banner ─────────────────────────────────────────────────────

function MissingFactsBanner({
  missingFacts,
  onEdit,
}: {
  missingFacts: { fd: FactDefinition; meta: ScoringFactMeta }[];
  onEdit: (fd: FactDefinition) => void;
}) {
  if (missingFacts.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="text-xs font-semibold text-red-700">
          {missingFacts.length} scoring fact{missingFacts.length !== 1 ? "s" : ""} still needed
        </span>
        <span className="text-[11px] text-red-400 ml-auto">Tap to fill in</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {missingFacts.map(({ fd }) => (
          <button
            key={fd.key}
            type="button"
            onClick={() => onEdit(fd)}
            className="px-2.5 py-1 bg-white border border-red-200 text-red-600 text-xs rounded-lg font-medium hover:bg-red-100 transition-colors"
          >
            + {fd.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Scoring fact row ─────────────────────────────────────────────────────────

function ScoringFactRow({
  fd,
  val,
  meta,
  evidence,
  sourceName,
  onEdit,
}: {
  fd: FactDefinition;
  val: EntityFactValue | undefined;
  meta: ScoringFactMeta;
  evidence: FactEvidence | null;
  sourceName: string | null;
  onEdit: () => void;
}) {
  const filled = isFilled(val);
  const isManual = val?.value_source_type === "user_override";
  const status: FactValueStatus = val?.status ?? "missing";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 group cursor-pointer transition-colors ${
        filled ? "hover:bg-slate-50" : "bg-red-50/40 hover:bg-red-50"
      }`}
      onClick={onEdit}
    >
      {/* Status indicator */}
      <div className="w-1.5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${
          filled
            ? status === "confirmed" ? "bg-emerald-500"
              : status === "estimated" ? "bg-blue-400"
              : status === "conflicting" ? "bg-red-500"
              : "bg-amber-400"
            : "bg-red-300"
        }`} />
      </div>

      {/* Fact name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 truncate">{fd.label}</span>
          <span className="text-[10px] text-slate-400 hidden sm:inline shrink-0">{meta.kpiLabel}</span>
        </div>
        {filled && sourceName && (
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            from {sourceName}
          </div>
        )}
        {filled && val?.change_reason && (
          <div className="text-[10px] text-[#1F7A63] mt-0.5 italic truncate">&ldquo;{val.change_reason}&rdquo;</div>
        )}
      </div>

      {/* Value */}
      <div className="text-right shrink-0">
        {filled ? (
          <>
            <div className="text-sm font-semibold text-slate-800 tabular-nums">
              {formatValue(val!.value_raw, fd.data_type)}
            </div>
            <div className="mt-0.5">
              <StatusDot status={status} isManual={isManual} />
            </div>
          </>
        ) : (
          <span className="text-xs text-red-400 font-medium">Missing</span>
        )}
      </div>

      {/* Weight badge */}
      <div className="shrink-0 hidden sm:block">
        <WeightBadge label={meta.weightLabel} />
      </div>

      {/* Edit chevron */}
      <svg
        className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
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
      <div className="w-1.5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${filled ? "bg-emerald-400" : "bg-slate-200"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-600 truncate">{fd.label}</span>
        {filled && sourceName && (
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">from {sourceName}</div>
        )}
      </div>

      <div className="text-right shrink-0">
        {filled ? (
          <div className="text-sm font-medium text-slate-700 tabular-nums">
            {formatValue(val!.value_raw, fd.data_type)}
          </div>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>

      {filled && (
        <div className="shrink-0 hidden sm:block">
          <StatusDot status={status} isManual={isManual} />
        </div>
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

// ─── Calculated metrics section ───────────────────────────────────────────────

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
        <span className="text-[10px] text-slate-300 shrink-0">auto-computed from facts above</span>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {items.map((m, i) => (
          <div
            key={m.key}
            className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            {/* Fx badge */}
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

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{label}</p>
      <div className="flex-1 h-px bg-slate-100" />
      {count !== undefined && (
        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{count}</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FactsTab({ factDefinitions, factValues, factEvidence, files, dealId }: Props) {
  const [editingFact, setEditingFact] = useState<FactDefinition | null>(null);
  const [showAllOptional, setShowAllOptional] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Map<string, EntityFactValue>>(new Map());

  // Merge server values with local overrides
  const effectiveValues = [...factValues];
  for (const [factDefId, override] of localOverrides) {
    const idx = effectiveValues.findIndex((v) => v.fact_definition_id === factDefId);
    if (idx >= 0) effectiveValues[idx] = override;
    else effectiveValues.push(override);
  }

  const valueMap = new Map<string, EntityFactValue>();
  for (const v of effectiveValues) valueMap.set(v.fact_definition_id, v);

  // Best non-superseded evidence per fact_definition_id
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

  // Build scoring facts with their definitions
  const scoringFacts = SCORING_FACTS.flatMap((meta) => {
    const fd = factDefinitions.find((d) => d.key === meta.key);
    if (!fd) return [];
    return [{ fd, meta }];
  });

  // Missing scoring facts
  const missingScoringFacts = scoringFacts.filter(({ fd }) => isMissing(valueMap.get(fd.id)));

  // Optional facts (exclude scoring keys and derived keys)
  const scoringKeys = new Set(SCORING_FACTS.map((m) => m.key));
  const optionalFacts = OPTIONAL_FACT_KEYS
    .filter((key) => !scoringKeys.has(key) && !DERIVED_KEYS.has(key))
    .flatMap((key) => {
      const fd = factDefinitions.find((d) => d.key === key);
      return fd ? [fd] : [];
    });

  const OPTIONAL_INITIAL = 5;
  const visibleOptional = showAllOptional ? optionalFacts : optionalFacts.slice(0, OPTIONAL_INITIAL);

  const editingVal = editingFact ? valueMap.get(editingFact.id) : undefined;
  const editingEvidence = editingFact ? (evidenceMap.get(editingFact.id) ?? null) : null;
  const editingSource = editingEvidence?.file_id ? (fileNameMap.get(editingEvidence.file_id) ?? null) : null;

  const filledCount = scoringFacts.filter(({ fd }) => isFilled(valueMap.get(fd.id))).length;

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

      {/* ── Coverage indicator ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Score Input Sheet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filledCount} of {scoringFacts.length} scoring facts filled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                filledCount === scoringFacts.length ? "bg-emerald-500"
                : filledCount >= scoringFacts.length / 2 ? "bg-amber-400"
                : "bg-red-400"
              }`}
              style={{ width: `${scoringFacts.length > 0 ? (filledCount / scoringFacts.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {scoringFacts.length > 0 ? Math.round((filledCount / scoringFacts.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <SummaryCards
        factDefs={factDefinitions}
        valueMap={valueMap}
        onEdit={setEditingFact}
      />

      {/* ── Missing facts banner ───────────────────────────────────────── */}
      <MissingFactsBanner
        missingFacts={missingScoringFacts}
        onEdit={setEditingFact}
      />

      {/* ── Core scoring facts ─────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionLabel
          label="Core Scoring Facts"
          count={scoringFacts.length}
        />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Column header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
            <div className="w-1.5 shrink-0" />
            <div className="flex-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Fact</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right shrink-0">Value</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 hidden sm:block w-10 text-right">Weight</div>
            <div className="w-3.5 shrink-0" />
          </div>

          {scoringFacts.map(({ fd, meta }) => {
            const val = valueMap.get(fd.id);
            const evidence = evidenceMap.get(fd.id) ?? null;
            const sourceName = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
            return (
              <ScoringFactRow
                key={fd.id}
                fd={fd}
                val={val}
                meta={meta}
                evidence={evidence}
                sourceName={sourceName}
                onEdit={() => setEditingFact(fd)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Optional facts ─────────────────────────────────────────────── */}
      {optionalFacts.length > 0 && (
        <div className="mb-5">
          <SectionLabel label="Additional Facts" count={optionalFacts.length} />
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

      {/* ── Calculated metrics ─────────────────────────────────────────── */}
      <CalculatedMetricsSection
        factDefs={factDefinitions}
        factValues={effectiveValues}
      />

      {/* ── Edit drawer ────────────────────────────────────────────────── */}
      {editingFact && (
        <EditDrawer
          fd={editingFact}
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
