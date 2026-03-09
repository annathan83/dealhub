import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { saveTextNoteToDrive } from "@/lib/google/drive";
import type { Deal } from "@/types";

const VALID_STATUSES = ["new", "reviewing", "due_diligence", "offer", "closed", "passed"];

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

// Human-readable labels for diff output
const FIELD_LABELS: Record<string, string> = {
  name: "Deal Name",
  description: "Description",
  industry: "Industry",
  location: "Location",
  status: "Status",
  asking_price: "Asking Price",
  sde: "SDE",
  multiple: "Multiple",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewing: "Reviewing",
  due_diligence: "Due Diligence",
  offer: "Offer",
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
  // Accept only known editable fields
  const editableFields = [
    "name", "description", "industry", "location",
    "status", "asking_price", "sde", "multiple",
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

  // ── Auto-compute multiple ─────────────────────────────────────────────────
  // Use the incoming value if provided, otherwise fall back to the current stored value
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

  // ── Apply update ──────────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", dealId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Nothing actually changed — return early, no log needed
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

  const logDescription = changeLines.join("\n");

  const dealName = (updates.name ?? deal.name) as string;

  // ── Write change-log entry ────────────────────────────────────────────────
  await supabase.from("deal_change_log").insert({
    deal_id: dealId,
    user_id: user.id,
    deal_source_id: null,
    related_google_file_id: null,
    change_type: "deal_edited",
    title: logTitle,
    description: logDescription,
  });

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
