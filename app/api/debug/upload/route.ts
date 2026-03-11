/**
 * Debug endpoint for upload troubleshooting.
 * Gated behind DEBUG_SECRET env var to prevent information disclosure in production.
 * GET /api/debug/upload?secret=DEBUG_SECRET            — full prerequisite check
 * GET /api/debug/upload?secret=...&dealId=X            — also checks entity + Drive folder
 * GET /api/debug/upload?secret=...&testDrive=1         — also makes a live Drive API call
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  // Require debug secret before doing anything else.
  const debugSecret = process.env.DEBUG_SECRET;
  if (!debugSecret) {
    return NextResponse.json({ error: "Debug endpoints are disabled" }, { status: 403 });
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== debugSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated", auth_error: authError?.message },
      { status: 401 }
    );
  }

  // Check Google OAuth tokens
  const { data: tokenRow, error: tokenError } = await supabase
    .from("google_oauth_tokens")
    .select("id, expiry_date, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Check Google Drive connection
  const { data: driveConn, error: driveConnError } = await supabase
    .from("google_drive_connections")
    .select("root_folder_id, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Check entity exists for a given deal (if dealId provided in query)
  const dealId = request.nextUrl.searchParams.get("dealId");
  let entityCheck = null;
  if (dealId) {
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, title, deep_analysis_stale, latest_source_at")
      .eq("legacy_deal_id", dealId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, name, status, google_drive_folder_id")
      .eq("id", dealId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { count: fileCount } = await supabase
      .from("entity_files")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", entity?.id ?? "00000000-0000-0000-0000-000000000000");

    const { count: textCount } = await supabase
      .from("file_texts")
      .select("id", { count: "exact", head: true })
      .in(
        "file_id",
        entity?.id
          ? (await supabase.from("entity_files").select("id").eq("entity_id", entity.id)).data?.map((r) => r.id) ?? []
          : []
      );

    entityCheck = {
      deal: deal ?? null,
      deal_error: dealError?.message ?? null,
      entity: entity ?? null,
      entity_error: entityError?.message ?? null,
      entity_file_count: fileCount ?? 0,
      file_text_count: textCount ?? 0,
    };
  }

  // Check env vars (existence only, not values)
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: !!process.env.GOOGLE_OAUTH_REDIRECT_URI,
  };

  // Optional live Drive API test
  let driveApiTest: { ok: boolean; error?: string; files_count?: number } | null = null;
  if (request.nextUrl.searchParams.get("testDrive") === "1" && tokenRow) {
    try {
      const { getAuthorizedDriveClient } = await import("@/lib/google/drive");
      const drive = await getAuthorizedDriveClient(user.id);
      const res = await drive.files.list({ pageSize: 1, fields: "files(id)" });
      driveApiTest = { ok: true, files_count: res.data.files?.length ?? 0 };
    } catch (err) {
      driveApiTest = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const isExpired = tokenRow?.expiry_date
    ? new Date(Number(tokenRow.expiry_date)) < new Date()
    : null;

  return NextResponse.json({
    ok: true,
    user_id: user.id,
    user_email: user.email,
    google_oauth_token: tokenRow
      ? {
          exists: true,
          token_id: tokenRow.id,
          expiry_date: tokenRow.expiry_date,
          updated_at: tokenRow.updated_at,
          is_expired: isExpired,
        }
      : { exists: false, error: tokenError?.message },
    google_drive_connection: driveConn
      ? {
          exists: true,
          root_folder_id: driveConn.root_folder_id,
          updated_at: driveConn.updated_at,
        }
      : { exists: false, error: driveConnError?.message },
    env_vars: envCheck,
    ...(driveApiTest ? { drive_api_test: driveApiTest } : {}),
    ...(entityCheck ? { entity_check: entityCheck } : {}),
  });
}
