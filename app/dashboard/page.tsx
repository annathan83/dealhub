import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
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
  const isDriveConnected = !!driveResult.data;

  const totalDeals  = dealList.length;
  const activeDeals = dealList.filter((d) => d.status === "active").length;

  // Activity stats computed server-side
  const now = Date.now();
  const last30 = dealList.filter((d) => now - new Date(d.created_at).getTime() < 30 * 86_400_000);
  const last7  = dealList.filter((d) => now - new Date(d.created_at).getTime() < 7  * 86_400_000);
  const new30    = last30.length;
  const passed30 = last30.filter((d) => d.status === "passed").length;
  const new7     = last7.length;
  const passed7  = last7.filter((d) => d.status === "passed").length;

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
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
                Pipeline
              </h1>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                {totalDeals === 0
                  ? "Track and evaluate acquisition opportunities."
                  : `${activeDeals} active · ${totalDeals} total deal${totalDeals !== 1 ? "s" : ""}`}
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

          {/* Activity stats row */}
          {totalDeals > 0 && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Last 30 days</span>
                <span className="text-[11px] text-slate-600 font-medium">
                  <span className="text-indigo-600 font-bold">+{new30}</span> new
                  {passed30 > 0 && (
                    <> · <span className="text-slate-500">{passed30} passed</span></>
                  )}
                </span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Last 7 days</span>
                <span className="text-[11px] text-slate-600 font-medium">
                  <span className="text-indigo-600 font-bold">+{new7}</span> new
                  {passed7 > 0 && (
                    <> · <span className="text-slate-500">{passed7} passed</span></>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Deals pipeline ────────────────────────────────────────────── */}
        <DealsTable deals={dealList} />

      </main>
    </div>
  );
}
