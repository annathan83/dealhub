import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureDealSubfolders } from "@/lib/google/drive";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
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

  let body: {
    name?: string;
    industry?: string | null;
    location?: string | null;
    asking_price?: string | null;
    sde?: string | null;
    multiple?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Deal name is required." }, { status: 422 });
  }

  // ── 1. Insert the deal row ────────────────────────────────────────────────
  const { data: deal, error: insertError } = await supabase
    .from("deals")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      industry: body.industry?.trim() || null,
      location: body.location?.trim() || null,
      status: "new",
      asking_price: body.asking_price?.trim() || null,
      sde: body.sde?.trim() || null,
      multiple: body.multiple?.trim() || null,
    })
    .select("id, name")
    .single();

  if (insertError || !deal) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create deal." },
      { status: 500 }
    );
  }

  // ── 2. Provision Drive folder + subfolders (non-fatal if Drive not connected) ─
  // Creates: DealHub/{name}__{id}/raw/, /derived/, /intelligence/
  // If Drive isn't connected yet the folders are created lazily on first upload.
  let driveFolderError: string | null = null;
  try {
    await ensureDealSubfolders(user.id, deal.id as string, deal.name as string);
  } catch (err) {
    // Non-fatal — folders will be created lazily on first upload if this fails.
    driveFolderError = err instanceof Error ? err.message : "Drive folders could not be created.";
    console.warn(`[createDeal] Drive folder creation skipped for deal ${deal.id}:`, driveFolderError);
  }

  return NextResponse.json(
    { id: deal.id, name: deal.name, driveFolderError },
    { status: 201 }
  );
}
