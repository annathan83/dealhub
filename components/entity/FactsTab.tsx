"use client";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  financial:   "Financial",
  deal_terms:  "Deal Terms",
  operations:  "Operations",
  people:      "People",
  real_estate: "Real Estate",
};

const CATEGORY_ORDER = ["financial", "deal_terms", "operations", "people", "real_estate"];

const STATUS_CONFIG: Record<FactValueStatus, { label: string; classes: string; dot: string }> = {
  confirmed:   { label: "Confirmed",   classes: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  estimated:   { label: "Estimated",   classes: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-400"   },
  unclear:     { label: "Unclear",     classes: "bg-amber-50 text-amber-700 border-amber-200",        dot: "bg-amber-400"  },
  conflicting: { label: "Conflicting", classes: "bg-red-50 text-red-700 border-red-200",              dot: "bg-red-500"    },
  missing:     { label: "Missing",     classes: "bg-slate-50 text-slate-500 border-slate-200",        dot: "bg-slate-300"  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status, isManual }: { status: FactValueStatus; isManual?: boolean }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {isManual && (
        <span className="ml-0.5 text-[10px] opacity-70" title="Manually confirmed or edited">✎</span>
      )}
    </span>
  );
}

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
    if (!isNaN(n)) return `${(n * 100).toFixed(1)}%`;
  }
  if (dataType === "boolean") {
    return raw.toLowerCase() === "true" ? "Yes" : "No";
  }
  return raw;
}

// ─── Derived metrics strip ────────────────────────────────────────────────────

function DerivedMetricsStrip({
  factDefs,
  factValues,
}: {
  factDefs: FactDefinition[];
  factValues: EntityFactValue[];
}) {
  const metrics = computeDerivedMetrics(factValues, factDefs);
  const items = Object.values(metrics);

  if (!items.some((m) => m.available)) return null;

  return (
    <div className="mb-6 bg-[#F0FAF7] border border-[#C6E8DF] rounded-xl px-4 py-3">
      <div className="text-[10px] font-bold text-[#1F7A63] uppercase tracking-widest mb-2">
        Derived Metrics
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((m) => (
          <div key={m.key}>
            <div className="text-[11px] text-[#3B8F78] mb-0.5">{m.label}</div>
            <div className={`text-base font-bold tabular-nums ${m.available ? "text-[#1E1E1E]" : "text-slate-300"}`}>
              {m.formatted}
            </div>
            <div className="text-[10px] text-slate-400">{m.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Key metric cards ─────────────────────────────────────────────────────────

const KEY_METRIC_KEYS = ["asking_price", "revenue_latest", "sde_latest", "ebitda_latest"];

function KeyMetricCards({
  factDefs,
  valueMap,
}: {
  factDefs: FactDefinition[];
  valueMap: Map<string, EntityFactValue>;
}) {
  const metrics = KEY_METRIC_KEYS
    .map((key) => factDefs.find((fd) => fd.key === key))
    .filter((fd): fd is FactDefinition => !!fd);

  if (metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {metrics.map((fd) => {
        const val = valueMap.get(fd.id);
        const status: FactValueStatus = val?.status ?? "missing";
        return (
          <div key={fd.key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">{fd.label}</div>
            <div className={`text-lg font-bold ${status === "missing" ? "text-slate-300" : "text-slate-800"}`}>
              {formatValue(val?.value_raw ?? null, fd.data_type)}
            </div>
            <div className="mt-1.5">
              <StatusPill status={status} isManual={val?.value_source_type === "user_override"} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Missing critical facts ───────────────────────────────────────────────────

function MissingCriticalFacts({ missingFacts }: { missingFacts: FactDefinition[] }) {
  if (missingFacts.length === 0) return null;
  return (
    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm font-semibold text-amber-800">
          {missingFacts.length} critical fact{missingFacts.length !== 1 ? "s" : ""} missing
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {missingFacts.map((fd) => (
          <span key={fd.key} className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-lg font-medium">
            {fd.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Inline edit drawer ───────────────────────────────────────────────────────

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
    val?.status === "missing" ? "edit" : "confirm"
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
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
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Current extracted value (if any) */}
          {val && val.status !== "missing" && (
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
              <div className="text-[11px] text-slate-400 mb-1">Current value</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-700">{formatValue(val.value_raw, fd.data_type)}</span>
                <StatusPill status={val.status} isManual={val.value_source_type === "user_override"} />
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
                { type: "confirm",       label: "Confirm",        desc: "Value is correct" },
                { type: "edit",          label: "Edit",           desc: "Update the value" },
                { type: "override",      label: "Override",       desc: "Replace with my value" },
                { type: "mark_conflict", label: "Mark Conflict",  desc: "Values disagree" },
                { type: "mark_missing",  label: "Mark Missing",   desc: "This fact is absent" },
              ] as { type: FactChangeType; label: string; desc: string }[]).map(({ type, label, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChangeType(type)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    changeType === type
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Value input (not shown for confirm/mark actions) */}
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
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
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
              placeholder={`e.g. "Broker confirmed on call" or "From amended lease"`}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
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
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Fact row ─────────────────────────────────────────────────────────────────

type FactRowProps = {
  fd: FactDefinition;
  val: EntityFactValue | undefined;
  evidence: FactEvidence | null;
  sourceName: string | null;
  dealId: string;
  onEdit: () => void;
};

function FactRow({ fd, val, evidence, sourceName, dealId, onEdit }: FactRowProps) {
  const status: FactValueStatus = val?.status ?? "missing";
  const isManual = val?.value_source_type === "user_override";

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      {/* Fact label */}
      <td className="px-4 py-3 w-2/5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700 text-sm">{fd.label}</span>
          {fd.is_critical && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Critical fact" />
          )}
        </div>
        {fd.description && (
          <div className="text-[11px] text-slate-400 mt-0.5">{fd.description}</div>
        )}
      </td>

      {/* Value + status */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium tabular-nums text-sm ${status === "missing" ? "text-slate-300" : "text-slate-800"}`}>
            {formatValue(val?.value_raw ?? null, fd.data_type)}
          </span>
          <StatusPill status={status} isManual={isManual} />
        </div>
        {val?.confidence !== null && val?.confidence !== undefined && (
          <div className="text-[10px] text-slate-400 mt-0.5">
            {Math.round(val.confidence * 100)}% confidence
          </div>
        )}
        {val?.change_reason && (
          <div className="text-[10px] text-indigo-500 mt-0.5 italic">
            &ldquo;{val.change_reason}&rdquo;
          </div>
        )}
      </td>

      {/* Source */}
      <td className="px-4 py-3 hidden sm:table-cell">
        {sourceName ? (
          <div className="flex items-center gap-1 max-w-[160px]">
            <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] text-slate-400 truncate" title={sourceName}>
              {sourceName}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-200">—</span>
        )}
        {evidence?.snippet && (
          <div className="text-[10px] text-slate-400 mt-0.5 italic line-clamp-1 max-w-[160px]" title={evidence.snippet}>
            &ldquo;{evidence.snippet}&rdquo;
          </div>
        )}
      </td>

      {/* Edit action */}
      <td className="px-3 py-3 w-10">
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Edit fact"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FactsTab({ factDefinitions, factValues, factEvidence, files, dealId }: Props) {
  const [filter, setFilter] = useState<"all" | "confirmed" | "missing" | "conflicting">("all");
  const [editingFact, setEditingFact] = useState<FactDefinition | null>(null);
  // Local overrides: track fact values updated in this session without a full page reload
  const [localOverrides, setLocalOverrides] = useState<Map<string, EntityFactValue>>(new Map());

  // Merge server values with local overrides
  const effectiveValues = [...factValues];
  for (const [factDefId, override] of localOverrides) {
    const idx = effectiveValues.findIndex((v) => v.fact_definition_id === factDefId);
    if (idx >= 0) {
      effectiveValues[idx] = override;
    } else {
      effectiveValues.push(override);
    }
  }

  const valueMap = new Map<string, EntityFactValue>();
  for (const v of effectiveValues) {
    valueMap.set(v.fact_definition_id, v);
  }

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
  for (const f of files) {
    fileNameMap.set(f.id, f.file_name ?? "Unknown file");
  }

  const missingCritical = factDefinitions.filter((fd) => {
    if (!fd.is_critical) return false;
    const val = valueMap.get(fd.id);
    return !val || val.status === "missing" || val.status === "unclear";
  });

  const filteredDefs = factDefinitions.filter((fd) => {
    if (filter === "all") return true;
    const val = valueMap.get(fd.id);
    const status: FactValueStatus = val?.status ?? "missing";
    if (filter === "confirmed") return status === "confirmed" || status === "estimated";
    if (filter === "missing") return status === "missing" || status === "unclear";
    if (filter === "conflicting") return status === "conflicting";
    return true;
  });

  const filteredByCategory = new Map<string, FactDefinition[]>();
  for (const fd of filteredDefs) {
    const cat = fd.category ?? "other";
    const list = filteredByCategory.get(cat) ?? [];
    list.push(fd);
    filteredByCategory.set(cat, list);
  }

  const orderedCategories = CATEGORY_ORDER.filter((c) => filteredByCategory.has(c));

  const editingVal = editingFact ? valueMap.get(editingFact.id) : undefined;
  const editingEvidence = editingFact ? (evidenceMap.get(editingFact.id) ?? null) : null;
  const editingSource = editingEvidence?.file_id ? (fileNameMap.get(editingEvidence.file_id) ?? null) : null;

  // Count by status for filter badges
  const counts = { confirmed: 0, missing: 0, conflicting: 0 };
  for (const fd of factDefinitions) {
    const status = valueMap.get(fd.id)?.status ?? "missing";
    if (status === "confirmed" || status === "estimated") counts.confirmed++;
    else if (status === "missing" || status === "unclear") counts.missing++;
    else if (status === "conflicting") counts.conflicting++;
  }

  return (
    <div>
      <DerivedMetricsStrip factDefs={factDefinitions} factValues={effectiveValues} />
      <KeyMetricCards factDefs={factDefinitions} valueMap={valueMap} />
      <MissingCriticalFacts missingFacts={missingCritical} />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([
          { key: "all",         label: "All facts",   count: factDefinitions.length },
          { key: "confirmed",   label: "Confirmed",   count: counts.confirmed },
          { key: "missing",     label: "Missing",     count: counts.missing },
          { key: "conflicting", label: "Conflicts",   count: counts.conflicting },
        ] as { key: typeof filter; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              filter === key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              filter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              {count}
            </span>
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Hover a row to edit
        </span>
      </div>

      {/* Facts table by category */}
      {orderedCategories.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No facts match this filter.
        </div>
      ) : (
        <div className="space-y-6">
          {orderedCategories.map((cat) => {
            const catFacts = filteredByCategory.get(cat) ?? [];
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h3>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {catFacts.map((fd) => {
                        const val = valueMap.get(fd.id);
                        const evidence = val?.current_evidence_id ? evidenceMap.get(fd.id) ?? null : null;
                        const sourceName = evidence?.file_id ? fileNameMap.get(evidence.file_id) ?? null : null;
                        return (
                          <FactRow
                            key={fd.id}
                            fd={fd}
                            val={val}
                            evidence={evidence}
                            sourceName={sourceName}
                            dealId={dealId}
                            onEdit={() => setEditingFact(fd)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {factDefinitions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 text-sm">
            No facts have been extracted yet. Upload a document or paste text to start.
          </div>
        </div>
      )}

      {/* Edit drawer */}
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
