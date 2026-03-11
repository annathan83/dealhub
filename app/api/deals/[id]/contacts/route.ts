/**
 * /api/deals/[id]/contacts
 *
 * GET    — list all contacts for a deal
 * POST   — create a new contact (user_entered)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDealContacts,
  createDealContact,
  syncPrimaryContactToDeal,
  type ContactRole,
} from "@/lib/services/contacts/dealContactService";

const VALID_ROLES: ContactRole[] = ["broker", "assistant", "seller", "other"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
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

  const contacts = await getDealContacts(dealId, user.id);
  return NextResponse.json({ contacts });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
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

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = (body.role as string) ?? "broker";
  if (!VALID_ROLES.includes(role as ContactRole)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 422 });
  }

  const contact = await createDealContact(dealId, user.id, {
    name: (body.name as string) ?? null,
    role: role as ContactRole,
    phone: (body.phone as string) ?? null,
    email: (body.email as string) ?? null,
    brokerage: (body.brokerage as string) ?? null,
    source_type: "user_entered",
    source_label: "user",
    is_primary: (body.is_primary as boolean) ?? false,
  });

  if (!contact) {
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
  await syncPrimaryContactToDeal(dealId, user.id);
  return NextResponse.json({ contact }, { status: 201 });
}
