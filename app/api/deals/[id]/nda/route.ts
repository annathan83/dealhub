/**
 * PATCH /api/deals/[id]/nda
 *
 * Manual NDA milestone override. Allows users to:
 *   - Mark NDA as signed   { signed: true }
 *   - Mark NDA as not signed { signed: false }
 *
 * Manual decisions are stored with source = "manual" or "override".
 * They will NOT be overwritten by subsequent auto-detection.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logNdaStatusUpdated } from "@/lib/services/entity/entityEventService";

export async function PATCH(
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

  let body: { signed: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (typeof body.signed !== "boolean") {
    return NextResponse.json({ error: "signed must be a boolean" }, { status: 422 });
  }

  // Fetch current deal to check ownership and existing source
  const { data: current } = await supabase
    .from("deals")
    .select("id, nda_signed, nda_signed_source")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (!current) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Determine source: if previously auto-detected, this becomes an "override"
  const source =
    current.nda_signed_source === "auto" ? "override" : "manual";

  const updates = body.signed
    ? {
        nda_signed: true,
        nda_signed_at: new Date().toISOString(),
        nda_signed_confidence: null,
        nda_signed_notes: "Manually marked as signed",
        nda_signed_source: source,
      }
    : {
        nda_signed: false,
        nda_signed_at: null,
        nda_signed_confidence: null,
        nda_signed_notes: "Manually marked as not signed",
        nda_signed_source: source,
      };

  const { error: updateError } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log to entity timeline (non-fatal)
  const { data: entityRow } = await supabase
    .from("entities")
    .select("id")
    .eq("legacy_deal_id", dealId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (entityRow?.id) {
    logNdaStatusUpdated(entityRow.id as string, {
      signed: body.signed,
      source,
      display_summary: body.signed
        ? "NDA manually marked as signed."
        : "NDA manually marked as not signed.",
    }, { actorUserId: user.id }).catch(() => {});
  }

  return NextResponse.json({ ok: true, signed: body.signed, source });
}
