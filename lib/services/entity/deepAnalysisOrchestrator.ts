/**
 * deepAnalysisOrchestrator
 *
 * Single entry point for the user-triggered Deep Analysis flow.
 * Called by POST /api/deals/[id]/deep-analysis.
 *
 * Pipeline:
 *   1. Resolve entity from deal ID
 *   2. Guard against concurrent runs (via processing_runs status check)
 *   3. Create a processing_run record for this deep_analysis run
 *   4. (Status transition removed — simplified 3-status model: active/closed/passed)
 *   5. Log deep_analysis_started event (with run_id)
 *   6. Run deep fact scan (reuses stored file texts, no re-upload)
 *   7. Build analysis context (facts + text corpus)
 *   8. Run deep AI analysis → analysis_snapshot (linked to run_id)
 *   9. Mark entity deep_analysis_run_at = now(), deep_analysis_stale = false
 *  10. Update processing_run to completed
 *  11. Log deep_analysis_completed event
 *
 * Never auto-runs. Always user-triggered.
 * Non-fatal at each step — partial results are still persisted.
 *
 * Migration 027: deprecated deep_scan_* columns removed from entities.
 * processing_runs is now the sole source of truth for run history.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getEntityByLegacyDealId,
  createProcessingRun,
  updateProcessingRun,
  getLatestProcessingRun,
} from "@/lib/db/entities";
import { runDeepScan } from "../facts/deepScanService";
import { buildAnalysisContext } from "./analysisContextBuilder";
import { runDeepAnalysis } from "./deepAnalysisService";
import { logEntityEvent } from "./entityEventService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeepAnalysisOrchestratorResult = {
  success: boolean;
  snapshot_id: string | null;
  run_id: string | null;
  facts_updated: number;
  deal_status_changed: boolean;
  error?: string;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full deep analysis pipeline for a deal.
 * Resolves entity from legacy deal ID, then orchestrates all steps.
 *
 * No status transitions — deal status is managed by the user (active/closed/passed).
 * Deep analysis runs regardless of current status (except passed).
 */
export async function runDeepAnalysisForDeal(
  dealId: string,
  userId: string,
  trigger: string = "manual_run"
): Promise<DeepAnalysisOrchestratorResult> {
  const result: DeepAnalysisOrchestratorResult = {
    success: false,
    snapshot_id: null,
    run_id: null,
    facts_updated: 0,
    deal_status_changed: false,
  };

  try {
    const supabase = await createClient();

    // ── 1. Resolve entity ────────────────────────────────────────────────────
    const entity = await getEntityByLegacyDealId(dealId, userId);
    if (!entity) {
      result.error = "Entity not found for this deal. Upload a document or paste text first.";
      return result;
    }

    // ── 2. Concurrent-run guard ──────────────────────────────────────────────
    // processing_runs is the sole source of truth for active run detection.
    const latestRun = await getLatestProcessingRun(entity.id, "deep_analysis");
    if (latestRun?.status === "running") {
      result.error = "A deep analysis is already running for this deal. Please wait for it to complete.";
      return result;
    }

    // ── 3. Create processing_run record ─────────────────────────────────────
    const triggerType = trigger === "re_run" ? "re_run" : "user";
    const processingRun = await createProcessingRun({
      entity_id: entity.id,
      run_type: "deep_analysis",
      triggered_by_type: triggerType,
      triggered_by_user_id: userId,
    });
    const runId = processingRun?.id ?? null;
    result.run_id = runId;

    if (runId) {
      await updateProcessingRun(runId, { status: "running" });
    }

    // ── 4. (Status transition removed — simplified 3-status model) ─────────

    // ── 5. Log start event ───────────────────────────────────────────────────
    await logEntityEvent(entity.id, "deep_analysis_started", { trigger }, undefined, undefined, { runId });

    // ── 6. Deep fact scan (reuses stored text — no re-upload) ────────────────
    const scanResult = await runDeepScan(entity.id, entity.entity_type_id, entity.title);
    result.facts_updated = scanResult.facts_inserted + scanResult.facts_updated;

    if (scanResult.error) {
      console.warn("[deepAnalysisOrchestrator] Deep scan had errors (continuing):", scanResult.error);
    }

    // ── 7. Build analysis context ────────────────────────────────────────────
    const context = await buildAnalysisContext(entity.id, entity.entity_type_id, entity.title);

    // ── 8. Run deep AI analysis — pass run_id for snapshot linkage ───────────
    const snapshot = await runDeepAnalysis(entity.id, entity.title, context, trigger, runId);
    result.snapshot_id = snapshot?.id ?? null;

    // ── 9. Mark entity as analyzed, clear stale flag ─────────────────────────
    await supabase
      .from("entities")
      .update({
        deep_analysis_run_at: new Date().toISOString(),
        deep_analysis_stale: false,
      })
      .eq("id", entity.id);

    // ── 10. Update processing_run to completed ───────────────────────────────
    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        output_summary_json: {
          snapshot_id: snapshot?.id ?? null,
          facts_updated: result.facts_updated,
          source_count: context.source_count,
          total_text_chars: context.total_text_chars,
          had_scan_error: !!scanResult.error,
        },
      });
    }

    // ── 11. Log completion event ─────────────────────────────────────────────
    await logEntityEvent(entity.id, "deep_analysis_completed", {
      trigger,
      run_id: runId,
      snapshot_id: snapshot?.id ?? null,
      facts_updated: result.facts_updated,
      source_count: context.source_count,
      total_text_chars: context.total_text_chars,
      had_scan_error: !!scanResult.error,
    }, undefined, undefined, { runId });

    result.success = true;
    return result;
  } catch (err) {
    console.error("[deepAnalysisOrchestrator] runDeepAnalysisForDeal failed:", err);
    result.error = err instanceof Error ? err.message : "Unknown error";

    // Update processing_run to failed if we have a run_id
    if (result.run_id) {
      await updateProcessingRun(result.run_id, {
        status: "failed",
        error_message: result.error,
      }).catch(() => {});
    }

    return result;
  }
}
