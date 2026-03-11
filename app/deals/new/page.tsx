import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import CreateDealForm from "@/components/CreateDealForm";

export default async function NewDealPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
            Add Deal
          </h1>
          <p className="text-sm text-slate-500">
            Paste a listing or enter key numbers — AI extracts facts and scores the deal instantly.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
          <CreateDealForm />
        </div>
      </main>
    </div>
  );
}
