import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import DealsTable from "@/components/DealsTable";
import type { Deal } from "@/types";

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
      .order("updated_at", { ascending: false }),
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

  // Fetch latest KPI scorecard scores for all deals via their entity bridge
  // We join entities → analysis_snapshots to get the latest kpi_scorecard per deal
  const scoreMap: Record<string, number> = {};
  if (dealList.length > 0) {
    const { data: snapshots } = await supabase
      .from("entities")
      .select("legacy_deal_id, analysis_snapshots!inner(analysis_type, content_json, created_at)")
      .in("legacy_deal_id", dealList.map((d) => d.id))
      .eq("analysis_snapshots.analysis_type", "kpi_scorecard")
      .order("created_at", { referencedTable: "analysis_snapshots", ascending: false });

    if (snapshots) {
      for (const entity of snapshots) {
        const dealId = entity.legacy_deal_id as string | null;
        if (!dealId) continue;
        // Take the first (latest) snapshot
        const snaps = Array.isArray(entity.analysis_snapshots)
          ? entity.analysis_snapshots
          : [entity.analysis_snapshots];
        const snap = snaps[0] as { content_json?: { overall_score?: number } } | null;
        const score = snap?.content_json?.overall_score;
        if (typeof score === "number" && !scoreMap[dealId]) {
          // overall_score is 1–5; convert to 1–10 for display
          scoreMap[dealId] = Math.round(score * 2 * 10) / 10;
        }
      }
    }
  }
  const isDriveConnected = !!driveResult.data;

  const totalDeals  = dealList.length;
  const activeDeals = dealList.filter((d) => d.status === "active").length;

  // Activity stats computed server-side
  const now = Date.now();
  const MS_DAY = 86_400_000;

  // Last 30 days
  const last30 = dealList.filter((d) => now - new Date(d.created_at).getTime() < 30 * MS_DAY);
  const new30    = last30.length;
  const passed30 = last30.filter((d) => d.status === "passed").length;

  // Avg new per week over last 4 weeks (28 days)
  const last28 = dealList.filter((d) => now - new Date(d.created_at).getTime() < 28 * MS_DAY);
  const avgPerWeek = last28.length > 0 ? (last28.length / 4) : 0;

  // Trend: compare last 7 days vs prior 7 days
  const last7  = dealList.filter((d) => now - new Date(d.created_at).getTime() < 7  * MS_DAY).length;
  const prev7  = dealList.filter((d) => {
    const age = now - new Date(d.created_at).getTime();
    return age >= 7 * MS_DAY && age < 14 * MS_DAY;
  }).length;
  const trend: "up" | "down" | "flat" =
    last7 > prev7 ? "up" : last7 < prev7 ? "down" : "flat";

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-safe">

        {/* ── Google Drive onboarding banner ───────────────────────────── */}
        {!isDriveConnected && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
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
        <div className="mb-6">
          {/* Title + New Deal button */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
                Deal Flow
              </h1>
              <p className="text-sm text-slate-400 mt-1.5">
                {totalDeals === 0
                  ? "Track and evaluate acquisition opportunities."
                  : `${totalDeals} deal${totalDeals !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Link
              href="/deals/new"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Deal
            </Link>
          </div>

          {/* ── Activity stat cards ───────────────────────────────────── */}
          {totalDeals > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* New — last 30 days */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">New · 30 days</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">+{new30}</p>
                <p className="text-[11px] text-slate-400 mt-1">deals added</p>
              </div>

              {/* Passed — last 30 days */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Passed · 30 days</p>
                <p className="text-2xl font-extrabold text-slate-500 tabular-nums leading-none">{passed30}</p>
                <p className="text-[11px] text-slate-400 mt-1">deals passed</p>
              </div>

              {/* Avg new per week — last 4 weeks */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Avg / week</p>
                <p className="text-2xl font-extrabold text-indigo-600 tabular-nums leading-none">
                  {avgPerWeek % 1 === 0 ? avgPerWeek.toFixed(0) : avgPerWeek.toFixed(1)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">new deals · 4 wk avg</p>
              </div>

              {/* Trend: last 7 days vs prior 7 days */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Trend</p>
                <div className="flex items-center gap-2 leading-none">
                  {trend === "up" && (
                    <>
                      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-2xl font-extrabold text-emerald-600">Up</span>
                    </>
                  )}
                  {trend === "down" && (
                    <>
                      <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 17l5-5m0 0l-5-5m5 5H6" />
                      </svg>
                      <span className="text-2xl font-extrabold text-rose-500">Down</span>
                    </>
                  )}
                  {trend === "flat" && (
                    <>
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                      </svg>
                      <span className="text-2xl font-extrabold text-slate-500">Flat</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {last7} this wk · {prev7} last wk
                </p>
              </div>

            </div>
          )}
        </div>

        {/* ── Deals pipeline ────────────────────────────────────────────── */}
        <Suspense fallback={
          <div className="py-16 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          </div>
        }>
          <DealsTable deals={dealList} scoreMap={scoreMap} />
        </Suspense>

      </main>
    </div>
  );
}
