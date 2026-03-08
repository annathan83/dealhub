import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import ConnectGoogleDriveCard from "@/components/ConnectGoogleDriveCard";
import type { GoogleDriveConnection } from "@/types";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string }>;
}) {
  const { connected, error, detail } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const { data: connectionData } = await supabase
    .from("google_drive_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const connection = connectionData as GoogleDriveConnection | null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Integrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect external services to enhance your DealHub workspace.
          </p>
        </div>

        {/* Success / error banners */}
        {connected === "true" && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
            Google Drive connected successfully.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex flex-col gap-1">
            <span>
              {error === "google_auth_failed" && "Google authorization was cancelled or failed. Please try again."}
              {error === "token_exchange_failed" && "Failed to exchange authorization code. Please try again."}
              {error === "token_save_failed" && "Connected to Google but failed to save tokens. Please try again."}
              {!["google_auth_failed", "token_exchange_failed", "token_save_failed"].includes(error) && "An error occurred. Please try again."}
            </span>
            {detail && (
              <span className="font-mono text-xs text-red-500 break-all">
                Detail: {decodeURIComponent(detail)}
              </span>
            )}
          </div>
        )}

        <ConnectGoogleDriveCard connection={connection} />
      </main>
    </div>
  );
}
