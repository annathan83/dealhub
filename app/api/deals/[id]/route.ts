import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { saveTextNoteToDrive } from "@/lib/google/drive";
import { logDealEdited } from "@/lib/services/entity/entityEventService";
import type { Deal } from "@/types";
import { getDealDisplayName } from "@/types";

const VALID_STATUSES = ["active", "closed", "passed"];

function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(/[$,\s]/g, "").toUpperCase();
  const multiplier = s.endsWith("M") ? 1_000_000 : s.endsWith("K") ? 1_000 : 1;
  const num = parseFloat(s.replace(/[MK]$/, ""));
  return isNaN(num) ? null : num * multiplier;
}

function computeMultiple(asking_price: string | null, sde: string | null): string | null {
  const price = parseMoney(asking_price);
  const sdeVal = parseMoney(sde);
  if (!price || !sdeVal || sdeVal === 0) return null;
  return `${(price / sdeVal).toFixed(1)}x`;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Deal Name",
  display_alias: "Display name (alias)",
  description: "Description",
  industry_category: "Industry Category",
  industry: "Industry",
  state: "State",
  county: "County",
  city: "City",
  location: "Location",
  deal_source_category: "Deal Source",
  deal_source_detail: "Source Detail",
  status: "Status",
  asking_price: "Asking Price",
  sde: "SDE",
  multiple: "Multiple",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  closed: "Closed",
  passed: "Passed",
};

function formatValue(field: string, value: string | null): string {
  if (value === null || value === "") return "(empty)";
  if (field === "status") return STATUS_LABELS[value] ?? value;
  return value;
}

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // ── Fetch current deal ────────────────────────────────────────────────────
  const { data: current, error: fetchError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const deal = current as Deal;

  // ── Build update payload ──────────────────────────────────────────────────
  const editableFields = [
    "name", "description", "display_alias",
    "industry_category", "industry",
    "state", "county", "city", "location",
    "deal_source_category", "deal_source_detail",
    "status", "asking_price", "sde", "multiple",
    "broker_name", "broker_email", "broker_phone",
  ] as const;

  type EditableField = typeof editableFields[number];

  const updates: Partial<Record<EditableField, string | null>> = {};

  for (const field of editableFields) {
    if (!(field in body)) continue;
    const val = body[field];
    const normalized = typeof val === "string" ? val.trim() || null : null;

    if (field === "status") {
      if (typeof val !== "string" || !VALID_STATUSES.includes(val)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 422 });
      }
      updates.status = val;
    } else {
      updates[field] = normalized;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // ── Privacy: keep name in sync with display_alias when display_alias is set ──
  if ("display_alias" in updates && updates.display_alias !== undefined) {
    const alias = updates.display_alias?.trim();
    if (alias) updates.name = alias;
  }

  // ── Auto-compute multiple ─────────────────────────────────────────────────
  const effectivePrice = "asking_price" in updates ? updates.asking_price : deal.asking_price;
  const effectiveSde = "sde" in updates ? updates.sde : deal.sde;
  updates.multiple = computeMultiple(effectivePrice ?? null, effectiveSde ?? null);

  // ── Diff — collect what actually changed ──────────────────────────────────
  const changes: { field: string; from: string | null; to: string | null }[] = [];
  for (const [field, newVal] of Object.entries(updates) as [EditableField, string | null][]) {
    const oldVal = (deal[field] as string | null) ?? null;
    if (oldVal !== newVal) {
      changes.push({ field, from: oldVal, to: newVal });
    }
  }

  // ── Apply update (include last_activity_at for privacy-first deal model) ───
  const updatePayload = { ...updates, last_activity_at: new Date().toISOString() };
  const { error: updateError } = await supabase
    .from("deals")
    .update(updatePayload)
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, changes: [] });
  }

  // ── Build human-readable change summary ───────────────────────────────────
  const changeLines = changes.map(
    ({ field, from, to }) =>
      `• ${FIELD_LABELS[field] ?? field}: ${formatValue(field, from)} → ${formatValue(field, to)}`
  );

  const logTitle =
    changes.length === 1
      ? `${FIELD_LABELS[changes[0].field] ?? changes[0].field} updated`
      : `${changes.length} fields updated`;

  const dealName = getDealDisplayName({ ...deal, ...updates });

  // ── Log to entity_events (non-fatal) ─────────────────────────────────────
  const { data: entityRow } = await supabase
    .from("entities")
    .select("id")
    .eq("legacy_deal_id", dealId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (entityRow?.id) {
    logDealEdited(entityRow.id as string, {
      title: logTitle,
      description: changeLines.join("\n"),
      changes: changes.map(({ field, from, to }) => ({ field, from, to })),
    }).catch(() => {});
  }

  // ── Save Drive note (non-fatal) ───────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (tokenRow) {
    try {
      const noteContent = [
        `Deal Edit — ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
        `Deal: ${dealName}`,
        "",
        "Changes:",
        ...changeLines,
      ].join("\n");

      await saveTextNoteToDrive({
        userId: user.id,
        dealId,
        dealName,
        noteContent,
        fileNameSuffix: "deal-edit",
      });
    } catch (driveErr) {
      console.error("Drive note save failed (non-fatal):", driveErr);
    }
  }

  return NextResponse.json({ ok: true, changes });
}

export async function DELETE(
  _request: NextRequest,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
