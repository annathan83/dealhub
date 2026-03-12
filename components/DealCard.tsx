import Link from "next/link";
import type { Deal } from "@/types";
import { getDealDisplayName } from "@/types";
import { formatLocation } from "@/lib/config/dealMetadata";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-100",
  reviewing: "bg-amber-50 text-amber-700 border-amber-100",
  due_diligence: "bg-purple-50 text-purple-700 border-purple-100",
  offer: "bg-indigo-50 text-indigo-700 border-indigo-100",
  closed: "bg-green-50 text-green-700 border-green-100",
  passed: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  due_diligence: "Due Diligence",
  offer: "Offer",
  closed: "Closed",
  passed: "Passed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DealCard({ deal }: { deal: Deal }) {
  const statusStyle = STATUS_STYLES[deal.status] ?? STATUS_STYLES.new;
  const statusLabel = STATUS_LABELS[deal.status] ?? deal.status;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 leading-snug">
          {getDealDisplayName(deal)}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Description */}
      {deal.description && (
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
          {deal.description}
        </p>
      )}

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-2">
        {deal.industry && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {deal.industry}
          </span>
        )}
        {(formatLocation(deal.city, deal.county, deal.state) || deal.location) && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {formatLocation(deal.city, deal.county, deal.state) || deal.location}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-slate-400 ml-auto">
          {formatDate(deal.created_at)}
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/deals/${deal.id}`}
        className="mt-auto inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
      >
        Open Deal
      </Link>
    </div>
  );
}
