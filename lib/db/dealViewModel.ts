/**
 * dealViewModel
 *
 * Assembles all data needed by the deal detail page into a single typed object.
 * This keeps the page.tsx server component thin — one function call, one type.
 *
 * Data fetched:
 *  - deal row (with Phase 3 pointer columns)
 *  - deal_sources + deal_source_analyses (existing timeline)
 *  - deal_change_log (existing activity log)
 *  - deal_drive_files (existing file list — legacy)
 *  - deal_file_derivatives (Phase 1/2)
 *  - latest deal_insights row (Phase 1/2 — kept for backward compat)
 *  - latest deal_opinions row (Phase 3)
 *  - latest deal_opinion_deltas row (Phase 3)
 *
 * All Phase 3 fields are nullable so the page renders correctly before any
 * analysis runs have been executed.
 */

import { createClient } from "@/lib/supabase/server";
import { getLatestInsight } from "@/lib/db/insights";
import { getLatestOpinion } from "@/lib/db/opinions";
import { getLatestDelta } from "@/lib/db/opinionDeltas";
import { listDerivativesForDeal } from "@/lib/db/derivatives";
import type {
  Deal,
  DealSource,
  DealSourceAnalysis,
  DealChangeLogItem,
  DealDriveFile,
  DealFileDerivative,
  DealInsight,
  DealOpinion,
  DealOpinionDelta,
} from "@/types";

// ─── View model type ──────────────────────────────────────────────────────────

export type DealPageViewModel = {
  deal: Deal & {
    last_analysis_run_id: string | null;
    current_opinion_id: string | null;
  };
  sources: DealSource[];
  analyses: DealSourceAnalysis[];
  changeLog: DealChangeLogItem[];
  driveFiles: DealDriveFile[];
  derivatives: DealFileDerivative[];

  // Phase 1/2 — legacy insight (may be null)
  latestInsight: DealInsight | null;

  // Phase 3 — new opinion system (null until first analysis run)
  latestOpinion: DealOpinion | null;
  latestDelta: DealOpinionDelta | null;
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export async function buildDealPageViewModel(
  dealId: string,
  userId: string
): Promise<DealPageViewModel | null> {
  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    dealResult,
    sourcesResult,
    analysesResult,
    changeLogResult,
    driveFilesResult,
    derivatives,
    latestInsight,
    latestOpinion,
    latestDelta,
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("*")
      .eq("id", dealId)
      .eq("user_id", userId)
      .maybeSingle(),

    supabase
      .from("deal_sources")
      .select("*")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("deal_source_analyses")
      .select("*")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("deal_change_log")
      .select("*")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    supabase
      .from("deal_drive_files")
      .select("*")
      .eq("deal_id", dealId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    listDerivativesForDeal(dealId, userId),
    getLatestInsight(dealId, userId),
    getLatestOpinion(dealId),
    getLatestDelta(dealId),
  ]);

  if (!dealResult.data) return null;

  const deal = dealResult.data as Deal & {
    last_analysis_run_id: string | null;
    current_opinion_id: string | null;
  };

  // Ensure pointer columns exist (graceful if migration 009 not yet run)
  if (!("last_analysis_run_id" in deal)) {
    (deal as Record<string, unknown>).last_analysis_run_id = null;
  }
  if (!("current_opinion_id" in deal)) {
    (deal as Record<string, unknown>).current_opinion_id = null;
  }

  return {
    deal,
    sources: (sourcesResult.data ?? []) as DealSource[],
    analyses: (analysesResult.data ?? []) as DealSourceAnalysis[],
    changeLog: (changeLogResult.data ?? []) as DealChangeLogItem[],
    driveFiles: (driveFilesResult.data ?? []) as DealDriveFile[],
    derivatives,
    latestInsight,
    latestOpinion,
    latestDelta,
  };
}
