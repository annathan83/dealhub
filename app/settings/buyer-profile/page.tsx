import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BuyerProfileForm from "@/components/BuyerProfileForm";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";

export default async function BuyerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("buyer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Buyer Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tell us what you&apos;re looking for. This powers the Buyer Fit analysis on every deal.
          </p>
        </div>
        <BuyerProfileForm initialProfile={(profile as BuyerProfile) ?? null} />
      </main>
    </div>
  );
}
