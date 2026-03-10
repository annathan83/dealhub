/**
 * dealViewModel
 *
 * Assembles all data needed by the deal detail page.
 * Reads exclusively from the new entity-fact-evidence architecture.
 */

import { createClient } from "@/lib/supabase/server";
import { getEntityPageData, getEntityHistory } from "@/lib/db/entities";
import { getLatestKpiScorecard, getScoreHistory, type ScoreHistoryEntry } from "@/lib/kpi/kpiScoringService";
import { getLatestSwotAnalysis, type SwotAnalysisContent } from "@/lib/services/analysis/swotAnalysisService";
import { getLatestMissingInfo, type MissingInfoResult } from "@/lib/services/analysis/missingInfoService";
import type { Deal } from "@/types";
import type { AnalysisSnapshot, EntityPageData, EntityEvent, EntityFile } from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import type { TriageSummaryContent } from "@/lib/services/entity/triageSummaryService";
import type { DeepAnalysisContent } from "@/lib/services/entity/deepAnalysisService";

export type DealPageViewModel = {
  deal: Deal;
  entityData: EntityPageData | null;
  kpiScorecard: KpiScorecardResult | null;
  scoreHistory: ScoreHistoryEntry[];
  triageSummary: TriageSummaryContent | null;
  triageSnapshot: AnalysisSnapshot | null;
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisSnapshot: AnalysisSnapshot | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
  // Incremental revaluation (migration 034)
  revaluationSnapshot: AnalysisSnapshot | null;
  revaluationStale: boolean;
  lastRevaluationAt: string | null;
  entityEvents: EntityEvent[];
  entityFiles: EntityFile[];
  // Auto-generated analysis
  swotAnalysis: SwotAnalysisContent | null;
  missingInfo: MissingInfoResult | null;
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

  const [kpiScorecard, scoreHistory, entityEvents, swotAnalysis, missingInfo] = await Promise.all([
    entityData?.entity
      ? getLatestKpiScorecard(entityData.entity.id).catch(() => null)
      : Promise.resolve(null),
    entityData?.entity
      ? getScoreHistory(entityData.entity.id, 20).catch(() => [])
      : Promise.resolve([]),
    entityData?.entity
      ? getEntityHistory(entityData.entity.id, 50).catch(() => [])
      : Promise.resolve([]),
    entityData?.entity
      ? getLatestSwotAnalysis(entityData.entity.id).catch(() => null)
      : Promise.resolve(null),
    entityData?.entity
      ? getLatestMissingInfo(entityData.entity.id).catch(() => null)
      : Promise.resolve(null),
  ]);

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

  // Extract the most recent incremental revaluation snapshot
  const revaluationSnapshot =
    entityData?.analysis_snapshots
      .filter((s) => s.analysis_type === "revaluation")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  const revaluationStale = entityData?.entity.revaluation_stale ?? false;
  const lastRevaluationAt = entityData?.entity.last_revaluation_at ?? null;

  // entity_files are already loaded in entityData.files
  const entityFiles = entityData?.files.map((f) => f) ?? [];

  return {
    deal: dealResult.data as Deal,
    entityData,
    kpiScorecard,
    scoreHistory,
    triageSummary,
    triageSnapshot,
    deepAnalysis,
    deepAnalysisSnapshot,
    deepAnalysisStale,
    deepAnalysisRunAt,
    latestSourceAt,
    revaluationSnapshot,
    revaluationStale,
    lastRevaluationAt,
    entityEvents,
    entityFiles,
    swotAnalysis,
    missingInfo,
  };
}
