/**
 * DealAnalysisRunService
 *
 * Orchestrates a full deal-level analysis run:
 *  1. Create a deal_analysis_runs record (status = 'pending')
 *  2. Process any pending derivatives (DerivativeProcessingService)
 *  3. Aggregate extracted data into a DealOpinion (AI call — stubbed for now)
 *  4. Create a DealMetricSnapshot from the opinion
 *  5. Generate a DealOpinionDelta vs the previous opinion
 *  6. Update deals.last_analysis_run_id and deals.current_opinion_id
 *  7. Mark the run as completed
 *
 * Phase 3 status: Steps 1, 2, 4–7 are implemented.
 *                 Step 3 (AI aggregation) is stubbed — returns null opinion fields.
 *                 Phase 4 will replace the stub with a real GPT-4o-mini call.
 */

import {
  createAnalysisRun,
  completeAnalysisRun,
  failAnalysisRun,
  type CreateAnalysisRunInput,
} from "@/lib/db/analysisRuns";
import { getLatestOpinion, createOpinion } from "@/lib/db/opinions";
import { createMetricSnapshot } from "@/lib/db/metricSnapshots";
import { listDerivativesForDeal } from "@/lib/db/derivatives";
import { createClient } from "@/lib/supabase/server";
import { processPendingDerivatives } from "./DerivativeProcessingService";
import { generateOpinionDelta } from "./DealOpinionDeltaService";
import type {
  DealAnalysisRun,
  DealOpinion,
  AIDealVerdict,
  DealRiskFlag,
  DealValuationContext,
} from "@/types";

// ─── AI aggregation stub ──────────────────────────────────────────────────────

type AggregationOutput = {
  ai_deal_score: number | null;
  ai_verdict: AIDealVerdict | null;
  risk_flags: DealRiskFlag[];
  missing_information: string[];
  broker_questions: string[];
  running_summary: string | null;
  valuation_context: DealValuationContext | null;
  model_name: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

/**
 * Stub aggregator — returns empty opinion fields.
 * Phase 4 will replace this with a real GPT-4o-mini prompt that:
 *  - Reads all 'done' derivatives' extracted_text and structured_fields
 *  - Builds a compact context (< 4k tokens)
 *  - Returns a structured JSON verdict
 */
async function aggregateDealIntelligence(
  _dealId: string,
  _derivativeIds: string[]
): Promise<AggregationOutput> {
  // TODO Phase 4: implement real AI aggregation
  return {
    ai_deal_score: null,
    ai_verdict: null,
    risk_flags: [],
    missing_information: [],
    broker_questions: [],
    running_summary: null,
    valuation_context: null,
    model_name: null,
    input_tokens: null,
    output_tokens: null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type RunAnalysisInput = {
  dealId: string;
  userId: string;
  triggeredBy?: CreateAnalysisRunInput["triggered_by"];
  triggeringFileIds?: string[];
};

export type RunAnalysisResult = {
  run: DealAnalysisRun;
  opinion: DealOpinion;
};

/**
 * Execute a full deal-level analysis run.
 * Safe to call from any API route — idempotent for the same set of derivatives.
 */
export async function runDealAnalysis(
  input: RunAnalysisInput
): Promise<RunAnalysisResult> {
  const { dealId, userId } = input;

  // 1. Create the analysis run record
  const run = await createAnalysisRun({
    deal_id: dealId,
    user_id: userId,
    run_type: "deal_aggregation",
    triggered_by: input.triggeredBy ?? "manual",
    source_file_ids: input.triggeringFileIds ?? [],
  });

  try {
    // 2. Process any pending derivatives first
    await processPendingDerivatives(dealId, userId);

    // 3. Collect all done derivatives for this deal
    const allDerivatives = await listDerivativesForDeal(dealId, userId);
    const doneDerivatives = allDerivatives.filter(
      (d) => d.extraction_status === "done"
    );
    const derivativeIds = doneDerivatives.map((d) => d.id);

    // 4. Run AI aggregation (stub for now)
    const aggregation = await aggregateDealIntelligence(dealId, derivativeIds);

    // 5. Create metric snapshot from aggregation output
    const snapshot = await createMetricSnapshot({
      deal_id: dealId,
      user_id: userId,
      analysis_run_id: run.id,
      // Multiples extracted from valuation_context if present
      implied_multiple: aggregation.valuation_context?.implied_multiple
        ? parseFloat(aggregation.valuation_context.implied_multiple) || null
        : null,
      revenue_multiple: aggregation.valuation_context?.revenue_multiple
        ? parseFloat(aggregation.valuation_context.revenue_multiple) || null
        : null,
      sde_multiple: aggregation.valuation_context?.sde_multiple
        ? parseFloat(aggregation.valuation_context.sde_multiple) || null
        : null,
    });

    // 6. Create the immutable opinion record
    const opinion = await createOpinion({
      deal_id: dealId,
      user_id: userId,
      analysis_run_id: run.id,
      metric_snapshot_id: snapshot.id,
      ai_deal_score: aggregation.ai_deal_score,
      ai_verdict: aggregation.ai_verdict,
      risk_flags: aggregation.risk_flags,
      missing_information: aggregation.missing_information,
      broker_questions: aggregation.broker_questions,
      running_summary: aggregation.running_summary,
      valuation_context: aggregation.valuation_context,
      model_name: aggregation.model_name,
      input_tokens: aggregation.input_tokens,
      output_tokens: aggregation.output_tokens,
      derivative_ids_used: derivativeIds,
    });

    // 7. Generate delta vs previous opinion
    const previousOpinion = await getLatestOpinion(dealId).then((prev) =>
      prev?.id === opinion.id ? null : prev
    );

    await generateOpinionDelta(
      previousOpinion,
      opinion,
      input.triggeringFileIds ?? []
    ).catch((err) => {
      // Delta generation is non-fatal
      console.warn("[DealAnalysisRunService] delta generation failed:", err);
    });

    // 8. Update deals table pointers
    const supabase = await createClient();
    await supabase
      .from("deals")
      .update({
        last_analysis_run_id: run.id,
        current_opinion_id: opinion.id,
      })
      .eq("id", dealId)
      .eq("user_id", userId);

    // 9. Mark run as completed
    const completedRun = await completeAnalysisRun(run.id, {
      model_name: aggregation.model_name ?? undefined,
      input_tokens: aggregation.input_tokens ?? undefined,
      output_tokens: aggregation.output_tokens ?? undefined,
    });

    return { run: completedRun, opinion };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DealAnalysisRunService] run failed:", message);
    await failAnalysisRun(run.id, message).catch(() => {});
    throw err;
  }
}
