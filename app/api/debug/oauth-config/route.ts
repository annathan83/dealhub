/**
 * Debug endpoint — shows what OAuth config values the server is actually using.
 * Gated behind DEBUG_SECRET env var to prevent credential exposure in production.
 * GET /api/debug/oauth-config?secret=DEBUG_SECRET
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Require both a valid debug secret AND an authenticated session.
  const debugSecret = process.env.DEBUG_SECRET;
  if (!debugSecret) {
    return NextResponse.json({ error: "Debug endpoints are disabled" }, { status: 403 });
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== debugSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
