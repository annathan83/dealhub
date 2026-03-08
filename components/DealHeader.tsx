"use client";

import { useState } from "react";
import type { Deal } from "@/types";
import StatusSelect from "./StatusSelect";
import EditDealModal from "./EditDealModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format currency for display — ensure $ prefix if value looks like a number */
function formatCurrency(val: string | null): string {
  if (!val?.trim()) return "—";
  const s = val.trim();
  if (s.startsWith("$")) return s;
  return /^\d/.test(s) ? `$${s}` : s;
}

/** Format multiple — ensure x suffix */
function formatMultiple(val: string | null): string {
  if (!val?.trim()) return "—";
  const s = val.trim();
  return /x$/i.test(s) ? s : `${s}x`;
}

function KpiTile({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-md border min-w-[88px] ${empty ? "border-slate-100 bg-slate-50/50" : "border-slate-100 bg-white"}`}>
      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${empty ? "text-slate-300" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

export default function DealHeader({ deal }: { deal: Deal }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <header className="mb-5">
        {/* Row 1: Name + Status + Edit */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-tight">
            {deal.name}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <StatusSelect dealId={deal.id} currentStatus={deal.status} variant="badge" />
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        {/* Row 2: Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
          {deal.industry && <span>{deal.industry}</span>}
          {deal.location && <span>{deal.location}</span>}
          <span>Added {formatDate(deal.created_at)}</span>
        </div>

        {/* Row 3: KPI strip */}
        <div className="flex flex-wrap gap-2">
          <KpiTile
            label="Asking Price"
            value={formatCurrency(deal.asking_price)}
            empty={!deal.asking_price}
          />
          <KpiTile
            label="SDE"
            value={formatCurrency(deal.sde)}
            empty={!deal.sde}
          />
          <KpiTile
            label="Multiple"
            value={formatMultiple(deal.multiple)}
            empty={!deal.multiple}
          />
        </div>
      </header>

      {editOpen && (
        <EditDealModal deal={deal} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
