"use client";

import { useState } from "react";
import type { Deal, DealStatus } from "@/types";
import EditDealModal from "./EditDealModal";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUSES: DealStatus[] = ["active", "closed", "passed"];

const STATUS_LABELS: Record<DealStatus, string> = {
  active: "Active",
  closed: "Closed",
  passed: "Passed",
};

// Segmented control styles per option (active = selected)
const SEGMENT_ACTIVE: Record<DealStatus, string> = {
  active: "bg-indigo-600 text-white shadow-sm",
  closed: "bg-emerald-600 text-white shadow-sm",
  passed: "bg-slate-500 text-white shadow-sm",
};

const SEGMENT_INACTIVE = "text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors";

// ─── Segmented status control ─────────────────────────────────────────────────

function StatusSegmentedControl({
  dealId,
  status,
}: {
  dealId: string;
  status: DealStatus;
}) {
  const [current, setCurrent] = useState<DealStatus>(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: DealStatus) {
    if (next === current || saving) return;
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCurrent(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 transition-opacity ${saving ? "opacity-60 pointer-events-none" : ""}`}
      role="group"
      aria-label="Deal status"
    >
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => handleChange(s)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            current === s ? SEGMENT_ACTIVE[s] : SEGMENT_INACTIVE
          }`}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatCurrency(val: string | null): string {
  if (!val?.trim()) return "—";
  const s = val.trim();
  if (s.startsWith("$")) return s;
  return /^\d/.test(s) ? `$${s}` : s;
}

function formatMultiple(val: string | null): string {
  if (!val?.trim()) return "—";
  const s = val.trim();
  return /x$/i.test(s) ? s : `${s}x`;
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  empty,
  primary,
}: {
  label: string;
  value: string;
  empty: boolean;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
        {label}
      </p>
      <p
        className={`tabular-nums leading-tight ${
          empty
            ? "text-slate-300 text-sm font-medium"
            : primary
            ? "text-slate-900 text-lg font-bold"
            : "text-slate-700 text-base font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealHeader({ deal }: { deal: Deal }) {
  const [editOpen, setEditOpen] = useState(false);
  const hasAnyMetric = deal.asking_price || deal.sde || deal.multiple;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Top row: name + status + edit ───────────────────────────── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug flex-1 min-w-0">
              {deal.name}
            </h1>
            <button
              onClick={() => setEditOpen(true)}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mt-0.5"
              title="Edit deal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>

          {/* Status + metadata row */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2">
            <StatusSegmentedControl dealId={deal.id} status={deal.status} />

            {deal.industry && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {deal.industry}
              </span>
            )}
            {deal.location && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {deal.location}
              </span>
            )}
            <span className="text-xs text-slate-400">{formatDate(deal.created_at)}</span>
          </div>
        </div>

        {/* ── Metrics strip ───────────────────────────────────────────── */}
        {hasAnyMetric ? (
          <div className="border-t border-slate-100 px-4 py-3 grid grid-cols-3 gap-3">
            <MetricCell label="SDE" value={formatCurrency(deal.sde)} empty={!deal.sde} primary />
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-100" />
              <MetricCell label="Ask" value={formatCurrency(deal.asking_price)} empty={!deal.asking_price} />
            </div>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-100" />
              <MetricCell label="Multiple" value={formatMultiple(deal.multiple)} empty={!deal.multiple} />
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 px-4 py-2.5">
            <button
              onClick={() => setEditOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add asking price &amp; SDE
            </button>
          </div>
        )}
      </div>

      {editOpen && (
        <EditDealModal deal={deal} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
