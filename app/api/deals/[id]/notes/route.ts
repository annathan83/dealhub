/**
 * POST /api/deals/:id/notes
 *
 * Alias for adding a note to a deal. Same flow as POST /api/deals/:id/entries:
 * body: { content: string } → save to Drive raw/, AI title, ingest, timeline "Note added".
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createNoteForDeal } from "@/lib/services/entity/dealNoteService";
import type { Deal } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

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

  let content: string;
  try {
    const body = await request.json();
    content = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("id, name, description")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const deal = dealData as Pick<Deal, "id" | "name" | "description">;
  const { title } = await createNoteForDeal(supabase, dealId, user.id, content, deal);
  return NextResponse.json({ ok: true, title }, { status: 201 });
}
