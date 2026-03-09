"use client";

import { useState } from "react";
import type { Deal, DealStatus } from "@/types";
import EditDealModal from "./EditDealModal";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DealStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  due_diligence: "Due Diligence",
  offer: "Offer",
  closed: "Closed",
  passed: "Passed",
};

const STATUS_STYLES: Record<DealStatus, { badge: string; dot: string }> = {
  new:           { badge: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
  reviewing:     { badge: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  due_diligence: { badge: "bg-violet-50 text-violet-700",   dot: "bg-violet-500" },
  offer:         { badge: "bg-indigo-50 text-indigo-700",   dot: "bg-indigo-500" },
  closed:        { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  passed:        { badge: "bg-red-50 text-red-600",         dot: "bg-red-400" },
};

const STATUS_OPTIONS: DealStatus[] = [
  "new", "reviewing", "due_diligence", "offer", "closed", "passed",
];

// ─── Inline status select ─────────────────────────────────────────────────────

function InlineStatusSelect({
  dealId,
  status,
}: {
  dealId: string;
  status: DealStatus;
}) {
  const [current, setCurrent] = useState<DealStatus>(status);
  const [saving, setSaving] = useState(false);
  const style = STATUS_STYLES[current];

  async function handleChange(next: DealStatus) {
    if (next === current) return;
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
    <div className="relative inline-flex">
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value as DealStatus)}
        disabled={saving}
        className={`appearance-none cursor-pointer rounded-full pl-7 pr-7 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 disabled:opacity-60 ${style.badge}`}
        style={{ minHeight: 32 }}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      {/* Dot */}
      <span className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${style.dot}`} />
      {/* Chevron */}
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">

        {/* ── Identity block ──────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4">

          {/* Title — wraps naturally, never truncates */}
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-3">
            {deal.name}
          </h1>

          {/* Status + Edit row */}
          <div className="flex items-center gap-2 flex-wrap">
            <InlineStatusSelect dealId={deal.id} status={deal.status} />

            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              style={{ minHeight: 32 }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
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
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Added {formatDate(deal.created_at)}
            </span>
          </div>
        </div>

        {/* ── Metrics strip ───────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-5 py-4">
          {hasAnyMetric ? (
            <div className="grid grid-cols-3 gap-4">
              {/* SDE — primary (most important for buyers) */}
              <MetricCell
                label="SDE"
                value={formatCurrency(deal.sde)}
                empty={!deal.sde}
                primary
              />
              {/* Divider */}
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-100" />
                <MetricCell
                  label="Ask"
                  value={formatCurrency(deal.asking_price)}
                  empty={!deal.asking_price}
                />
              </div>
              {/* Divider */}
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-100" />
                <MetricCell
                  label="Multiple"
                  value={formatMultiple(deal.multiple)}
                  empty={!deal.multiple}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
              style={{ minHeight: 44 }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add asking price &amp; SDE
            </button>
          )}
        </div>
      </div>

      {editOpen && (
        <EditDealModal deal={deal} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
