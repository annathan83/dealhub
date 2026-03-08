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

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              Deals
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {dealList.length === 0
                ? "No deals yet"
                : `${dealList.length} deal${dealList.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Link
            href="/deals/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Deal
          </Link>
        </div>

        <DealsTable deals={dealList} />
      </main>
    </div>
  );
}
