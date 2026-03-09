"use client";

import { useState } from "react";
import type { FactDefinition, EntityFactValue, FactValueStatus, FactEvidence, EntityFileWithText } from "@/types/entity";

type Props = {
  factDefinitions: FactDefinition[];
  factValues: EntityFactValue[];
  factEvidence: FactEvidence[];
  files: EntityFileWithText[];
};

type FactCategory = "financial" | "deal_terms" | "operations" | "people" | "real_estate";

const CATEGORY_LABELS: Record<string, string> = {
  financial: "Financial",
  deal_terms: "Deal Terms",
  operations: "Operations",
  people: "People",
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

function StatusPill({ status }: { status: FactValueStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
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

// ─── Key metric cards (critical financial facts) ──────────────────────────────

const KEY_METRIC_KEYS = ["asking_price", "revenue", "sde", "ebitda"];

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
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={fd.key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">{fd.label}</div>
            <div className={`text-lg font-bold ${status === "missing" ? "text-slate-300" : "text-slate-800"}`}>
              {formatValue(val?.value_raw ?? null, fd.data_type)}
            </div>
            <div className="mt-1.5">
              <StatusPill status={status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Missing critical facts block ─────────────────────────────────────────────

function MissingCriticalFacts({
  missingFacts,
}: {
  missingFacts: FactDefinition[];
}) {
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function FactsTab({ factDefinitions, factValues, factEvidence, files }: Props) {
  const [filter, setFilter] = useState<"all" | "confirmed" | "missing" | "conflicting">("all");

  const valueMap = new Map<string, EntityFactValue>();
  for (const v of factValues) {
    valueMap.set(v.fact_definition_id, v);
  }

  // Build evidence lookup: fact_definition_id → best (non-superseded) evidence
  const evidenceMap = new Map<string, FactEvidence>();
  for (const ev of factEvidence) {
    if (!ev.is_superseded) {
      const existing = evidenceMap.get(ev.fact_definition_id);
      if (!existing || (ev.confidence ?? 0) > (existing.confidence ?? 0)) {
        evidenceMap.set(ev.fact_definition_id, ev);
      }
    }
  }

  // Build file name lookup: entity_file_id → original_file_name
  const fileNameMap = new Map<string, string>();
  for (const f of files) {
    fileNameMap.set(f.id, f.file_name ?? "Unknown file");
  }

  const missingCritical = factDefinitions.filter((fd) => {
    if (!fd.is_critical) return false;
    const val = valueMap.get(fd.id);
    return !val || val.status === "missing" || val.status === "unclear";
  });

  // Group by category
  const byCategory = new Map<string, FactDefinition[]>();
  for (const fd of factDefinitions) {
    const cat = fd.category ?? "other";
    const list = byCategory.get(cat) ?? [];
    list.push(fd);
    byCategory.set(cat, list);
  }

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

  return (
    <div>
      <KeyMetricCards factDefs={factDefinitions} valueMap={valueMap} />
      <MissingCriticalFacts missingFacts={missingCritical} />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["all", "confirmed", "missing", "conflicting"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f === "all" ? "All facts" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {filteredDefs.length} fact{filteredDefs.length !== 1 ? "s" : ""}
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
                        const status: FactValueStatus = val?.status ?? "missing";
                        const evidence = val?.current_evidence_id
                          ? evidenceMap.get(fd.id)
                          : null;
                        const sourceName = evidence?.file_id
                          ? fileNameMap.get(evidence.file_id)
                          : null;
                        return (
                          <tr key={fd.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 w-2/5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-700">{fd.label}</span>
                                {fd.is_critical && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Critical fact" />
                                )}
                              </div>
                              {fd.description && (
                                <div className="text-[11px] text-slate-400 mt-0.5">{fd.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-medium tabular-nums ${status === "missing" ? "text-slate-300" : "text-slate-800"}`}>
                                  {formatValue(val?.value_raw ?? null, fd.data_type)}
                                </span>
                                <StatusPill status={status} />
                              </div>
                              {val?.confidence !== null && val?.confidence !== undefined && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {Math.round(val.confidence * 100)}% confidence
                                </div>
                              )}
                            </td>
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
                          </tr>
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
    </div>
  );
}
