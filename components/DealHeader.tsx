"use client";

import { useState } from "react";
import type { Deal, DealStatus, NdaState } from "@/types";
import { getNdaState } from "@/types";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import EditDealModal from "./EditDealModal";
import BrokerContactCard from "./BrokerContactCard";
import { getDealDisplayName } from "@/types";
import type { DealContact } from "@/lib/services/contacts/dealContactService";
import { formatLocation } from "@/lib/config/dealMetadata";

// ─── Fit badge (compact inline) ───────────────────────────────────────────────

function FitBadgeInline({ label }: { label: string }) {
  const color =
    label === "Good Fit" || label === "Fit"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : label === "Partial Fit"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUSES: DealStatus[] = ["active", "closed", "passed"];

const STATUS_LABELS: Record<DealStatus, string> = {
  active: "Active",
  closed: "Closed",
  passed: "Passed",
};

// Segmented control styles per option (active = selected)
const SEGMENT_ACTIVE: Record<DealStatus, string> = {
  active: "bg-[#1F7A63] text-white",
  closed: "bg-[#6B7280] text-white",
  passed: "bg-[#DC2626] text-white",
};

const SEGMENT_INACTIVE = "text-[#6B7280] hover:text-[#1E1E1E] hover:bg-[#F3F4F6] transition-colors";

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
      className={`inline-flex items-center gap-0.5 rounded-full bg-[#F3F4F6] p-0.5 transition-opacity ${saving ? "opacity-60 pointer-events-none" : ""}`}
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

/**
 * Compact currency formatter — converts raw numeric strings to readable output.
 * $120000 → $120K  |  $1200000 → $1.2M  |  $500000 → $500K
 * Passes through values that are already formatted (start with $).
 */
function formatCurrencyCompact(val: string | null): string {
  if (!val?.trim()) return "—";
  const s = val.trim();
  // Already formatted — strip $ and reformat so we can normalize
  const raw = s.replace(/[$,\s]/g, "").toUpperCase();
  const multiplier = raw.endsWith("M") ? 1_000_000 : raw.endsWith("K") ? 1_000 : 1;
  const num = parseFloat(raw.replace(/[MK]$/, ""));
  if (isNaN(num)) return s.startsWith("$") ? s : `$${s}`;
  const value = num * multiplier;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatMultipleValue(val: string | null): string {
  if (!val?.trim()) return "—";
  const s = val.trim();
  // Already has x suffix
  if (/x$/i.test(s)) return s.toLowerCase();
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return `${s}x`;
  return `${n % 1 === 0 ? n.toFixed(1) : n.toFixed(1)}x`;
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score100 }: { score100: number | null }) {
  if (score100 === null) {
    return (
      <span className="text-[#9CA3AF] text-base font-semibold tabular-nums leading-tight" title="No score yet">
        —
      </span>
    );
  }
  const display = Math.round(score100 / 10);
  const color =
    display >= 7 ? "bg-emerald-500 text-white ring-1 ring-inset ring-emerald-600/20" :
    display >= 5 ? "bg-amber-400 text-white ring-1 ring-inset ring-amber-500/20" :
                   "bg-red-500 text-white ring-1 ring-inset ring-red-600/20";
  return (
    <span className={`inline-flex items-baseline gap-0.5 rounded-full px-2.5 py-0.5 text-base font-extrabold tabular-nums leading-tight ${color}`}>
      {display}
      <span className="text-[10px] font-normal opacity-80">/10</span>
    </span>
  );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────
// Mobile-safe: label above, value below, min-w-0 on container, no fixed widths.

function MetricCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest leading-none whitespace-nowrap">
        {label}
      </p>
      <div className="min-w-0">
        {children}
      </div>
    </div>
  );
}

function MetricValue({
  value,
  empty,
  primary,
}: {
  value: string;
  empty: boolean;
  primary?: boolean;
}) {
  return (
    <p
      className={`tabular-nums leading-tight break-all min-w-0 ${
        empty
          ? "text-[#9CA3AF] text-base font-semibold"
          : primary
          ? "text-[#1E1E1E] text-lg font-extrabold"
          : "text-[#374151] text-lg font-bold"
      }`}
    >
      {value}
    </p>
  );
}

// ─── NDA badge ────────────────────────────────────────────────────────────────

const NDA_STATE_CONFIG: Record<NdaState, { label: string; className: string; icon: string }> = {
  signed: {
    label: "NDA Signed",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: "check",
  },
  review: {
    label: "NDA Review",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: "warning",
  },
  pending: {
    label: "NDA Pending",
    className: "bg-slate-100 text-slate-500 border border-slate-200",
    icon: "clock",
  },
};

function NdaBadge({
  state,
  onClick,
}: {
  state: NdaState;
  onClick?: () => void;
}) {
  const cfg = NDA_STATE_CONFIG[state];
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to update NDA status"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 ${cfg.className}`}
    >
      {cfg.icon === "check" && (
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {cfg.icon === "warning" && (
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      )}
      {cfg.icon === "clock" && (
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 6v6l4 2" />
        </svg>
      )}
      {cfg.label}
    </button>
  );
}

// ─── NDA override popover ─────────────────────────────────────────────────────

function NdaOverridePopover({
  dealId,
  currentState,
  onClose,
  onUpdated,
}: {
  dealId: string;
  currentState: NdaState;
  onClose: () => void;
  onUpdated: (signed: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSet(signed: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/nda`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed }),
      });
      if (!res.ok) throw new Error();
      onUpdated(signed);
      onClose();
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute left-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-slate-200 bg-white shadow-lg p-2 flex flex-col gap-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 pt-1 pb-0.5">
        NDA Status
      </p>
      <button
        type="button"
        disabled={saving || currentState === "signed"}
        onClick={() => handleSet(true)}
        className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-semibold text-left transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none"
      >
        <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Mark NDA Signed
      </button>
      <button
        type="button"
        disabled={saving || currentState === "pending"}
        onClick={() => handleSet(false)}
        className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-semibold text-left transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:pointer-events-none"
      >
        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Mark NDA Not Signed
      </button>
    </div>
  );
}

// BrokerContactStrip removed — replaced by BrokerContactCard component.

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealHeader({
  deal,
  kpiScorecard = null,
  buyerFitLabel = null,
  contacts = [],
}: {
  deal: Deal;
  kpiScorecard?: KpiScorecardResult | null;
  buyerFitLabel?: string | null;
  /** Structured contacts from deal_contacts table */
  contacts?: DealContact[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [ndaPopoverOpen, setNdaPopoverOpen] = useState(false);
  const [ndaOverride, setNdaOverride] = useState<boolean | null>(null);

  const hasAnyMetric = deal.asking_price || deal.sde || deal.multiple;
  const score100 = kpiScorecard?.overall_score_100 ?? null;

  // Derive NDA state — allow local override after user action
  const effectiveDeal =
    ndaOverride === null
      ? deal
      : { ...deal, nda_signed: ndaOverride, nda_signed_confidence: null };
  const ndaState = getNdaState(effectiveDeal);

  return (
    <>
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">

        {/* ── Top row: name + status + edit ───────────────────────────── */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-extrabold text-[#1E1E1E] tracking-tight leading-snug flex-1 min-w-0">
              {getDealDisplayName(deal)}
            </h1>
            <button
              onClick={() => setEditOpen(true)}
              className="shrink-0 p-1.5 rounded-lg text-[#6B7280] hover:text-[#1E1E1E] hover:bg-[#F3F4F6] transition-colors mt-0.5"
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

            {/* NDA milestone badge — separate from lifecycle status */}
            <div className="relative">
              <NdaBadge
                state={ndaState}
                onClick={() => setNdaPopoverOpen((o) => !o)}
              />
              {ndaPopoverOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setNdaPopoverOpen(false)}
                  />
                  <NdaOverridePopover
                    dealId={deal.id}
                    currentState={ndaState}
                    onClose={() => setNdaPopoverOpen(false)}
                    onUpdated={(signed) => {
                      setNdaOverride(signed);
                      setNdaPopoverOpen(false);
                    }}
                  />
                </>
              )}
            </div>

            {buyerFitLabel && <FitBadgeInline label={buyerFitLabel} />}

            {deal.industry && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {deal.industry}
              </span>
            )}
            {(formatLocation(deal.city, deal.county, deal.state) || deal.location) && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {formatLocation(deal.city, deal.county, deal.state) || deal.location}
              </span>
            )}
            <span className="text-xs text-slate-400">{formatDate(deal.created_at)}</span>
          </div>
        </div>

        {/* ── Broker contact (at top, near deal title) ─────────────────── */}
        <BrokerContactCard dealId={deal.id} initialContacts={contacts} />

        {/* ── Compact summary row: SDE · Ask · Multiple · Score (single row inside header) ── */}
        {hasAnyMetric || score100 !== null ? (
          <div className="border-t border-[#E5E7EB] px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">SDE</span> {formatCurrencyCompact(deal.sde)}
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Ask</span> {formatCurrencyCompact(deal.asking_price)}
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Multiple</span> {formatMultipleValue(deal.multiple)}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span className="font-semibold text-slate-700">Score</span>
              <ScoreBadge score100={score100} />
            </span>
          </div>
        ) : (
          <div className="border-t border-[#E5E7EB] px-4 py-2">
            <button
              onClick={() => setEditOpen(true)}
              className="text-xs text-[#6B7280] hover:text-[#1F7A63] transition-colors underline underline-offset-2"
            >
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
