/**
 * PATCH /api/deals/[id]/scoring-config
 *
 * Saves per-deal custom scoring weights to entity.metadata_json.scoring_config.
 * After saving, triggers an immediate KPI rescore.
 *
 * Body:
 *   scoring_config: Record<string, number>  — fact_key → weight (0–1)
 *                   Empty object = use default KPI weights
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEntityByLegacyDealId } from "@/lib/db/entities";
import { runPostFactPipeline } from "@/lib/services/analysis/postFactOrchestrator";

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

  const entity = await getEntityByLegacyDealId(dealId, user.id);
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  let body: { scoring_config: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scoring_config } = body;
  if (!scoring_config || typeof scoring_config !== "object") {
    return NextResponse.json({ error: "scoring_config must be an object" }, { status: 400 });
  }

  // Validate: all values must be numbers between 0 and 1
  for (const [key, weight] of Object.entries(scoring_config)) {
    if (typeof weight !== "number" || weight < 0 || weight > 1) {
      return NextResponse.json(
        { error: `Invalid weight for "${key}": must be a number between 0 and 1` },
        { status: 400 }
      );
    }
  }

  // Merge scoring_config into entity metadata_json
  const existingMeta = (entity.metadata_json as Record<string, unknown>) ?? {};
  const updatedMeta = { ...existingMeta, scoring_config };

  const { error } = await supabase
    .from("entities")
    .update({ metadata_json: updatedMeta })
    .eq("id", entity.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger immediate rescore with the new weights (fire-and-forget)
  const industry = (entity as { industry?: string | null }).industry ?? null;
  runPostFactPipeline({
    entityId: entity.id,
    entityTypeId: entity.entity_type_id,
    entityTitle: entity.title,
    industry,
    triggerType: "fact_change",
    triggerReason: "Scoring weights updated",
  }).catch((err) => {
    console.error("[scoring-config] post-fact pipeline failed (non-fatal):", err);
  });

  return NextResponse.json({ success: true, scoring_config });
}
