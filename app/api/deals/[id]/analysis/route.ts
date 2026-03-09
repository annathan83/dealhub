/**
 * POST /api/deals/[id]/analysis
 *
 * Triggers the full Layer 3 → Layer 4 pipeline independently:
 *   1. Compute KPI scorecard from current entity_fact_values
 *   2. Run AI analysis from facts + KPI scores
 *   3. Return the results immediately (also persisted to analysis_snapshots)
 *
 * This endpoint allows the UI to trigger re-analysis without re-uploading files.
 * It is idempotent — safe to call multiple times.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEntityByLegacyDealId } from "@/lib/db/entities";
import { scoreAndPersistKpis } from "@/lib/kpi/kpiScoringService";
import { refreshAnalysis } from "@/lib/services/entity/analysisService";

export const maxDuration = 60;

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

  // Resolve entity for this deal
  const entity = await getEntityByLegacyDealId(dealId, user.id);
  if (!entity) {
    return NextResponse.json(
      { error: "Entity not found. Upload a document or entry first." },
      { status: 404 }
    );
  }

  // Run KPI scoring (Layer 3 → Layer 4)
  const scorecard = await scoreAndPersistKpis(entity.id, entity.entity_type_id);

  // Run AI analysis (Layer 4 — reads facts + KPI context)
  const snapshot = await refreshAnalysis(entity.id, entity.entity_type_id, entity.title);

  return NextResponse.json({
    entity_id: entity.id,
    scorecard: {
      overall_score: scorecard.overall_score,
      overall_score_100: scorecard.overall_score_100,
      coverage_pct: scorecard.coverage_pct,
      missing_count: scorecard.missing_count,
      kpi_count: scorecard.kpis.length,
    },
    analysis: snapshot
      ? {
          id: snapshot.id,
          analysis_type: snapshot.analysis_type,
          created_at: snapshot.created_at,
        }
      : null,
  });
}
