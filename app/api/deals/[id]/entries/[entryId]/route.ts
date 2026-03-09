import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id: dealId, entryId } = await params;

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the entity_file belongs to this user's deal via the entity bridge
  const { data: entityRow } = await supabase
    .from("entities")
    .select("id")
    .eq("legacy_deal_id", dealId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!entityRow?.id) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("entity_files")
    .delete()
    .eq("id", entryId)
    .eq("entity_id", entityRow.id as string);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
