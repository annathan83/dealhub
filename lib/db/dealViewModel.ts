/**
 * dealViewModel
 *
 * Assembles all data needed by the deal detail page.
 * Reads exclusively from the new entity-fact-evidence architecture.
 */

import { createClient } from "@/lib/supabase/server";
import { getEntityPageData, getEntityHistory } from "@/lib/db/entities";
import { getLatestKpiScorecard } from "@/lib/kpi/kpiScoringService";
import type { Deal } from "@/types";
import type { AnalysisSnapshot, EntityPageData, EntityEvent, EntityFile } from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import type { TriageSummaryContent } from "@/lib/services/entity/triageSummaryService";
import type { DeepAnalysisContent } from "@/lib/services/entity/deepAnalysisService";

export type DealPageViewModel = {
  deal: Deal;
  entityData: EntityPageData | null;
  kpiScorecard: KpiScorecardResult | null;
  triageSummary: TriageSummaryContent | null;
  triageSnapshot: AnalysisSnapshot | null;
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisSnapshot: AnalysisSnapshot | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
  entityEvents: EntityEvent[];
  entityFiles: EntityFile[];
};

export async function buildDealPageViewModel(
  dealId: string,
  userId: string
): Promise<DealPageViewModel | null> {
  const supabase = await createClient();

  const [dealResult, entityData] = await Promise.all([
    supabase.from("deals").select("*").eq("id", dealId).eq("user_id", userId).maybeSingle(),
    getEntityPageData(dealId, userId).catch(() => null),
  ]);

  if (!dealResult.data) return null;

  const kpiScorecard = entityData?.entity
    ? await getLatestKpiScorecard(entityData.entity.id).catch(() => null)
    : null;

  const entityEvents = entityData?.entity
    ? await getEntityHistory(entityData.entity.id, 50).catch(() => [])
    : [];

  // Extract the most recent triage_summary snapshot for the Initial Review panel
  const triageSnapshot =
    entityData?.analysis_snapshots.find((s) => s.analysis_type === "triage_summary") ?? null;
  const triageSummary = triageSnapshot
    ? (triageSnapshot.content_json as unknown as TriageSummaryContent)
    : null;

  // Extract the most recent deep_analysis snapshot
  const deepAnalysisSnapshot =
    entityData?.analysis_snapshots.find((s) => s.analysis_type === "deep_analysis") ?? null;
  const deepAnalysis = deepAnalysisSnapshot
    ? (deepAnalysisSnapshot.content_json as unknown as DeepAnalysisContent)
    : null;

  const deepAnalysisStale = entityData?.entity.deep_analysis_stale ?? false;
  const deepAnalysisRunAt = entityData?.entity.deep_analysis_run_at ?? null;
  const latestSourceAt = entityData?.entity.latest_source_at ?? null;

  // entity_files are already loaded in entityData.files
  const entityFiles = entityData?.files.map((f) => f) ?? [];

  return {
    deal: dealResult.data as Deal,
    entityData,
    kpiScorecard,
    triageSummary,
    triageSnapshot,
    deepAnalysis,
    deepAnalysisSnapshot,
    deepAnalysisStale,
    deepAnalysisRunAt,
    latestSourceAt,
    entityEvents,
    entityFiles,
  };
}
