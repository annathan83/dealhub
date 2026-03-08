"use client";

import { useState } from "react";
import type { Deal } from "@/types";
import StatusSelect from "./StatusSelect";
import EditDealModal from "./EditDealModal";

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

function KpiCard({
  label,
  value,
  icon,
  empty,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  empty?: boolean;
  accent?: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 min-w-[140px] flex-1 transition-shadow hover:shadow-md ${empty ? "border-slate-100 bg-white" : "border-slate-100 bg-white shadow-sm"}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${empty ? "bg-slate-50" : (accent ?? "bg-indigo-50")}`}>
        <span className={empty ? "text-slate-300" : ""}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className={`text-base font-bold tabular-nums leading-none ${empty ? "text-slate-300" : "text-slate-800"}`}>{value}</p>
      </div>
    </div>
  );
}

export default function DealHeader({ deal }: { deal: Deal }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-5 py-4 mb-5">
        {/* Row 1: Name + Status + Edit */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight truncate">
              {deal.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
              {deal.industry && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {deal.industry}
                </span>
              )}
              {deal.location && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {deal.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Added {formatDate(deal.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusSelect dealId={deal.id} currentStatus={deal.status} variant="badge" />
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="flex flex-wrap gap-3 mt-4">
          <KpiCard
            label="Asking Price"
            value={formatCurrency(deal.asking_price)}
            empty={!deal.asking_price}
            accent="bg-indigo-50"
            icon={
              <svg className="w-4.5 h-4.5 w-[18px] h-[18px] text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KpiCard
            label="SDE"
            value={formatCurrency(deal.sde)}
            empty={!deal.sde}
            accent="bg-emerald-50"
            icon={
              <svg className="w-[18px] h-[18px] text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <KpiCard
            label="Multiple"
            value={formatMultiple(deal.multiple)}
            empty={!deal.multiple}
            accent="bg-amber-50"
            icon={
              <svg className="w-[18px] h-[18px] text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>
      </div>

      {editOpen && (
        <EditDealModal deal={deal} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
