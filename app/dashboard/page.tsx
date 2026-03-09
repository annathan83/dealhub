import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import DealsTable from "@/components/DealsTable";
import type { Deal, DealStatus } from "@/types";

// Statuses that count as "active" (not terminal)
const ACTIVE_STATUSES: DealStatus[] = ["new", "reviewing", "due_diligence", "offer"];

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const [dealsResult, driveResult] = await Promise.all([
    supabase
      .from("deals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("google_oauth_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (dealsResult.error) {
    console.error("Failed to fetch deals:", dealsResult.error.message);
  }

  const dealList = (dealsResult.data ?? []) as Deal[];
  const isDriveConnected = !!driveResult.data;

  // Compute summary stats
  const totalDeals = dealList.length;
  const activeDeals = dealList.filter((d) => (ACTIVE_STATUSES as string[]).includes(d.status)).length;
  const offerDeals = dealList.filter((d) => d.status === "offer").length;

  const statusCounts = dealList.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-safe">

        {/* ── Google Drive onboarding banner ───────────────────────────── */}
        {!isDriveConnected && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
            <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Connect Google Drive to get started</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                DealHub stores your files and recordings in your own Drive.
              </p>
              <Link
                href="/settings/integrations"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Connect Drive
              </Link>
            </div>
          </div>
        )}

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pipeline</h1>
            {totalDeals > 0 && (
              <p className="text-sm text-slate-400 mt-0.5">
                {totalDeals} deal{totalDeals !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link
            href="/deals/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Deal
          </Link>
        </div>

        {/* ── Compact summary stats ─────────────────────────────────────── */}
        {totalDeals > 0 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {/* Total */}
            <Link
              href="/dashboard"
              className="shrink-0 flex items-center gap-2 rounded-xl bg-white border border-slate-100 px-3.5 py-2.5 shadow-sm hover:border-slate-200 transition-colors"
            >
              <span className="text-lg font-bold text-slate-900 tabular-nums leading-none">{totalDeals}</span>
              <span className="text-xs text-slate-400 font-medium">Total</span>
            </Link>

            <div className="w-px h-6 bg-slate-100 shrink-0" />

            {/* Active */}
            <Link
              href="/dashboard?status=reviewing"
              className="shrink-0 flex items-center gap-2 rounded-xl bg-white border border-slate-100 px-3.5 py-2.5 shadow-sm hover:border-blue-200 transition-colors"
            >
              <span className="text-lg font-bold text-blue-600 tabular-nums leading-none">{activeDeals}</span>
              <span className="text-xs text-slate-400 font-medium">Active</span>
            </Link>

            {/* Offer — only show if there are any */}
            {offerDeals > 0 && (
              <>
                <div className="w-px h-6 bg-slate-100 shrink-0" />
                <Link
                  href="/dashboard?status=offer"
                  className="shrink-0 flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3.5 py-2.5 shadow-sm hover:border-indigo-200 transition-colors"
                >
                  <span className="text-lg font-bold text-indigo-600 tabular-nums leading-none">{offerDeals}</span>
                  <span className="text-xs text-indigo-400 font-medium">Offer</span>
                </Link>
              </>
            )}

            {/* Per-status quick links — only show stages with deals */}
            {(["due_diligence", "closed", "passed"] as DealStatus[])
              .filter((s) => (statusCounts[s] ?? 0) > 0)
              .map((s) => {
                const colors: Record<string, string> = {
                  due_diligence: "text-violet-600",
                  closed: "text-emerald-600",
                  passed: "text-red-400",
                };
                const labels: Record<string, string> = {
                  due_diligence: "DD",
                  closed: "Closed",
                  passed: "Passed",
                };
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className="w-px h-6 bg-slate-100 shrink-0" />
                    <Link
                      href={`/dashboard?status=${s}`}
                      className="shrink-0 flex items-center gap-2 rounded-xl bg-white border border-slate-100 px-3.5 py-2.5 shadow-sm hover:border-slate-200 transition-colors"
                    >
                      <span className={`text-lg font-bold tabular-nums leading-none ${colors[s]}`}>
                        {statusCounts[s]}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{labels[s]}</span>
                    </Link>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── Deals list ────────────────────────────────────────────────── */}
        <DealsTable deals={dealList} />

      </main>
    </div>
  );
}
