/**
 * PATCH /api/deals/[id]/facts/[factId]
 *
 * Manually update a fact value for a deal entity.
 * Supports: confirm, edit, override, mark_conflict, mark_missing
 *
 * Body:
 *   change_type: "confirm" | "edit" | "override" | "mark_conflict" | "mark_missing"
 *   value_raw?:  string | null   (required for edit/override, omit for confirm/mark_*)
 *   note?:       string          (optional user note)
 *
 * After update, runs the full post-fact pipeline (score → SWOT → missing info).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEntityByLegacyDealId, manuallyUpdateFactValue } from "@/lib/db/entities";
import { runPostFactPipeline } from "@/lib/services/analysis/postFactOrchestrator";
import { insertEntityEvent } from "@/lib/db/entities";
import type { FactChangeType, FactValueStatus } from "@/types/entity";

const CHANGE_TYPE_TO_STATUS: Record<FactChangeType, FactValueStatus> = {
  confirm:        "confirmed",
  edit:           "confirmed",
  override:       "confirmed",
  mark_conflict:  "conflicting",
  mark_missing:   "missing",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; factId: string }> }
) {
  const { id: dealId, factId: factDefinitionId } = await params;

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

  const entity = await getEntityByLegacyDealId(dealId, user.id);
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  let body: {
    change_type: FactChangeType;
    value_raw?: string | null;
    note?: string | null;
    old_value?: string | null;
    old_status?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { change_type, value_raw, note, old_value, old_status } = body;

  const validTypes: FactChangeType[] = ["confirm", "edit", "override", "mark_conflict", "mark_missing"];
  if (!validTypes.includes(change_type)) {
    return NextResponse.json({ error: "Invalid change_type" }, { status: 400 });
  }

  const newStatus = CHANGE_TYPE_TO_STATUS[change_type];

  // For confirm, keep the existing value_raw (pass null to preserve)
  const newValue = change_type === "confirm" ? (old_value ?? null) : (value_raw ?? null);

  const updated = await manuallyUpdateFactValue({
    entity_id: entity.id,
    fact_definition_id: factDefinitionId,
    value_raw: newValue,
    status: newStatus,
    change_type,
    changed_by: user.id,
    note: note ?? null,
    old_value: old_value ?? null,
    old_status: old_status ?? null,
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update fact" }, { status: 500 });
  }

  // Log the event
  const eventType = change_type === "confirm" ? "fact_manually_confirmed" : "fact_manually_edited";
  await insertEntityEvent({
    entity_id: entity.id,
    event_type: eventType,
    fact_definition_id: factDefinitionId,
    metadata_json: {
      change_type,
      old_value: old_value ?? null,
      new_value: newValue,
      note: note ?? null,
    },
  }).catch(() => {});

  // Run the full post-fact pipeline: score → SWOT → missing info (all non-fatal)
  const triggerReason = note
    ? `${change_type} — ${note}`
    : change_type === "confirm"
      ? "Fact confirmed"
      : change_type === "edit" || change_type === "override"
        ? `Fact updated${newValue ? ` to ${newValue}` : ""}`
        : `Fact marked ${change_type.replace("mark_", "")}`;

  // Fetch industry from entity metadata for missing info detection
  const industry = (entity as { industry?: string | null }).industry ?? null;

  runPostFactPipeline({
    entityId: entity.id,
    entityTypeId: entity.entity_type_id,
    entityTitle: entity.title,
    industry,
    triggerType: "fact_change",
    triggerReason,
    changedFactKey: factDefinitionId,
  }).catch((err) => {
    console.error("[facts/route] post-fact pipeline failed (non-fatal):", err);
  });

  return NextResponse.json({ success: true, fact: updated });
}
