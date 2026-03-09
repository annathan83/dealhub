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

  if (!user) {
    redirect("/signin");
  }

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

  const statusCounts = dealList.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Google Drive onboarding banner ── */}
        {!isDriveConnected && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Connect Google Drive to get started</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                DealHub stores all your files, photos, and recordings in your own Google Drive. You need to connect it before you can add deals or upload files.
              </p>
            </div>
            <Link
              href="/settings/integrations"
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connect Google Drive
            </Link>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Deal Pipeline
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {dealList.length === 0
                ? "No deals yet — create your first deal to get started."
                : `${dealList.length} deal${dealList.length === 1 ? "" : "s"} in your pipeline`}
            </p>
          </div>
          <Link
            href="/deals/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Deal
          </Link>
        </div>

        {/* Pipeline summary strip */}
        {dealList.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
            {(
              [
                { key: "new", label: "New", color: "bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-400" },
                { key: "reviewing", label: "Reviewing", color: "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300" },
                { key: "due_diligence", label: "Due Diligence", color: "bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-300" },
                { key: "offer", label: "Offer", color: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300" },
                { key: "closed", label: "Closed", color: "bg-green-50 text-green-700 border-green-100 hover:border-green-300" },
                { key: "passed", label: "Passed", color: "bg-red-50 text-red-600 border-red-100 hover:border-red-300" },
              ] as const
            ).map(({ key, label, color }) => (
              <Link
                key={key}
                href={`/dashboard?status=${key}`}
                className={`rounded-xl border px-4 py-3 text-center transition-all cursor-pointer ${color}`}
              >
                <p className="text-2xl font-bold tabular-nums">{statusCounts[key] ?? 0}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-80">{label}</p>
              </Link>
            ))}
          </div>
        )}

        {/* Deals table */}
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm p-5">
          <DealsTable deals={dealList} />
        </div>
      </main>
    </div>
  );
}
