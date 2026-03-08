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

  const { data: deals, error } = await supabase
    .from("deals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch deals:", error.message);
  }

  const dealList = (deals ?? []) as Deal[];

  const statusCounts = dealList.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
                { key: "new", label: "New", color: "bg-slate-100 text-slate-600 border-slate-200" },
                { key: "reviewing", label: "Reviewing", color: "bg-blue-50 text-blue-700 border-blue-100" },
                { key: "due_diligence", label: "Due Diligence", color: "bg-purple-50 text-purple-700 border-purple-100" },
                { key: "offer", label: "Offer", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
                { key: "closed", label: "Closed", color: "bg-green-50 text-green-700 border-green-100" },
                { key: "passed", label: "Passed", color: "bg-red-50 text-red-600 border-red-100" },
              ] as const
            ).map(({ key, label, color }) => (
              <div key={key} className={`rounded-xl border px-4 py-3 text-center ${color}`}>
                <p className="text-2xl font-bold tabular-nums">{statusCounts[key] ?? 0}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-80">{label}</p>
              </div>
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
