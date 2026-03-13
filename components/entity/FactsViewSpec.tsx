"use client";

/**
 * FactsViewSpec — Facts view per cursor-prompt-facts-view spec
 *
 * Three sections: Deal Context (compact), Core Facts (4 inputs + 3 calculated),
 * Other Extracted Facts (collapsible). No verified/AI/manual badges; source link = trust.
 * Score badge 0–10 with Strong / Partial / Weak Fit.
 */

import { useState, useMemo } from "react";
import type {
  FactDefinition,
  EntityFactValue,
  FactEvidence,
  EntityFileWithText,
} from "@/types/entity";
import { computeDerivedMetrics } from "@/lib/kpi/derivedMetricsService";

// ─── Spec Fact shape ───────────────────────────────────────────────────────────

export type FactSource = {
  documentId: string;
  documentName: string;
  page: number | null;
  highlight: string;
};

export type SpecFact = {
  id: string;
  label: string;
  value: string | null;
  source: FactSource | null;
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  factDefinitions: FactDefinition[];
  factValues: EntityFactValue[];
  factEvidence: FactEvidence[];
  files: EntityFileWithText[];
  dealId: string;
  overallScore: number | null;
  onViewSourceInWorkspace?: (fileId: string) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEAL_CONTEXT_KEYS = ["industry", "location", "owner_hours_per_week", "owner_dependence_level"];
const CORE_INPUT_KEYS = ["asking_price", "revenue_latest", "sde_latest", "employees_ft"];

function formatValue(raw: string | null, dataType: string): string {
  if (!raw) return "—";
  if (dataType === "currency") {
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (!isNaN(n)) {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
      if (n >= 1_000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

function formatOwnerInvolvement(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase();
  if (lower.includes("absentee") || lower.includes("absent")) return "Absentee";
  if (lower.includes("part") || lower.includes("part-time")) return "Part-time";
  if (lower.includes("full") || lower.includes("operational")) return "Full-time, operational";
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (!isNaN(n)) {
    if (n >= 40) return "Full-time, operational";
    if (n >= 10) return "Part-time";
    return "Absentee";
  }
  return raw;
}

// ─── Build spec facts from entity data ─────────────────────────────────────────

function buildSpecFact(
  fd: FactDefinition,
  val: EntityFactValue | undefined,
  evidence: FactEvidence | null,
  fileMap: Map<string, EntityFileWithText>,
  format: (raw: string | null, dataType: string) => string = formatValue
): SpecFact {
  const value = val?.value_raw ?? null;
  const hasValue = value != null && value.trim() !== "" && val?.status !== "missing" && val?.status !== "unclear";
  let source: FactSource | null = null;
  if (evidence?.file_id && (evidence.snippet ?? "").trim()) {
    const file = fileMap.get(evidence.file_id);
    source = {
      documentId: evidence.file_id,
      documentName: file?.title?.trim() || file?.file_name || "Document",
      page: evidence.page_number ?? null,
      highlight: evidence.snippet ?? "",
    };
  }
  const displayValue = fd.key === "owner_hours_per_week" || fd.key === "owner_dependence_level"
    ? formatOwnerInvolvement(value)
    : format(value, fd.data_type);
  return {
    id: fd.id,
    label: fd.label,
    value: hasValue ? displayValue : null,
    source,
  };
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const rounded = Math.round(score * 10) / 10;
  const label = rounded >= 8 ? "Strong Fit" : rounded >= 6 ? "Partial Fit" : "Weak Fit";
  const bg = rounded >= 8 ? "bg-[#16a34a]" : rounded >= 6 ? "bg-[#d97706]" : "bg-[#dc2626]";
  const text = rounded >= 8 ? "text-[#16a34a]" : rounded >= 6 ? "text-[#d97706]" : "text-[#dc2626]";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-md ${bg} text-white text-sm font-bold font-mono`}
        aria-hidden
      >
        {rounded}
      </span>
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${text}`}>{label}</span>
    </div>
  );
}

// ─── Deal Context block (compact) ──────────────────────────────────────────────

function DealContextBlock({
  facts,
  onViewSource,
}: {
  facts: SpecFact[];
  onViewSource?: (documentId: string) => void;
}) {
  if (facts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 border-b border-slate-200">
      {facts.map((f) => (
        <div key={f.id} className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] uppercase text-[#94a3b8] tracking-[0.06em] shrink-0">{f.label}</span>
          <span className="text-sm text-slate-800 truncate">{f.value ?? "Not found"}</span>
          {f.source && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewSource?.(f.source!.documentId);
              }}
              className="shrink-0 text-[#3b82f6] p-0.5 rounded hover:bg-blue-50"
              aria-label={`View source for ${f.label}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Fact row (inputs and other facts) ────────────────────────────────────────

function FactRow({
  fact,
  onViewSource,
}: {
  fact: SpecFact;
  onViewSource?: (documentId: string) => void;
}) {
  const hasValue = fact.value != null;
  const hasSource = fact.source != null;
  const tappable = hasSource && onViewSource;

  return (
    <div
      role={tappable ? "button" : undefined}
      onClick={tappable ? () => onViewSource?.(fact.source!.documentId) : undefined}
      className={`flex items-center justify-between gap-2 h-8 min-h-[32px] px-3 border-l-[3px] rounded-r-sm margin-between-rows ${
        hasValue
          ? "border-l-[#e2e8f0] bg-white"
          : "border-l-[#fca5a5] bg-[#fef2f2]"
      } ${tappable ? "cursor-pointer hover:bg-slate-50" : ""}`}
      style={{ marginBottom: 3 }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-[9px] font-medium uppercase text-[#94a3b8] tracking-wider shrink-0 w-[105px] max-w-[105px] truncate"
          style={{ letterSpacing: "0.06em" }}
        >
          {fact.label}
        </span>
        <span className={`text-xs font-semibold text-slate-800 truncate ${!hasValue ? "italic text-slate-500" : ""}`}>
          {hasValue ? fact.value : "Not found"}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 min-w-0 max-w-[140px]">
        {hasSource ? (
          <span className="flex items-center gap-1 text-[9px] text-[#3b82f6] truncate">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate">{fact.source!.documentName}</span>
            {fact.source!.page != null && <span className="shrink-0">p.{fact.source!.page}</span>}
          </span>
        ) : (
          <span className="text-[9px] text-slate-300">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Calculated metric row (with thresholds) ───────────────────────────────────

type MetricThreshold = "green" | "amber" | "red" | "neutral";

function getMetricColor(value: number | null, key: string): MetricThreshold {
  if (value === null) return "neutral";
  if (key === "purchase_multiple") {
    if (value <= 3) return "green";
    if (value <= 4) return "amber";
    return "red";
  }
  if (key === "sde_margin") {
    if (value >= 0.25) return "green";
    if (value >= 0.15) return "amber";
    return "red";
  }
  if (key === "sde_per_employee") {
    if (value >= 60_000) return "green";
    if (value >= 40_000) return "amber";
    return "red";
  }
  return "neutral";
}

function CalculatedMetricRow({
  label,
  formula,
  formatted,
  value,
  metricKey,
}: {
  label: string;
  formula: string;
  formatted: string;
  value: number | null;
  metricKey: string;
}) {
  const threshold = getMetricColor(value, metricKey);
  const valueColor =
    threshold === "green"
      ? "text-[#16a34a]"
      : threshold === "amber"
        ? "text-[#d97706]"
        : threshold === "red"
          ? "text-[#dc2626]"
          : "text-[#cbd5e1]";

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 bg-[#f8fafc] rounded-sm">
      <div className="min-w-0">
        <span className="text-[11px] font-semibold text-slate-700">{label}</span>
        <span className="text-[9px] text-slate-400 font-mono ml-2">{formula}</span>
      </div>
      <span className={`text-[11px] font-bold font-mono shrink-0 ${valueColor}`}>{formatted}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FactsViewSpec({
  factDefinitions,
  factValues,
  factEvidence,
  files,
  overallScore,
  onViewSourceInWorkspace,
}: Props) {
  const [otherExpanded, setOtherExpanded] = useState(false);

  const fileMap = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const defMap = useMemo(() => new Map(factDefinitions.map((d) => [d.key, d])), [factDefinitions]);
  const valueMap = useMemo(() => new Map(factValues.map((v) => [v.fact_definition_id, v])), [factValues]);
  const evidenceMap = useMemo(() => {
    const m = new Map<string, FactEvidence>();
    for (const e of factEvidence) {
      if (!e.is_superseded) {
        const cur = m.get(e.fact_definition_id);
        if (!cur || (e.confidence ?? 0) > (cur.confidence ?? 0)) m.set(e.fact_definition_id, e);
      }
    }
    return m;
  }, [factEvidence]);

  const dealContextFacts = useMemo(() => {
    const industry = defMap.get("industry");
    const location = defMap.get("location");
    const ownerHours = defMap.get("owner_hours_per_week");
    const ownerDependence = defMap.get("owner_dependence_level");
    const ownerFd = ownerDependence ?? ownerHours;
    const result: SpecFact[] = [];
    if (industry) {
      const spec = buildSpecFact(industry, valueMap.get(industry.id), evidenceMap.get(industry.id) ?? null, fileMap, formatValue);
      result.push({ ...spec, label: "Industry" });
    }
    if (location) {
      const spec = buildSpecFact(location, valueMap.get(location.id), evidenceMap.get(location.id) ?? null, fileMap, formatValue);
      result.push({ ...spec, label: "Location" });
    }
    if (ownerFd) {
      const spec = buildSpecFact(ownerFd, valueMap.get(ownerFd.id), evidenceMap.get(ownerFd.id) ?? null, fileMap, formatValue);
      result.push({ ...spec, label: "Owner Involvement" });
    }
    return result;
  }, [defMap, valueMap, evidenceMap, fileMap]);

  const coreInputFacts = useMemo(() => {
    return CORE_INPUT_KEYS.map((key) => defMap.get(key)).filter(
      (fd): fd is FactDefinition => !!fd
    ).map((fd) =>
      buildSpecFact(fd, valueMap.get(fd.id), evidenceMap.get(fd.id) ?? null, fileMap, formatValue)
    );
  }, [defMap, valueMap, evidenceMap, fileMap]);

  const derived = useMemo(
    () => computeDerivedMetrics(factValues, factDefinitions),
    [factValues, factDefinitions]
  );

  const otherFacts = useMemo(() => {
    const coreAndContextKeys = new Set([
      ...DEAL_CONTEXT_KEYS,
      ...CORE_INPUT_KEYS,
      "purchase_multiple",
      "sde_margin",
      "sde_per_employee",
      "revenue_per_employee",
    ]);
    return factDefinitions
      .filter((fd) => !coreAndContextKeys.has(fd.key) && !fd.is_derived)
      .map((fd) =>
        buildSpecFact(fd, valueMap.get(fd.id), evidenceMap.get(fd.id) ?? null, fileMap, formatValue)
      )
      .filter((f) => f.value != null || f.source != null);
  }, [factDefinitions, valueMap, evidenceMap, fileMap]);

  const extractedCount = factValues.filter(
    (v) => v.value_raw != null && v.value_raw.trim() !== "" && v.status !== "missing" && v.status !== "unclear"
  ).length;

  const coreSourcedCount = coreInputFacts.filter((f) => f.source != null).length;
  const coreTotal = coreInputFacts.length;

  const scoreDisplay = overallScore !== null ? Math.round(overallScore * 10) / 10 : null;

  return (
    <div className="max-w-[480px] mx-auto font-sans">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Facts</h2>
          <p className="text-[9px] uppercase text-[#94a3b8] tracking-[0.06em] mt-0.5">
            {extractedCount} extracted from documents
          </p>
        </div>
        <ScoreBadge score={scoreDisplay} />
      </div>

      {/* Deal Context */}
      <div className="px-4">
        <DealContextBlock facts={dealContextFacts} onViewSource={onViewSourceInWorkspace} />
      </div>

      {/* Core Facts */}
      <div className="px-4 py-3">
        <p className="text-[9px] uppercase text-[#94a3b8] tracking-[0.06em] mb-2">
          Core facts · {coreSourcedCount}/{coreTotal} sourced
        </p>
        <div className="space-y-0">
          {coreInputFacts.map((f) => (
            <FactRow key={f.id} fact={f} onViewSource={onViewSourceInWorkspace} />
          ))}
        </div>

        <p className="text-[9px] uppercase text-[#94a3b8] tracking-[0.06em] mt-4 mb-2">Metrics</p>
        <div className="space-y-1">
          <CalculatedMetricRow
            label="Purchase Multiple"
            formula="Ask ÷ SDE"
            formatted={derived.purchase_multiple.formatted}
            value={derived.purchase_multiple.value}
            metricKey="purchase_multiple"
          />
          <CalculatedMetricRow
            label="SDE Margin"
            formula="SDE ÷ Revenue"
            formatted={derived.sde_margin.formatted}
            value={derived.sde_margin.value}
            metricKey="sde_margin"
          />
          <CalculatedMetricRow
            label="SDE / Employee"
            formula="SDE ÷ Employees (FT)"
            formatted={derived.sde_per_employee.formatted}
            value={derived.sde_per_employee.value}
            metricKey="sde_per_employee"
          />
        </div>
      </div>

      {/* Other Extracted Facts (collapsible) */}
      {otherFacts.length > 0 && (
        <div className="px-4 pb-6">
          <button
            type="button"
            onClick={() => setOtherExpanded((e) => !e)}
            className="w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg bg-[#f1f5f9] text-slate-700 text-sm font-medium"
          >
            <span>Other Extracted Facts ({otherFacts.length})</span>
            <svg
              className={`w-4 h-4 shrink-0 transition-transform ${otherExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {otherExpanded && (
            <div className="mt-2 space-y-0 animate-in fade-in slide-in-from-top-1 duration-200">
              {otherFacts.map((f) => (
                <FactRow key={f.id} fact={f} onViewSource={onViewSourceInWorkspace} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
