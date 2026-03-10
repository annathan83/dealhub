"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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

// Active = emerald, Passed = red, Closed = grey — flat solid badges
const STATUS_STYLES: Record<DealStatus, { badge: string; dot: string; pill: string; pillActive: string }> = {
  active: {
    badge:      "bg-[#1F7A63] text-white",
    dot:        "bg-white/70",
    pill:       "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#1F7A63] hover:text-[#1F7A63]",
    pillActive: "bg-[#1F7A63] text-white border border-[#1F7A63]",
  },
  closed: {
    badge:      "bg-[#6B7280] text-white",
    dot:        "bg-white/70",
    pill:       "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#6B7280] hover:text-[#1E1E1E]",
    pillActive: "bg-[#6B7280] text-white border border-[#6B7280]",
  },
  passed: {
    badge:      "bg-[#DC2626] text-white",
    dot:        "bg-white/70",
    pill:       "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#DC2626] hover:text-[#DC2626]",
    pillActive: "bg-[#DC2626] text-white border border-[#DC2626]",
  },
};

const ALL_STATUSES: DealStatus[] = ["active", "closed", "passed"];
const VALID_STATUSES: DealStatus[] = ALL_STATUSES;

type SortKey = "name" | "asking_price" | "sde" | "multiple" | "status" | "created_at" | "updated_at" | "score";
type SortDir = "asc" | "desc";
type SdeFilterKey = "" | "under250k" | "250-500k" | "500k+";
type AskFilterKey = "" | "under1m" | "1-3m" | "3m+";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string | null): number {
  if (!val) return -Infinity;
  return parseFloat(val.replace(/[^0-9.-]/g, "")) || -Infinity;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatFinancial(raw: string | null): string | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function formatMultiple(raw: string | null): string | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return raw;
  return `${n.toFixed(1)}×`;
}

function matchSdeFilter(raw: string | null, filter: SdeFilterKey): boolean {
  if (!filter) return true;
  const n = parseNum(raw);
  if (n === -Infinity) return false;
  if (filter === "under250k") return n < 250_000;
  if (filter === "250-500k")  return n >= 250_000 && n < 500_000;
  if (filter === "500k+")     return n >= 500_000;
  return true;
}

function matchAskFilter(raw: string | null, filter: AskFilterKey): boolean {
  if (!filter) return true;
  const n = parseNum(raw);
  if (n === -Infinity) return false;
  if (filter === "under1m") return n < 1_000_000;
  if (filter === "1-3m")    return n >= 1_000_000 && n < 3_000_000;
  if (filter === "3m+")     return n >= 3_000_000;
  return true;
}

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

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | undefined }) {
  if (score === undefined) {
    return <span className="text-[11px] text-[#6B7280]">—</span>;
  }
  const display = score % 1 === 0 ? score.toFixed(0) : score.toFixed(1);
  // Flat solid badges: green / yellow / red
  const color =
    score >= 8 ? "bg-[#1F7A63] text-white" :
    score >= 5 ? "bg-[#EAB308] text-white" :
                 "bg-[#DC2626] text-white";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${color}`}>
      {display}
      <span className="font-normal opacity-70">/10</span>
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DealStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

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

// ─── Filter panel (slide-in) ──────────────────────────────────────────────────

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  statusFilter: DealStatus | "all";
  setStatusFilter: (v: DealStatus | "all") => void;
  industryFilter: string;
  setIndustryFilter: (v: string) => void;
  stateFilter: string;
  setStateFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  sdeFilter: SdeFilterKey;
  setSdeFilter: (v: SdeFilterKey) => void;
  askFilter: AskFilterKey;
  setAskFilter: (v: AskFilterKey) => void;
  onClear: () => void;
  deals: Deal[];
}

function FilterPanel({
  open, onClose,
  statusFilter, setStatusFilter,
  industryFilter, setIndustryFilter,
  stateFilter, setStateFilter,
  sourceFilter, setSourceFilter,
  sdeFilter, setSdeFilter,
  askFilter, setAskFilter,
  onClear, deals,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const SELECT_CLS =
    "w-full rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 py-2 text-sm text-[#1E1E1E] focus:border-[#1F7A63] focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition appearance-none cursor-pointer";

  const hasFilters = !!(statusFilter !== "all" || industryFilter || stateFilter || sourceFilter || sdeFilter || askFilter);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 z-50 h-full w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <h3 className="text-sm font-bold text-[#1E1E1E]">Filters</h3>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={onClear}
                className="text-xs text-[#1F7A63] hover:text-[#176B55] font-medium transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1E1E1E] hover:bg-[#F3F4F6] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Status */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...ALL_STATUSES] as const).map((s) => {
                const isActive = statusFilter === s;
                const count = s === "all" ? deals.length : deals.filter((d) => d.status === s).length;
                const styles = s !== "all" ? STATUS_STYLES[s] : null;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? s === "all"
                          ? "bg-slate-900 text-white shadow-sm"
                          : styles!.pillActive
                        : s === "all"
                          ? "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                          : styles!.pill
                    }`}
                  >
                    {s !== "all" && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white/70" : styles!.dot}`} />
                    )}
                    {s === "all" ? "All" : STATUS_LABELS[s]}
                    <span className={`text-[10px] tabular-nums ${isActive ? "opacity-70" : "text-slate-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Industry */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Industry</p>
            <div className="relative">
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className={`${SELECT_CLS} ${industryFilter ? "border-[#1F7A63] text-[#1F7A63] bg-[#F0FAF7]" : ""}`}
              >
                <option value="">All industries</option>
                {INDUSTRY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Location / State */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">State</p>
            <div className="relative">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className={`${SELECT_CLS} ${stateFilter ? "border-[#1F7A63] text-[#1F7A63] bg-[#F0FAF7]" : ""}`}
              >
                <option value="">All states</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>{s.name}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Source */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Deal Source</p>
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={`${SELECT_CLS} ${sourceFilter ? "border-[#1F7A63] text-[#1F7A63] bg-[#F0FAF7]" : ""}`}
              >
                <option value="">All sources</option>
                {DEAL_SOURCE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* SDE range */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">SDE Range</p>
            <div className="relative">
              <select
                value={sdeFilter}
                onChange={(e) => setSdeFilter(e.target.value as SdeFilterKey)}
                className={`${SELECT_CLS} ${sdeFilter ? "border-[#1F7A63] text-[#1F7A63] bg-[#F0FAF7]" : ""}`}
              >
                <option value="">Any SDE</option>
                <option value="under250k">Under $250K</option>
                <option value="250-500k">$250K – $500K</option>
                <option value="500k+">$500K+</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Ask Price range */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Ask Price Range</p>
            <div className="relative">
              <select
                value={askFilter}
                onChange={(e) => setAskFilter(e.target.value as AskFilterKey)}
                className={`${SELECT_CLS} ${askFilter ? "border-[#1F7A63] text-[#1F7A63] bg-[#F0FAF7]" : ""}`}
              >
                <option value="">Any ask price</option>
                <option value="under1m">Under $1M</option>
                <option value="1-3m">$1M – $3M</option>
                <option value="3m+">$3M+</option>
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E5E7EB]">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-[#1F7A63] hover:bg-[#176B55] text-white text-sm font-semibold py-2.5 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Mobile deal card ─────────────────────────────────────────────────────────

function DealCard({ deal, score }: { deal: Deal; score: number | undefined }) {
  const router = useRouter();
  const displayLocation = formatLocation(deal.city, deal.county, deal.state) || deal.location;
  const displayIndustry = deal.industry ?? deal.industry_category;
  const icon = industryIcon(displayIndustry);

  const sde      = formatFinancial(deal.sde);
  const ask      = formatFinancial(deal.asking_price);
  const multiple = formatMultiple(deal.multiple);

  return (
    <div
      onClick={() => router.push(`/deals/${deal.id}`)}
      className="group bg-white rounded-xl border border-[#E5E7EB] shadow-sm active:scale-[0.99] active:shadow-none transition-all duration-100 cursor-pointer overflow-hidden hover:border-[#1F7A63]/30 hover:shadow-md"
    >
      <div className="px-4 pt-3.5 pb-3">
        {/* Deal name + status */}
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <p className="font-bold text-[#1E1E1E] text-[14px] leading-snug group-hover:text-[#1F7A63] transition-colors line-clamp-2 flex-1 min-w-0">
            {deal.name}
          </p>
          <div className="shrink-0 mt-0.5">
            <StatusBadge status={deal.status} />
          </div>
        </div>

        {/* Industry · location */}
        {(displayIndustry || displayLocation) && (
          <p className="text-[11px] text-slate-400 truncate mb-2.5 leading-relaxed">
            {displayIndustry && `${icon} ${displayIndustry}`}
            {displayIndustry && displayLocation && "  ·  "}
            {displayLocation && `📍 ${displayLocation}`}
          </p>
        )}

        {/* Financials row */}
        <div className="flex items-end justify-between gap-2">
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
            {multiple && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-0.5">Mult.</p>
                <p className="text-sm font-semibold text-slate-500 tabular-nums leading-none">{multiple}</p>
              </div>
            )}
            {!sde && !ask && (
              <span className="text-[11px] text-slate-300 italic">No financials</span>
            )}
          </div>
          <ScoreBadge score={score} />
        </div>

        {/* Dates row */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50">
          <span className="text-[10px] text-slate-300 tabular-nums">
            Added <span className="text-slate-400">{formatDate(deal.created_at)}</span>
          </span>
          <span className="text-[10px] text-slate-300 tabular-nums">
            Updated <span className="text-slate-400">{formatDate(deal.updated_at)}</span>
          </span>
        </div>
      </div>

      {deal.status === "active" && <div className="h-0.5 bg-[#1F7A63]" />}
      {deal.status === "closed" && <div className="h-0.5 bg-[#6B7280]" />}
      {deal.status === "passed" && <div className="h-0.5 bg-[#DC2626]" />}
    </div>
  );
}

// ─── Desktop deal row ─────────────────────────────────────────────────────────

function DealRow({
  deal, index, score, onClick,
}: {
  deal: Deal; index: number; score: number | undefined; onClick: () => void;
}) {
  const displayLocation = formatLocation(deal.city, deal.county, deal.state) || deal.location;
  const displayIndustry = deal.industry ?? deal.industry_category;
  const icon = industryIcon(displayIndustry);

  const sde      = formatFinancial(deal.sde);
  const ask      = formatFinancial(deal.asking_price);
  const multiple = formatMultiple(deal.multiple);

  const rowBg = index % 2 === 1 ? "bg-[#F8FAF9]" : "bg-white";

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer group hover:bg-[#F3F4F6] transition-colors border-b border-[#E5E7EB] last:border-0 ${rowBg}`}
    >
      {/* Deal identity */}
      <td className="px-4 py-2.5 min-w-[180px]">
        <span className="font-semibold text-[13px] text-[#1E1E1E] group-hover:text-[#1F7A63] transition-colors leading-snug">
          {deal.name}
        </span>
      </td>

      {/* Industry */}
      <td className="px-4 py-2.5 max-w-[130px]">
        {displayIndustry
          ? <span className="text-[12px] text-slate-500 truncate block">{icon} {displayIndustry}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* Location */}
      <td className="px-4 py-2.5 max-w-[140px]">
        {displayLocation
          ? <span className="text-[12px] text-slate-500 truncate block">📍 {displayLocation}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* SDE */}
      <td className="px-4 py-2.5 text-right tabular-nums">
        {sde
          ? <span className="text-[13px] font-bold text-slate-800">{sde}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* Ask */}
      <td className="px-4 py-2.5 text-right tabular-nums">
        {ask
          ? <span className="text-[13px] font-semibold text-slate-600">{ask}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* Multiple */}
      <td className="px-4 py-2.5 text-right tabular-nums">
        {multiple
          ? <span className="text-[12px] font-medium text-slate-500">{multiple}</span>
          : <span className="text-[12px] text-slate-300">—</span>
        }
      </td>

      {/* Score */}
      <td className="px-4 py-2.5 text-center">
        <ScoreBadge score={score} />
      </td>

      {/* Status */}
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <StatusBadge status={deal.status} />
      </td>

      {/* Created */}
      <td
        className="px-4 py-2.5 text-[12px] text-slate-400 tabular-nums whitespace-nowrap"
        title={formatDateFull(deal.created_at)}
      >
        {formatDate(deal.created_at)}
      </td>

      {/* Updated */}
      <td
        className="px-4 py-2.5 text-[12px] text-slate-400 tabular-nums whitespace-nowrap"
        title={formatDateFull(deal.updated_at)}
      >
        {formatDate(deal.updated_at)}
      </td>

      {/* Arrow */}
      <td className="pr-3 py-2.5 w-7">
        <svg
          className="w-4 h-4 text-[#E5E7EB] group-hover:text-[#1F7A63] transition-colors"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealsTable({
  deals,
  scoreMap = {},
}: {
  deals: Deal[];
  scoreMap?: Record<string, number>;
}) {
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
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

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

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setIndustryFilter("");
    setStateFilter("");
    setSourceFilter("");
    setSdeFilter("");
    setAskFilter("");
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
      if (sortKey === "name")           cmp = a.name.localeCompare(b.name);
      else if (sortKey === "asking_price") cmp = parseNum(a.asking_price) - parseNum(b.asking_price);
      else if (sortKey === "sde")       cmp = parseNum(a.sde) - parseNum(b.sde);
      else if (sortKey === "multiple")  cmp = parseNum(a.multiple) - parseNum(b.multiple);
      else if (sortKey === "status")    cmp = a.status.localeCompare(b.status);
      else if (sortKey === "score")     cmp = (scoreMap[a.id] ?? -1) - (scoreMap[b.id] ?? -1);
      else if (sortKey === "created_at")   cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "updated_at")   cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [deals, search, statusFilter, industryFilter, stateFilter, sourceFilter, sdeFilter, askFilter, sortKey, sortDir, scoreMap]);

  const hasSecondaryFilters = !!(statusFilter !== "all" || industryFilter || stateFilter || sourceFilter || sdeFilter || askFilter);
  const isFiltered = !!(search || hasSecondaryFilters);

  function Th({ label, sortable, colKey, align = "left" }: {
    label: string; sortable?: boolean; colKey?: SortKey; align?: "left" | "right" | "center";
  }) {
    const isActive = sortable && sortKey === colKey;
    return (
      <th
            className={`px-4 py-2.5 text-[10px] font-medium text-[#6B7280] tracking-widest uppercase whitespace-nowrap select-none ${
          align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
        } ${sortable ? "cursor-pointer hover:text-[#1E1E1E] transition-colors" : ""}`}
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
    <>
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        industryFilter={industryFilter}
        setIndustryFilter={setIndustryFilter}
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        sdeFilter={sdeFilter}
        setSdeFilter={setSdeFilter}
        askFilter={askFilter}
        setAskFilter={setAskFilter}
        onClear={clearFilters}
        deals={deals}
      />

      <div className="flex flex-col gap-3">

        {/* ── Search + Filter button ────────────────────────────────────── */}
        <div className="flex items-center gap-2">

          {/* Search */}
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
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#1E1E1E] placeholder-[#6B7280] focus:border-[#1F7A63] focus:outline-none focus:ring-2 focus:ring-[#C6E4DC] transition"
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

          {/* Filter button */}
          <button
            onClick={() => setFilterPanelOpen(true)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              hasSecondaryFilters
                ? "bg-[#F0FAF7] text-[#1F7A63] border-[#1F7A63]"
                : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1F7A63] hover:text-[#1F7A63]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Filter
            {hasSecondaryFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </button>

          {/* Clear */}
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="shrink-0 text-xs text-[#6B7280] hover:text-[#1E1E1E] transition-colors whitespace-nowrap"
            >
              Clear
            </button>
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
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A63] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#176B55] transition-colors shadow-sm"
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
            {/* ── Mobile cards ───────────────────────────────────────────── */}
            <div className="md:hidden flex flex-col gap-2.5">
              {filtered.map((deal) => (
                <DealCard key={deal.id} deal={deal} score={scoreMap[deal.id]} />
              ))}
            </div>

            {/* ── Desktop table ──────────────────────────────────────────── */}
            <div className="hidden md:block rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F8FAF9]">
                      <Th label="Deal"     sortable colKey="name" />
                      <Th label="Industry" />
                      <Th label="Location" />
                      <Th label="SDE"      sortable colKey="sde"          align="right" />
                      <Th label="Ask"      sortable colKey="asking_price" align="right" />
                      <Th label="Mult."    sortable colKey="multiple"     align="right" />
                      <Th label="Score"    sortable colKey="score"        align="center" />
                      <Th label="Status"   sortable colKey="status" />
                      <Th label="Created"  sortable colKey="created_at" />
                      <Th label="Updated"  sortable colKey="updated_at" />
                      <th className="w-7" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((deal, i) => (
                      <DealRow
                        key={deal.id}
                        deal={deal}
                        index={i}
                        score={scoreMap[deal.id]}
                        onClick={() => router.push(`/deals/${deal.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
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
    </>
  );
}
