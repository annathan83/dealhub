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
    <div className="min-h-screen bg-[#F8FAF9]">
      <AppHeader />

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#1E1E1E] tracking-tight leading-tight">
            New Deal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Paste a listing or fill in the key numbers. AI scores the deal automatically.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm px-5 py-6 sm:px-7 sm:py-7">
          <CreateDealForm />
        </div>

        {/* Helper note */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Minimum needed: industry, location, asking price, SDE
        </p>
      </main>
    </div>
  );
}
