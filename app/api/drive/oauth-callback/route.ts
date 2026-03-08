import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  getGoogleEmail,
} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  const returnTo = state ? decodeURIComponent(state) : "/settings/integrations";

  // ── OAuth error from Google ───────────────────────────────────────────────
  if (error || !code) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=google_auth_failed`
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/signin`);
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error("Token exchange failed:", err);
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=token_exchange_failed`
    );
  }

  // ── Get Google account email ──────────────────────────────────────────────
  const googleEmail = await getGoogleEmail(tokens);

  // ── Persist tokens ────────────────────────────────────────────────────────
  // SECURITY NOTE: tokens are stored in plaintext.
  // For production, encrypt access_token and refresh_token using Supabase Vault
  // or an external KMS before storing. The schema isolates token storage in
  // google_oauth_tokens so encryption can be added without touching other tables.

  const { error: upsertTokenError } = await supabase
    .from("google_oauth_tokens")
    .upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        scope: tokens.scope ?? null,
        token_type: tokens.token_type ?? null,
        expiry_date: tokens.expiry_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertTokenError) {
    console.error("Failed to save tokens:", upsertTokenError.message, upsertTokenError.code, upsertTokenError.details);
    const msg = encodeURIComponent(upsertTokenError.message ?? "unknown");
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=token_save_failed&detail=${msg}`
    );
  }

  // ── Persist connection metadata ───────────────────────────────────────────
  await supabase
    .from("google_drive_connections")
    .upsert(
      {
        user_id: user.id,
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  return NextResponse.redirect(`${origin}${returnTo}?connected=true`);
}
