/**
 * dealViewModel
 *
 * Assembles all data needed by the deal detail page.
 * Reads from the new entity-fact-evidence architecture.
 * Legacy tables kept: deal_sources, deal_source_analyses, deal_change_log, deal_drive_files
 */

import { createClient } from "@/lib/supabase/server";
import { getEntityPageData } from "@/lib/db/entities";
import { getLatestKpiScorecard } from "@/lib/kpi/kpiScoringService";
import type { Deal, DealSource, DealSourceAnalysis, DealChangeLogItem, DealDriveFile } from "@/types";
import type { AnalysisSnapshot, EntityPageData } from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";
import type { TriageSummaryContent } from "@/lib/services/entity/triageSummaryService";
import type { DeepAnalysisContent } from "@/lib/services/entity/deepAnalysisService";

export type DealPageViewModel = {
  deal: Deal;
  sources: DealSource[];
  analyses: DealSourceAnalysis[];
  changeLog: DealChangeLogItem[];
  driveFiles: DealDriveFile[];
  entityData: EntityPageData | null;
  kpiScorecard: KpiScorecardResult | null;
  triageSummary: TriageSummaryContent | null;
  triageSnapshot: AnalysisSnapshot | null;
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisSnapshot: AnalysisSnapshot | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
};

export async function buildDealPageViewModel(
  dealId: string,
  userId: string
): Promise<DealPageViewModel | null> {
  const supabase = await createClient();

  const [
    dealResult,
    sourcesResult,
    analysesResult,
    changeLogResult,
    driveFilesResult,
    entityData,
  ] = await Promise.all([
    supabase.from("deals").select("*").eq("id", dealId).eq("user_id", userId).maybeSingle(),
    supabase.from("deal_sources").select("*").eq("deal_id", dealId).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("deal_source_analyses").select("*").eq("deal_id", dealId).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("deal_change_log").select("*").eq("deal_id", dealId).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("deal_drive_files").select("*").eq("deal_id", dealId).eq("user_id", userId).order("created_at", { ascending: false }),
    getEntityPageData(dealId, userId).catch(() => null),
  ]);

  if (!dealResult.data) return null;

  const kpiScorecard = entityData?.entity
    ? await getLatestKpiScorecard(entityData.entity.id).catch(() => null)
    : null;

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

  // Staleness and last-run timestamp come from the entity record
  const deepAnalysisStale = entityData?.entity.deep_analysis_stale ?? false;
  const deepAnalysisRunAt = entityData?.entity.deep_analysis_run_at ?? null;
  const latestSourceAt = entityData?.entity.latest_source_at ?? null;

  return {
    deal: dealResult.data as Deal,
    sources: (sourcesResult.data ?? []) as DealSource[],
    analyses: (analysesResult.data ?? []) as DealSourceAnalysis[],
    changeLog: (changeLogResult.data ?? []) as DealChangeLogItem[],
    driveFiles: (driveFilesResult.data ?? []) as DealDriveFile[],
    entityData,
    kpiScorecard,
    triageSummary,
    triageSnapshot,
    deepAnalysis,
    deepAnalysisSnapshot,
    deepAnalysisStale,
    deepAnalysisRunAt,
    latestSourceAt,
  };
}
