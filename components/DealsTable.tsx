"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, DealStatus } from "@/types";
import StatusSelect from "./StatusSelect";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  due_diligence: "Due Diligence",
  offer: "Offer",
  closed: "Closed",
  passed: "Passed",
};

const STATUS_DOT: Record<DealStatus, string> = {
  new: "bg-slate-400",
  reviewing: "bg-blue-500",
  due_diligence: "bg-violet-500",
  offer: "bg-indigo-500",
  closed: "bg-emerald-500",
  passed: "bg-red-400",
};

const STATUS_BADGE: Record<DealStatus, string> = {
  new: "bg-slate-100 text-slate-600",
  reviewing: "bg-blue-50 text-blue-700",
  due_diligence: "bg-violet-50 text-violet-700",
  offer: "bg-indigo-50 text-indigo-700",
  closed: "bg-emerald-50 text-emerald-700",
  passed: "bg-red-50 text-red-600",
};

// Desktop table badge (with border)
const STATUS_BADGE_BORDER: Record<DealStatus, string> = {
  new: "bg-slate-100 text-slate-600 border-slate-200",
  reviewing: "bg-blue-50 text-blue-700 border-blue-100",
  due_diligence: "bg-violet-50 text-violet-700 border-violet-100",
  offer: "bg-indigo-50 text-indigo-700 border-indigo-100",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  passed: "bg-red-50 text-red-600 border-red-100",
};

const ALL_STATUSES: DealStatus[] = [
  "new", "reviewing", "due_diligence", "offer", "closed", "passed",
];

const VALID_STATUSES: DealStatus[] = ALL_STATUSES;

type SortKey = "name" | "asking_price" | "sde" | "multiple" | "status" | "created_at" | "updated_at";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string | null): number {
  if (!val) return -Infinity;
  return parseFloat(val.replace(/[^0-9.-]/g, "")) || -Infinity;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function Dash() {
  return <span className="text-slate-300 select-none">—</span>;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex flex-col gap-px ml-1 transition-opacity ${active ? "opacity-100" : "opacity-25"}`}>
      <svg className={`w-2.5 h-2.5 ${active && dir === "asc" ? "text-indigo-600" : "text-slate-400"}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg className={`w-2.5 h-2.5 ${active && dir === "desc" ? "text-indigo-600" : "text-slate-400"}`} viewBox="0 0 10 6" fill="currentColor">
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}

// ─── Mobile deal card ─────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const hasFinancials = deal.asking_price || deal.sde || deal.multiple;
  const meta = [deal.industry, deal.location].filter(Boolean).join(" · ");

  return (
    <div
      onClick={() => router.push(`/deals/${deal.id}`)}
      className="group bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-[0.99] active:shadow-none transition-all duration-100 cursor-pointer overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3">
        {/* Top row: name + status */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="font-semibold text-slate-900 text-[15px] leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2 flex-1 min-w-0">
            {deal.name}
          </p>
          <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[deal.status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[deal.status]}`} />
            {STATUS_LABELS[deal.status]}
          </span>
        </div>

        {/* Meta: industry · location */}
        {meta && (
          <p className="text-xs text-slate-400 truncate mb-3">{meta}</p>
        )}

        {/* Financials row */}
        {hasFinancials ? (
          <div className="flex items-center gap-4 mt-1">
            {deal.sde && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">SDE</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums leading-tight">{deal.sde}</p>
              </div>
            )}
            {deal.asking_price && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Ask</p>
                <p className="text-sm font-semibold text-slate-600 tabular-nums leading-tight">{deal.asking_price}</p>
              </div>
            )}
            {deal.multiple && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Multiple</p>
                <p className="text-sm font-semibold text-slate-600 tabular-nums leading-tight">{deal.multiple}</p>
              </div>
            )}
            <span className="ml-auto text-[11px] text-slate-300 tabular-nums" title={`Added ${formatDate(deal.created_at)}`}>
              Updated {formatDate(deal.updated_at)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-300 italic">No financials yet</p>
            <span className="text-[11px] text-slate-300 tabular-nums" title={`Added ${formatDate(deal.created_at)}`}>
              Updated {formatDate(deal.updated_at)}
            </span>
          </div>
        )}
      </div>

      {/* Subtle bottom accent line for active deals */}
      {(deal.status === "reviewing" || deal.status === "due_diligence" || deal.status === "offer") && (
        <div className={`h-0.5 ${
          deal.status === "offer" ? "bg-indigo-400" :
          deal.status === "due_diligence" ? "bg-violet-400" :
          "bg-blue-300"
        }`} />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealsTable({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterScrollRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DealStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Sync filter from URL query param (set by pipeline stat tiles)
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
      else if (sortKey === "updated_at") cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [deals, search, statusFilter, sortKey, sortDir]);

  // Desktop table header cell
  function Th({ label, sortable, colKey, align = "left" }: {
    label: string; sortable?: boolean; colKey?: SortKey; align?: "left" | "right";
  }) {
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

  const isFiltered = search || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-3">

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deals…"
          className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Scrollable filter chips ──────────────────────────────────────── */}
      <div
        ref={filterScrollRef}
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide -mx-0.5 px-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {(["all", ...ALL_STATUSES] as (DealStatus | "all")[]).map((s) => {
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? s === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {s !== "all" && isActive && (
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s as DealStatus]}`} />
              )}
              {s === "all" ? "All" : STATUS_LABELS[s]}
              {s !== "all" && deals.filter(d => d.status === s).length > 0 && !isActive && (
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {deals.filter(d => d.status === s).length}
                </span>
              )}
            </button>
          );
        })}

        {isFiltered && (
          <span className="ml-auto shrink-0 text-xs text-slate-400 tabular-nums pl-2">
            {filtered.length}/{deals.length}
          </span>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {deals.length === 0 ? "No deals yet" : "No matches"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {deals.length === 0
                ? "Track your first acquisition opportunity."
                : "Try a different search or filter."}
            </p>
          </div>
          {deals.length === 0 && (
            <Link
              href="/deals/new"
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add your first deal
            </Link>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* ── Mobile cards ─────────────────────────────────────────────── */}
          <div className="md:hidden flex flex-col gap-2.5">
            {filtered.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>

          {/* ── Desktop table ─────────────────────────────────────────────── */}
          <div className="hidden md:block rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <Th label="Deal" sortable colKey="name" />
                  <Th label="Industry" />
                  <Th label="Location" />
                  <Th label="SDE" sortable colKey="sde" align="right" />
                  <Th label="Ask" sortable colKey="asking_price" align="right" />
                  <Th label="Mult." sortable colKey="multiple" align="right" />
                  <Th label="Status" sortable colKey="status" />
                  <Th label="Updated" sortable colKey="updated_at" />
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
                    <td className="px-4 py-3 text-slate-500 text-xs">{deal.industry ?? <Dash />}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">{deal.location ?? <Dash />}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap text-xs">
                      {deal.sde ?? <Dash />}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600 tabular-nums whitespace-nowrap text-xs">
                      {deal.asking_price ?? <Dash />}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap text-xs">
                      {deal.multiple ?? <Dash />}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect dealId={deal.id} currentStatus={deal.status} variant="row" />
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap tabular-nums text-xs" title={`Added ${formatDate(deal.created_at)}`}>
                      {formatDate(deal.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
