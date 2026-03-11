/**
 * /api/deals/[id]/contacts/[contactId]
 *
 * PATCH  — update a contact (marks as user_entered)
 * DELETE — delete a contact
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  updateDealContact,
  deleteDealContact,
  syncPrimaryContactToDeal,
  type ContactRole,
} from "@/lib/services/contacts/dealContactService";

const VALID_ROLES: ContactRole[] = ["broker", "assistant", "seller", "other"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: dealId, contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify deal ownership (RLS also enforces this, but explicit check gives better 404 vs 403)
  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.role !== undefined && !VALID_ROLES.includes(body.role as ContactRole)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 422 });
  }

  const updated = await updateDealContact(contactId, user.id, {
    ...(body.name !== undefined && { name: body.name as string | null }),
    ...(body.role !== undefined && { role: body.role as ContactRole }),
    ...(body.phone !== undefined && { phone: body.phone as string | null }),
    ...(body.email !== undefined && { email: body.email as string | null }),
    ...(body.brokerage !== undefined && { brokerage: body.brokerage as string | null }),
    ...(body.is_primary !== undefined && { is_primary: body.is_primary as boolean }),
    // Any user edit marks the contact as user_entered (preserves from AI overwrite)
    source_type: "user_entered",
    source_label: "user",
  });

  if (!updated) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  await syncPrimaryContactToDeal(dealId, user.id);
  return NextResponse.json({ contact: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: dealId, contactId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify deal ownership
  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const ok = await deleteDealContact(contactId, user.id);
  if (!ok) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  await syncPrimaryContactToDeal(dealId, user.id);
  return NextResponse.json({ ok: true });
}
