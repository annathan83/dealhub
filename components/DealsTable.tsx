"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

const STATUS_BADGE: Record<DealStatus, string> = {
  new: "bg-slate-100 text-slate-600 border-slate-200",
  reviewing: "bg-blue-50 text-blue-700 border-blue-100",
  due_diligence: "bg-purple-50 text-purple-700 border-purple-100",
  offer: "bg-indigo-50 text-indigo-700 border-indigo-100",
  closed: "bg-green-50 text-green-700 border-green-100",
  passed: "bg-red-50 text-red-600 border-red-100",
};

const ALL_STATUSES: DealStatus[] = [
  "new", "reviewing", "due_diligence", "offer", "closed", "passed",
];

type SortKey = "name" | "asking_price" | "sde" | "multiple" | "status" | "created_at";
type SortDir = "asc" | "desc";

function parseNum(val: string | null): number {
  if (!val) return -Infinity;
  return parseFloat(val.replace(/[^0-9.-]/g, "")) || -Infinity;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "2-digit",
  });
}

function Dash() {
  return <span className="text-slate-300 select-none">—</span>;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex flex-col gap-px ml-1 transition-opacity ${active ? "opacity-100" : "opacity-30"}`}>
      <svg className={`w-2.5 h-2.5 ${active && dir === "asc" ? "text-indigo-600" : "text-slate-400"}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === "desc" ? "text-indigo-600" : "text-slate-400"}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}

const VALID_STATUSES: DealStatus[] = ["new", "reviewing", "due_diligence", "offer", "closed", "passed"];

export default function DealsTable({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DealStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const s = searchParams.get("status");
    if (s && (VALID_STATUSES as string[]).includes(s)) {
      setStatusFilter(s as DealStatus);
    } else {
      setStatusFilter("all");
    }
  }, [searchParams]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let list = deals.filter((deal) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        deal.name.toLowerCase().includes(q) ||
        deal.industry?.toLowerCase().includes(q) ||
        deal.location?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || deal.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "asking_price") cmp = parseNum(a.asking_price) - parseNum(b.asking_price);
      else if (sortKey === "sde") cmp = parseNum(a.sde) - parseNum(b.sde);
      else if (sortKey === "multiple") cmp = parseNum(a.multiple) - parseNum(b.multiple);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [deals, search, statusFilter, sortKey, sortDir]);

  function Th({ label, sortable, colKey, align = "left" }: { label: string; sortable?: boolean; colKey?: SortKey; align?: "left" | "right" }) {
    const isActive = sortable && sortKey === colKey;
    return (
      <th
        className={`px-4 py-3 text-xs font-semibold text-slate-500 tracking-wide whitespace-nowrap select-none ${align === "right" ? "text-right" : "text-left"} ${sortable ? "cursor-pointer hover:text-slate-800 transition-colors" : ""}`}
        onClick={sortable && colKey ? () => handleSort(colKey) : undefined}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {sortable && colKey && <SortIcon active={!!isActive} dir={sortDir} />}
        </span>
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", ...ALL_STATUSES] as (DealStatus | "all")[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                statusFilter === s
                  ? s === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : `${STATUS_BADGE[s as DealStatus]} border font-semibold shadow-sm`
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {(search || statusFilter !== "all") && (
          <span className="text-xs text-slate-400 whitespace-nowrap tabular-nums ml-auto">
            {filtered.length} of {deals.length}
          </span>
        )}
      </div>

      {/* Desktop table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-white py-16 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">
              {deals.length === 0 ? "No deals yet" : "No deals match your filters"}
            </p>
            <p className="text-xs text-slate-400">
              {deals.length === 0 ? "Track your first acquisition opportunity." : "Try adjusting your search or status filter."}
            </p>
            {deals.length === 0 && (
              <Link
                href="/deals/new"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add your first deal
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <Th label="Deal" sortable colKey="name" />
                  <Th label="Industry" />
                  <Th label="Location" />
                  <Th label="Ask" sortable colKey="asking_price" align="right" />
                  <Th label="SDE" sortable colKey="sde" align="right" />
                  <Th label="Mult." sortable colKey="multiple" align="right" />
                  <Th label="Status" sortable colKey="status" />
                  <Th label="Added" sortable colKey="created_at" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/deals/${deal.id}`)}
                    className="cursor-pointer group hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                        {deal.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {deal.industry ?? <Dash />}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">
                      {deal.location ?? <Dash />}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap text-xs">
                      {deal.asking_price ?? <Dash />}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap text-xs">
                      {deal.sde ?? <Dash />}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap text-xs">
                      {deal.multiple ?? <Dash />}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect dealId={deal.id} currentStatus={deal.status} variant="row" />
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap tabular-nums text-xs">
                      {formatDate(deal.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filtered.map((deal) => (
              <div
                key={deal.id}
                onClick={() => router.push(`/deals/${deal.id}`)}
                className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm cursor-pointer active:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{deal.name}</p>
                    {(deal.industry || deal.location) && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {[deal.industry, deal.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[deal.status]}`}>
                    {STATUS_LABELS[deal.status]}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Ask", value: deal.asking_price },
                    { label: "SDE", value: deal.sde },
                    { label: "Multiple", value: deal.multiple },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className="text-sm font-semibold text-slate-700 tabular-nums mt-0.5">{value ?? "—"}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">{formatDate(deal.created_at)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
