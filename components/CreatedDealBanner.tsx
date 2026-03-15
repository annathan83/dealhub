"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown on dashboard when redirected after creating a deal (?created=id).
 * Clears the query param from URL so refreshing doesn’t show the banner again.
 */
export default function CreatedDealBanner({ dealId }: { dealId: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("created")) {
      url.searchParams.delete("created");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-emerald-800">Deal added to your flow.</p>
      <Link
        href={`/deals/${dealId}?tab=workspace`}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A63] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#176B55] transition-colors"
      >
        View deal
      </Link>
    </div>
  );
}
