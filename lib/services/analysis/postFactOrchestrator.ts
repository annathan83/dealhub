/**
 * postFactOrchestrator
 *
 * Single entry point called after ANY fact change (extraction, manual edit,
 * conflict resolution). Runs the full downstream pipeline:
 *
 *   1. Fact inference             (deterministic, derives facts from known facts)
 *   2. Deterministic KPI scoring  (no AI, fast)
 *   3. SWOT analysis              (AI, facts-only)
 *   4. Missing info detection     (deterministic, no AI)
 *
 * Pipeline order matters:
 *   - Inference runs FIRST so inferred facts are available for scoring
 *   - Scoring runs AFTER inference so it uses the most complete fact set
 *   - SWOT and missing info run in parallel after scoring
 *
 * All steps are fire-and-forget (non-fatal). The caller does not need to
 * await this — it runs in the background after the fact is saved.
 *
 * Never re-reads raw files or transcripts. Only reads entity_fact_values.
 */

import { scoreAndPersistKpis, type ScoreTriggerType } from "@/lib/kpi/kpiScoringService";
import { runAndApplyFactInference } from "@/lib/services/facts/factInferenceService";
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

  try {
    // Step 1: Fact inference — derive estimated facts from known facts
    // Runs synchronously first so inferred facts are available for scoring.
    // Never overwrites confirmed or document-backed facts.
    await runAndApplyFactInference(entityId, entityTypeId /* reserved for industry overlays */).catch((err) => {
      console.error("[postFactOrchestrator] Fact inference failed (non-fatal):", err);
    });

    // Step 2: Deterministic KPI scoring (fast, no AI)
    // Runs after inference so inferred facts contribute to the score.
    scoreAndPersistKpis(entityId, entityTypeId, {
      triggerType: trigger.triggerType,
      triggerReason: trigger.triggerReason ?? null,
      changedFactKey: trigger.changedFactKey ?? null,
    }).catch((err) => {
      console.error("[postFactOrchestrator] KPI scoring failed (non-fatal):", err);
    });

    // Steps 3 + 4: SWOT and missing info run in parallel (both read facts only)
    generateSwotFromFacts(entityId, entityTypeId, entityTitle).catch((err) => {
      console.error("[postFactOrchestrator] SWOT generation failed (non-fatal):", err);
    });

    detectMissingInfo(entityId, entityTypeId, industry).catch((err) => {
      console.error("[postFactOrchestrator] Missing info detection failed (non-fatal):", err);
    });

  } catch (err) {
    console.error("[postFactOrchestrator] Pipeline failed (non-fatal):", err);
  }
}
