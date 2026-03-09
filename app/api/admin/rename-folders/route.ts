/**
 * One-time admin endpoint to rename existing Drive deal folders to the new
 * naming convention: {deal-id}_{sanitized-name}
 *
 * Protected by a secret key. Call once then delete this file.
 * GET /api/admin/rename-folders?secret=RENAME_SECRET
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthorizedDriveClient, buildDealFolderName } from "@/lib/google/drive";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.RENAME_SECRET && secret !== "dealhub-rename-2026") {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all deals belonging to this user that have a Drive folder
  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, name, deal_number, google_drive_folder_id")
    .eq("user_id", user.id)
    .not("google_drive_folder_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const drive = await getAuthorizedDriveClient(user.id);
  const results = [];

  for (const deal of deals ?? []) {
    const newName = buildDealFolderName(deal.deal_number as number, deal.name as string);
    try {
      const { data: file } = await drive.files.get({
        fileId: deal.google_drive_folder_id as string,
        fields: "id,name",
      });

      if (file.name === newName) {
        results.push({ deal: deal.name, status: "already_correct", name: newName });
        continue;
      }

      await drive.files.update({
        fileId: deal.google_drive_folder_id as string,
        requestBody: { name: newName },
        fields: "id,name",
      });

      results.push({ deal: deal.name, status: "renamed", from: file.name, to: newName });
    } catch (err) {
      results.push({ deal: deal.name, status: "error", error: (err as Error).message });
    }
  }

  return NextResponse.json({ results });
}
