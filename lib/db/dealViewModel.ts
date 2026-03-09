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
import type { EntityPageData } from "@/types/entity";
import type { KpiScorecardResult } from "@/lib/kpi/kpiConfig";

export type DealPageViewModel = {
  deal: Deal;
  sources: DealSource[];
  analyses: DealSourceAnalysis[];
  changeLog: DealChangeLogItem[];
  driveFiles: DealDriveFile[];
  entityData: EntityPageData | null;
  kpiScorecard: KpiScorecardResult | null;
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

  return {
    deal: dealResult.data as Deal,
    sources: (sourcesResult.data ?? []) as DealSource[],
    analyses: (analysesResult.data ?? []) as DealSourceAnalysis[],
    changeLog: (changeLogResult.data ?? []) as DealChangeLogItem[],
    driveFiles: (driveFilesResult.data ?? []) as DealDriveFile[],
    entityData,
    kpiScorecard,
  };
}
