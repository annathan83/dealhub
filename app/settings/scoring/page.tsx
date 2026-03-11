import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ScoringWeightsForm from "@/components/ScoringWeightsForm";

export default async function ScoringSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data } = await supabase
    .from("user_settings")
    .select("default_scoring_config")
    .eq("user_id", user.id)
    .maybeSingle();

  const defaultConfig = (data?.default_scoring_config as Record<string, number> | null) ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Scoring Weights
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set your default KPI weights. These are applied to every new deal and can be overridden per-deal in the Facts tab.
          </p>
        </div>

        <ScoringWeightsForm initialConfig={defaultConfig} />
      </main>
    </div>
  );
}
