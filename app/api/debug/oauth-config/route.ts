/**
 * Debug endpoint — shows what OAuth config values the server is actually using.
 * Only accessible to authenticated users.
 * GET /api/debug/oauth-config
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "";

  return NextResponse.json({
    GOOGLE_OAUTH_CLIENT_ID: clientId
      ? `${clientId.slice(0, 12)}...${clientId.slice(-8)}`
      : "(not set)",
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret
      ? `${clientSecret.slice(0, 8)}...${clientSecret.slice(-4)}`
      : "(not set)",
    GOOGLE_OAUTH_REDIRECT_URI: redirectUri || "(not set)",
    redirect_uri_looks_correct: redirectUri.includes("/api/drive/oauth-callback"),
  });
}
