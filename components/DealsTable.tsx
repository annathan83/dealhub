"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Deal, DealStatus } from "@/types";
import StatusSelect from "./StatusSelect";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  due_diligence: "Due Diligence",
  offer: "Offer",
  closed: "Closed",
  passed: "Passed",
};

const ALL_STATUSES: DealStatus[] = [
  "new", "reviewing", "due_diligence", "offer", "closed", "passed",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

/** Muted dash for missing values — intentional, not broken */
function Dash() {
  return <span className="text-slate-200 select-none">–</span>;
}

export default function DealsTable({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DealStatus | "all">("all");

  const filtered = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        search.trim() === "" ||
        deal.name.toLowerCase().includes(search.toLowerCase()) ||
        deal.industry?.toLowerCase().includes(search.toLowerCase()) ||
        deal.location?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || deal.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [deals, search, statusFilter]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DealStatus | "all")}
          className="py-1.5 pl-2.5 pr-7 text-xs rounded-md border border-slate-200 bg-white text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        >
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {(search || statusFilter !== "all") && (
          <span className="text-xs text-slate-400 whitespace-nowrap self-center tabular-nums">
            {filtered.length} / {deals.length}
          </span>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-100 bg-white py-12 text-center">
          <p className="text-xs text-slate-400">
            {deals.length === 0
              ? "No deals yet. Create your first deal to get started."
              : "No deals match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-100 bg-white overflow-x-auto">
          <table className="w-full min-w-[780px] text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-3 py-2 font-medium text-slate-400 tracking-wide w-[30%]">
                  Deal
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-400 tracking-wide">
                  Ask
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-400 tracking-wide">
                  SDE
                </th>
                <th className="text-right px-3 py-2 font-medium text-slate-400 tracking-wide">
                  Mult.
                </th>
                <th className="text-left px-3 py-2 font-medium text-slate-400 tracking-wide">
                  Industry
                </th>
                <th className="text-left px-3 py-2 font-medium text-slate-400 tracking-wide">
                  Status
                </th>
                <th className="text-left px-3 py-2 font-medium text-slate-400 tracking-wide whitespace-nowrap">
                  Added
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((deal, i) => (
                <tr
                  key={deal.id}
                  onClick={() => router.push(`/deals/${deal.id}`)}
                  className={`cursor-pointer group transition-colors hover:bg-indigo-50/40 ${
                    i !== filtered.length - 1 ? "border-b border-slate-50" : ""
                  }`}
                >
                  {/* Deal name + location */}
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-slate-800 group-hover:text-indigo-700 transition-colors leading-snug">
                      {deal.name}
                    </span>
                    {deal.location && (
                      <p className="text-slate-400 mt-0.5 truncate max-w-[200px] leading-none">
                        {deal.location}
                      </p>
                    )}
                  </td>

                  {/* Asking Price */}
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                    {deal.asking_price ?? <Dash />}
                  </td>

                  {/* SDE */}
                  <td className="px-3 py-2.5 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                    {deal.sde ?? <Dash />}
                  </td>

                  {/* Multiple */}
                  <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums whitespace-nowrap">
                    {deal.multiple ?? <Dash />}
                  </td>

                  {/* Industry */}
                  <td className="px-3 py-2.5 text-slate-500 max-w-[120px] truncate">
                    {deal.industry ?? <Dash />}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <StatusSelect
                      dealId={deal.id}
                      currentStatus={deal.status}
                      variant="row"
                    />
                  </td>

                  {/* Created */}
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap tabular-nums">
                    {formatDate(deal.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
