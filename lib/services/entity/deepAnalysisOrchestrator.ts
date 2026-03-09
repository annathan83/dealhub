/**
 * deepAnalysisOrchestrator
 *
 * Single entry point for the user-triggered Deep Analysis flow.
 * Called by POST /api/deals/[id]/deep-analysis.
 *
 * Pipeline:
 *   1. Resolve entity from deal ID
 *   2. Guard against concurrent runs (deep_scan_status = "running")
 *   3. Transition deal status: triaged → investigating (if applicable)
 *   4. Log deep_analysis_started event
 *   5. Run deep fact scan (reuses stored file texts, no re-upload)
 *   6. Build analysis context (facts + text corpus)
 *   7. Run deep AI analysis
 *   8. Mark entity deep_analysis_run_at = now(), deep_analysis_stale = false
 *   9. Log deep_analysis_completed event
 *
 * Never auto-runs. Always user-triggered.
 * Non-fatal at each step — partial results are still persisted.
 */

import { createClient } from "@/lib/supabase/server";
import { getEntityByLegacyDealId } from "@/lib/db/entities";
import { runDeepScan } from "../facts/deepScanService";
import { buildAnalysisContext } from "./analysisContextBuilder";
import { runDeepAnalysis } from "./deepAnalysisService";
import { logEntityEvent } from "./entityEventService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeepAnalysisOrchestratorResult = {
  success: boolean;
  snapshot_id: string | null;
  facts_updated: number;
  deal_status_changed: boolean;
  error?: string;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full deep analysis pipeline for a deal.
 * Resolves entity from legacy deal ID, then orchestrates all steps.
 *
 * Status transitions:
 *   - triaged → investigating  (only when status is exactly "triaged")
 *   - investigating → investigating  (re-run, no status change)
 *   - other allowed statuses → no status change
 */
export async function runDeepAnalysisForDeal(
  dealId: string,
  userId: string,
  trigger: string = "manual_run"
): Promise<DeepAnalysisOrchestratorResult> {
  const result: DeepAnalysisOrchestratorResult = {
    success: false,
    snapshot_id: null,
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
    // If a deep scan is already running (e.g. from a previous request that
    // hasn't completed), return a clear error instead of stacking runs.
    if (entity.deep_scan_status === "running") {
      result.error = "A deep analysis is already running for this deal. Please wait for it to complete.";
      return result;
    }

    // ── 3. Transition deal status triaged → investigating ────────────────────
    // Only transitions from exactly "triaged" — never downgrades other statuses.
    const { data: deal } = await supabase
      .from("deals")
      .select("status")
      .eq("id", dealId)
      .eq("user_id", userId)
      .single();

    if (deal?.status === "triaged") {
      const { error: updateError } = await supabase
        .from("deals")
        .update({ status: "investigating" })
        .eq("id", dealId)
        .eq("user_id", userId);

      if (!updateError) {
        result.deal_status_changed = true;
      } else {
        console.warn("[deepAnalysisOrchestrator] Failed to update deal status (non-fatal):", updateError.message);
      }
    }

    // ── 4. Log start event ───────────────────────────────────────────────────
    await logEntityEvent(entity.id, "deep_analysis_started", { trigger });

    // ── 5. Deep fact scan (reuses stored text — no re-upload) ────────────────
    const scanResult = await runDeepScan(entity.id, entity.entity_type_id, entity.title);
    result.facts_updated = scanResult.facts_inserted + scanResult.facts_updated;

    if (scanResult.error) {
      console.warn("[deepAnalysisOrchestrator] Deep scan had errors (continuing):", scanResult.error);
    }

    // ── 6. Build analysis context ────────────────────────────────────────────
    const context = await buildAnalysisContext(entity.id, entity.entity_type_id, entity.title);

    // ── 7. Run deep AI analysis ──────────────────────────────────────────────
    const snapshot = await runDeepAnalysis(entity.id, entity.title, context, trigger);
    result.snapshot_id = snapshot?.id ?? null;

    // ── 8. Mark entity as analyzed, clear stale flag ─────────────────────────
    // Always update even if snapshot is null — the scan itself updated facts.
    await supabase
      .from("entities")
      .update({
        deep_analysis_run_at: new Date().toISOString(),
        deep_analysis_stale: false,
      })
      .eq("id", entity.id);

    // ── 9. Log completion event ──────────────────────────────────────────────
    await logEntityEvent(entity.id, "deep_analysis_completed", {
      trigger,
      snapshot_id: snapshot?.id ?? null,
      facts_updated: result.facts_updated,
      source_count: context.source_count,
      total_text_chars: context.total_text_chars,
      had_scan_error: !!scanResult.error,
    });

    // Consider success even if the AI snapshot failed but facts were updated —
    // the UI can show a partial state and let the user re-run.
    result.success = true;
    return result;
  } catch (err) {
    console.error("[deepAnalysisOrchestrator] runDeepAnalysisForDeal failed:", err);
    result.error = err instanceof Error ? err.message : "Unknown error";
    return result;
  }
}
