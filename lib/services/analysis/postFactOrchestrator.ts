/**
 * postFactOrchestrator
 *
 * Single entry point called after ANY fact change (extraction, manual edit,
 * conflict resolution). Runs the full downstream pipeline:
 *
 *   1. Deterministic KPI scoring  (no AI, fast)
 *   2. SWOT analysis              (AI, facts-only)
 *   3. Missing info detection     (deterministic, no AI)
 *
 * All steps are fire-and-forget (non-fatal). The caller does not need to
 * await this — it runs in the background after the fact is saved.
 *
 * Never re-reads raw files or transcripts. Only reads entity_fact_values.
 */

import { scoreAndPersistKpis, type ScoreTriggerType } from "@/lib/kpi/kpiScoringService";
import { generateSwotFromFacts } from "./swotAnalysisService";
import { detectMissingInfo } from "./missingInfoService";

export type PostFactTrigger = {
  entityId: string;
  entityTypeId: string;
  entityTitle: string;
  industry: string | null;
  triggerType: ScoreTriggerType;
  triggerReason?: string | null;
  changedFactKey?: string | null;
};

/**
 * Run the full post-fact pipeline asynchronously.
 * Safe to call without awaiting — all errors are caught internally.
 */
export async function runPostFactPipeline(trigger: PostFactTrigger): Promise<void> {
  const { entityId, entityTypeId, entityTitle, industry } = trigger;

  // Step 1: Deterministic KPI scoring (fast, no AI)
  scoreAndPersistKpis(entityId, entityTypeId, {
    triggerType: trigger.triggerType,
    triggerReason: trigger.triggerReason ?? null,
    changedFactKey: trigger.changedFactKey ?? null,
  }).catch((err) => {
    console.error("[postFactOrchestrator] KPI scoring failed (non-fatal):", err);
  });

  // Step 2: SWOT analysis from facts (AI, runs after a short delay to let scoring settle)
  generateSwotFromFacts(entityId, entityTypeId, entityTitle).catch((err) => {
    console.error("[postFactOrchestrator] SWOT generation failed (non-fatal):", err);
  });

  // Step 3: Missing info detection (deterministic, fast)
  detectMissingInfo(entityId, entityTypeId, industry).catch((err) => {
    console.error("[postFactOrchestrator] Missing info detection failed (non-fatal):", err);
  });
}
