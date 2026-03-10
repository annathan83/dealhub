"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Deal, DealStatus } from "@/types";
import { US_STATES, INDUSTRY_CATEGORIES, DEAL_SOURCE_CATEGORIES } from "@/lib/config/dealMetadata";
import { formatLocation } from "@/lib/config/dealMetadata";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DealStatus, string> = {
  active: "Active",
  closed: "Closed",
  passed: "Passed",
};

const STATUS_STYLES: Record<DealStatus, { badge: string; dot: string; pill: string; pillActive: string }> = {
  active: {
    badge: "bg-indigo-50 text-indigo-700 border border-indigo-100",
    dot:   "bg-indigo-500",
    pill:  "bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-700",
    pillActive: "bg-indigo-600 text-white border border-indigo-600 shadow-sm shadow-indigo-200",
  },
  closed: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    dot:   "bg-emerald-500",
    pill:  "bg-white text-slate-500 border border-slate-200 hover:border-emerald-200 hover:text-emerald-700",
    pillActive: "bg-emerald-600 text-white border border-emerald-600 shadow-sm shadow-emerald-200",
  },
  passed: {
    badge: "bg-slate-100 text-slate-500 border border-slate-200",
    dot:   "bg-slate-400",
    pill:  "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700",
    pillActive: "bg-slate-700 text-white border border-slate-700 shadow-sm",
  },
};

const ALL_STATUSES: DealStatus[] = ["active", "closed", "passed"];
const VALID_STATUSES: DealStatus[] = ALL_STATUSES;

type SortKey = "name" | "asking_price" | "sde" | "multiple" | "status" | "created_at" | "updated_at";
type SortDir = "asc" | "desc";

type SdeFilterKey  = "" | "under250k" | "250-500k" | "500k+";
type AskFilterKey  = "" | "under1m"   | "1-3m"     | "3m+";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string | null): number {
  if (!val) return -Infinity;
  return parseFloat(val.replace(/[^0-9.-]/g, "")) || -Infinity;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format raw financial string to compact display: "300000" → "$300K", "1200000" → "$1.2M" */
function formatFinancial(raw: string | null): string | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

/** Match a raw numeric string against a SDE bucket filter */
function matchSdeFilter(raw: string | null, filter: SdeFilterKey): boolean {
  if (!filter) return true;
  const n = parseNum(raw);
  if (n === -Infinity) return false;
  if (filter === "under250k") return n < 250_000;
  if (filter === "250-500k")  return n >= 250_000 && n < 500_000;
  if (filter === "500k+")     return n >= 500_000;
  return true;
}

/** Match a raw numeric string against an Ask Price bucket filter */
function matchAskFilter(raw: string | null, filter: AskFilterKey): boolean {
  if (!filter) return true;
  const n = parseNum(raw);
  if (n === -Infinity) return false;
  if (filter === "under1m") return n < 1_000_000;
  if (filter === "1-3m")    return n >= 1_000_000 && n < 3_000_000;
  if (filter === "3m+")     return n >= 3_000_000;
  return true;
}

/** Industry → emoji icon */
function industryIcon(industry: string | null): string {
  if (!industry) return "";
  const i = industry.toLowerCase();
  if (i.includes("childcare") || i.includes("education") || i.includes("school") || i.includes("care")) return "🏫";
  if (i.includes("hvac") || i.includes("plumb") || i.includes("electr") || i.includes("home service")) return "🔧";
  if (i.includes("food") || i.includes("restaurant") || i.includes("beverage") || i.includes("cafe")) return "🍽️";
  if (i.includes("health") || i.includes("medical") || i.includes("dental") || i.includes("clinic")) return "🏥";
  if (i.includes("auto") || i.includes("car") || i.includes("vehicle")) return "🚗";
  if (i.includes("fitness") || i.includes("gym") || i.includes("wellness")) return "💪";
  if (i.includes("pet")) return "🐾";
  if (i.includes("retail") || i.includes("store")) return "🛍️";
  if (i.includes("tech") || i.includes("software") || i.includes("saas")) return "💻";
  if (i.includes("clean") || i.includes("janitorial")) return "🧹";
  if (i.includes("landscap") || i.includes("lawn") || i.includes("pool")) return "🌿";
  if (i.includes("transport") || i.includes("logistic") || i.includes("freight")) return "🚚";
  if (i.includes("construct") || i.includes("contractor")) return "🏗️";
  if (i.includes("beauty") || i.includes("salon") || i.includes("spa")) return "✂️";
  if (i.includes("senior") || i.includes("elder")) return "🏠";
  if (i.includes("manufactur")) return "🏭";
  if (i.includes("hospitality") || i.includes("hotel") || i.includes("motel")) return "🏨";
  return "🏢";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function StatusBadge({ status }: { status: DealStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Mobile deal card ─────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const displayLocation = formatLocation(deal.city, deal.county, deal.state) || deal.location;
  const displayIndustry = deal.industry ?? deal.industry_category;
  const icon = industryIcon(displayIndustry);

  const subtitle = [
    displayIndustry ? `${icon} ${displayIndustry}` : null,
    displayLocation ? `📍 ${displayLocation}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const sde = formatFinancial(deal.sde);
  const ask = formatFinancial(deal.asking_price);

  return (
    <div
      onClick={() => router.push(`/deals/${deal.id}`)}
      className="group bg-white rounded-xl border border-slate-100 shadow-sm active:scale-[0.99] active:shadow-none transition-all duration-100 cursor-pointer overflow-hidden hover:border-indigo-100 hover:shadow-md"
    >
      <div className="px-4 pt-3.5 pb-3">
        {/* Deal name + status */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="font-bold text-slate-900 text-[14px] leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2 flex-1 min-w-0">
            {deal.name}
          </p>
          <div className="shrink-0 mt-0.5">
            <StatusBadge status={deal.status} />
          </div>
        </div>

        {/* Subtitle: industry · location */}
        {subtitle && (
          <p className="text-[11px] text-slate-400 truncate mb-2.5 leading-relaxed">{subtitle}</p>
        )}

        {/* Financials + created date */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {sde && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-0.5">SDE</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums leading-none">{sde}</p>
              </div>
            )}
            {ask && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-0.5">Ask</p>
                <p className="text-sm font-semibold text-slate-600 tabular-nums leading-none">{ask}</p>
              </div>
            )}
            {!sde && !ask && (
              <span className="text-[11px] text-slate-300 italic">No financials</span>
            )}
          </div>
          <span className="text-[11px] text-slate-300 tabular-nums shrink-0">
            {formatDate(deal.created_at)}
          </span>
        </div>
      </div>

      {/* Bottom accent line */}
      {deal.status === "active" && <div className="h-0.5 bg-gradient-to-r from-indigo-400 to-indigo-300" />}
      {deal.status === "closed" && <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-300" />}
    </div>
  );
}

// ─── Desktop deal row ─────────────────────────────────────────────────────────

function DealRow({ deal, index, onClick }: { deal: Deal; index: number; onClick: () => void }) {
  const displayLocation = formatLocation(deal.city, deal.county, deal.state) || deal.location;
  const displayIndustry = deal.industry ?? deal.industry_category;
  const icon = industryIcon(displayIndustry);

  const subtitle = [
    displayIndustry ? `${icon} ${displayIndustry}` : null,
    displayLocation ? `📍 ${displayLocation}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const sde = formatFinancial(deal.sde);
  const ask = formatFinancial(deal.asking_price);

  const rowBg = index % 2 === 1 ? "bg-slate-50/40" : "bg-white";

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer group hover:bg-indigo-50/50 transition-colors border-b border-slate-100 last:border-0 ${rowBg}`}
    >
      {/* Deal identity */}
      <td className="px-5 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[13px] text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
            {deal.name}
          </span>
          {subtitle && (
            <span className="text-[11px] text-slate-400 leading-relaxed">{subtitle}</span>
          )}
        </div>
      </td>

      {/* SDE */}
      <td className="px-5 py-2.5 tabular-nums">
        {sde
          ? <span className="text-[13px] font-bold text-slate-800">{sde}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* Ask Price */}
      <td className="px-5 py-2.5 tabular-nums">
        {ask
          ? <span className="text-[13px] font-semibold text-slate-600">{ask}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* Status */}
      <td className="px-5 py-2.5">
        <StatusBadge status={deal.status} />
      </td>

      {/* Created */}
      <td className="px-5 py-2.5 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">
        {formatDate(deal.created_at)}
      </td>

      {/* Arrow */}
      <td className="pr-4 py-2.5 w-8">
        <svg
          className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 transition-colors"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealsTable({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState<DealStatus | "all">("all");
  const [industryFilter, setIndustryFilter] = useState("");
  const [stateFilter, setStateFilter]     = useState("");
  const [sourceFilter, setSourceFilter]   = useState("");
  const [sdeFilter, setSdeFilter]         = useState<SdeFilterKey>("");
  const [askFilter, setAskFilter]         = useState<AskFilterKey>("");
  const [sortKey, setSortKey]             = useState<SortKey>("updated_at");
  const [sortDir, setSortDir]             = useState<SortDir>("desc");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s && (VALID_STATUSES as string[]).includes(s)) {
      setStatusFilter(s as DealStatus);
    } else {
      setStatusFilter("all");
    }
  }, [searchParams]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    let list = deals.filter((deal) => {
      const q = search.trim().toLowerCase();
      const displayLocation = formatLocation(deal.city, deal.county, deal.state) || deal.location || "";
      const displayIndustry = deal.industry ?? deal.industry_category ?? "";
      const matchesSearch =
        !q ||
        deal.name.toLowerCase().includes(q) ||
        displayIndustry.toLowerCase().includes(q) ||
        displayLocation.toLowerCase().includes(q) ||
        deal.deal_source_category?.toLowerCase().includes(q) ||
        deal.deal_source_detail?.toLowerCase().includes(q);
      const matchesStatus   = statusFilter === "all" || deal.status === statusFilter;
      const matchesIndustry = !industryFilter || deal.industry_category === industryFilter || deal.industry === industryFilter;
      const matchesState    = !stateFilter || deal.state === stateFilter;
      const matchesSource   = !sourceFilter || deal.deal_source_category === sourceFilter;
      const matchesSde      = matchSdeFilter(deal.sde, sdeFilter);
      const matchesAsk      = matchAskFilter(deal.asking_price, askFilter);
      return matchesSearch && matchesStatus && matchesIndustry && matchesState && matchesSource && matchesSde && matchesAsk;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")          cmp = a.name.localeCompare(b.name);
      else if (sortKey === "asking_price") cmp = parseNum(a.asking_price) - parseNum(b.asking_price);
      else if (sortKey === "sde")      cmp = parseNum(a.sde) - parseNum(b.sde);
      else if (sortKey === "multiple") cmp = parseNum(a.multiple) - parseNum(b.multiple);
      else if (sortKey === "status")   cmp = a.status.localeCompare(b.status);
      else if (sortKey === "created_at")  cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "updated_at")  cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [deals, search, statusFilter, industryFilter, stateFilter, sourceFilter, sdeFilter, askFilter, sortKey, sortDir]);

  const hasSecondaryFilters = !!(industryFilter || stateFilter || sourceFilter || sdeFilter || askFilter);
  const isFiltered = !!(search || statusFilter !== "all" || hasSecondaryFilters);

  const SELECT_CLS =
    "rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition appearance-none cursor-pointer";

  function Th({ label, sortable, colKey, align = "left" }: {
    label: string; sortable?: boolean; colKey?: SortKey; align?: "left" | "right";
  }) {
    const isActive = sortable && sortKey === colKey;
    return (
      <th
        className={`px-5 py-2.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase whitespace-nowrap select-none ${align === "right" ? "text-right" : "text-left"} ${sortable ? "cursor-pointer hover:text-slate-700 transition-colors" : ""}`}
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
    <div className="flex flex-col gap-3">

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">

        {/* Row 1: Search + Filters button */}
        <div className="flex items-center gap-2">

          {/* Search — takes remaining width */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals by name, industry, location…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters toggle — to the right of search */}
          <button
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              hasSecondaryFilters
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Filters
            {hasSecondaryFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </button>

          {/* Clear — only when something is filtered */}
          {isFiltered && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setIndustryFilter("");
                setStateFilter("");
                setSourceFilter("");
                setSdeFilter("");
                setAskFilter("");
              }}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-700 transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>

        {/* Row 2: Secondary filters (collapsible) */}
        {showMoreFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-0.5 pl-0.5">

            {/* Industry */}
            <div className="relative">
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className={`${SELECT_CLS} ${industryFilter ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""}`}
              >
                <option value="">All industries</option>
                {INDUSTRY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* State */}
            <div className="relative">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className={`${SELECT_CLS} ${stateFilter ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""}`}
              >
                <option value="">All states</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>{s.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Source */}
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={`${SELECT_CLS} ${sourceFilter ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""}`}
              >
                <option value="">All sources</option>
                {DEAL_SOURCE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* SDE filter */}
            <div className="relative">
              <select
                value={sdeFilter}
                onChange={(e) => setSdeFilter(e.target.value as SdeFilterKey)}
                className={`${SELECT_CLS} ${sdeFilter ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""}`}
              >
                <option value="">Any SDE</option>
                <option value="under250k">SDE &lt; $250K</option>
                <option value="250-500k">SDE $250K – $500K</option>
                <option value="500k+">SDE $500K+</option>
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Ask Price filter */}
            <div className="relative">
              <select
                value={askFilter}
                onChange={(e) => setAskFilter(e.target.value as AskFilterKey)}
                className={`${SELECT_CLS} ${askFilter ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""}`}
              >
                <option value="">Any ask price</option>
                <option value="under1m">Ask &lt; $1M</option>
                <option value="1-3m">Ask $1M – $3M</option>
                <option value="3m+">Ask $3M+</option>
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

          </div>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {deals.length === 0 ? "No deals yet" : "No matches"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {deals.length === 0
                ? "Start tracking your first acquisition opportunity."
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
          <div className="hidden md:block rounded-xl border border-slate-150 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <Th label="Deal"      sortable colKey="name" />
                  <Th label="SDE"       sortable colKey="sde" />
                  <Th label="Ask Price" sortable colKey="asking_price" />
                  <Th label="Status"    sortable colKey="status" />
                  <Th label="Created"   sortable colKey="created_at" />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal, i) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    index={i}
                    onClick={() => router.push(`/deals/${deal.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Result count */}
          {isFiltered && (
            <p className="text-xs text-slate-400 text-center tabular-nums">
              Showing {filtered.length} of {deals.length} deals
            </p>
          )}
        </>
      )}
    </div>
  );
}
