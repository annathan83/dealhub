/**
 * KPI Scoring Service
 *
 * Reads entity_fact_values for an entity, maps them to KpiFactInputs,
 * runs each KPI scoring function from kpiConfig, and returns a
 * KpiScorecardResult.
 *
 * This is the Layer 3 → Layer 4 bridge:
 *   Facts (entity_fact_values) → KPI Scores → AI Analysis input
 *
 * The result is stored in analysis_snapshots with analysis_type = 'kpi_scorecard'.
 * It can also be returned directly from an API route for real-time display.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  insertAnalysisSnapshot,
  createProcessingRun,
  updateProcessingRun,
} from "@/lib/db/entities";
import { extractFactInputs } from "./factRegistry";
import { KPI_DEFINITIONS, type KpiFactInputs, type KpiScorecardResult, type KpiScore } from "./kpiConfig";
import type { EntityFactValue } from "@/types/entity";

// ─── Score history helpers ────────────────────────────────────────────────────

export type ScoreTriggerType = "fact_change" | "manual" | "file_upload" | "extraction" | "deep_scan" | "system";

/**
 * Append a row to score_history for every KPI recalculation.
 * Non-fatal — errors are logged but never thrown.
 */
async function writeScoreHistory(params: {
  entityId: string;
  scorecard: KpiScorecardResult;
  triggerType: ScoreTriggerType;
  triggerReason?: string | null;
  changedFactKey?: string | null;
  snapshotId?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const overall10 = params.scorecard.overall_score !== null
      ? Math.round(params.scorecard.overall_score * 2 * 10) / 10  // 1–5 → 1–10
      : null;

    await supabase.from("score_history").insert({
      entity_id:         params.entityId,
      overall_score:     params.scorecard.overall_score,
      overall_score_10:  overall10,
      overall_score_100: params.scorecard.overall_score_100,
      coverage_pct:      params.scorecard.coverage_pct,
      kpi_count:         params.scorecard.kpis.length,
      missing_count:     params.scorecard.missing_count,
      trigger_type:      params.triggerType,
      trigger_reason:    params.triggerReason ?? null,
      changed_fact_key:  params.changedFactKey ?? null,
      snapshot_id:       params.snapshotId ?? null,
    });
  } catch (err) {
    console.error("[kpiScoringService] writeScoreHistory failed (non-fatal):", err);
  }
}

/**
 * Fetch the last N score history entries for an entity, newest first.
 */
export async function getScoreHistory(
  entityId: string,
  limit = 20
): Promise<ScoreHistoryEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("score_history")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ScoreHistoryEntry[];
}

export type ScoreHistoryEntry = {
  id: string;
  entity_id: string;
  overall_score: number | null;
  overall_score_10: number | null;
  overall_score_100: number | null;
  coverage_pct: number | null;
  kpi_count: number | null;
  missing_count: number | null;
  trigger_type: ScoreTriggerType;
  trigger_reason: string | null;
  changed_fact_key: string | null;
  snapshot_id: string | null;
  created_at: string;
};

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Score all 12 KPIs from the entity's current fact values.
 * Pure function — no DB writes. Call persistKpiScorecard() to save.
 */
export function computeKpiScorecard(
  factValues: EntityFactValue[],
  factDefIdToKey: Map<string, string>
): KpiScorecardResult {
  // Build typed inputs from fact values
  const rawInputs = extractFactInputs(factValues, factDefIdToKey);

  // Map registry keys to KpiFactInputs shape
  const inputs: KpiFactInputs = {
    asking_price:                    rawInputs.asking_price as number | null ?? null,
    revenue_latest:                  rawInputs.revenue_latest as number | null ?? null,
    sde_latest:                      rawInputs.sde_latest as number | null ?? null,
    ebitda_latest:                   rawInputs.ebitda_latest as number | null ?? null,
    revenue_year_1:                  rawInputs.revenue_year_1 as number | null ?? null,
    revenue_year_2:                  rawInputs.revenue_year_2 as number | null ?? null,
    sde_year_1:                      rawInputs.sde_year_1 as number | null ?? null,
    customer_concentration_top1_pct: rawInputs.customer_concentration_top1_pct as number | null ?? null,
    recurring_revenue_pct:           rawInputs.recurring_revenue_pct as number | null ?? null,
    owner_hours_per_week:            rawInputs.owner_hours_per_week as number | null ?? null,
    manager_in_place:                rawInputs.manager_in_place as boolean | null ?? null,
    owner_in_sales:                  rawInputs.owner_in_sales as boolean | null ?? null,
    owner_in_operations:             rawInputs.owner_in_operations as boolean | null ?? null,
    employees_ft:                    rawInputs.employees_ft as number | null ?? null,
    employees_pt:                    rawInputs.employees_pt as number | null ?? null,
    legal_risk_flag:                 rawInputs.legal_risk_flag as boolean | null ?? null,
    compliance_risk_flag:            rawInputs.compliance_risk_flag as boolean | null ?? null,
    licensing_dependency:            rawInputs.licensing_dependency as boolean | null ?? null,
    capex_intensity:                 rawInputs.capex_intensity as string | null ?? null,
    seasonality:                     rawInputs.seasonality as string | null ?? null,
  };

  // Score each KPI
  const kpis: KpiScore[] = KPI_DEFINITIONS.map((def) => {
    const result = def.score(inputs);
    const weighted_score = result.score !== null ? result.score * def.weight : null;
    return {
      kpi_key: def.kpi_key,
      label: def.label,
      raw_value: result.raw_value,
      score: result.score,
      weight: def.weight,
      weighted_score,
      rationale: result.rationale,
      status: result.status,
    };
  });

  // Compute overall score from non-missing KPIs (re-weight to available KPIs)
  const scoredKpis = kpis.filter((k) => k.score !== null);
  const missingCount = kpis.filter((k) => k.status === "missing").length;

  let overallScore: number | null = null;
  let overallScore100: number | null = null;

  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((sum, k) => sum + k.weight, 0);
    const weightedSum = scoredKpis.reduce((sum, k) => sum + (k.weighted_score ?? 0), 0);
    // Re-normalize to account for missing KPIs
    overallScore = totalWeight > 0 ? weightedSum / totalWeight : null;
    // Scale 1–5 → 0–100
    overallScore100 = overallScore !== null ? Math.round(((overallScore - 1) / 4) * 100) : null;
  }

  const coveragePct = kpis.length > 0
    ? Math.round((scoredKpis.length / kpis.length) * 100)
    : 0;

  return {
    overall_score: overallScore !== null ? Math.round(overallScore * 10) / 10 : null,
    overall_score_100: overallScore100,
    kpis,
    missing_count: missingCount,
    coverage_pct: coveragePct,
  };
}

// ─── DB-integrated scoring ────────────────────────────────────────────────────

/**
 * Compute KPI scorecard for an entity and persist it as an analysis_snapshot.
 * Creates a processing_run record for full pipeline visibility.
 * Writes a score_history row with trigger context.
 * Returns the scorecard result (whether or not persistence succeeded).
 */
export async function scoreAndPersistKpis(
  entityId: string,
  entityTypeId: string,
  options?: {
    triggerType?: ScoreTriggerType;
    triggerReason?: string | null;
    changedFactKey?: string | null;
  }
): Promise<KpiScorecardResult> {
  const triggerType = options?.triggerType ?? "system";

  // Create processing_run before starting
  const processingRun = await createProcessingRun({
    entity_id: entityId,
    run_type: "kpi_scoring",
    triggered_by_type: "system",
    prompt_version: "v1",
  }).catch(() => null);
  const runId = processingRun?.id ?? null;

  try {
    if (runId) await updateProcessingRun(runId, { status: "running" }).catch(() => {});

    const [factValues, factDefs] = await Promise.all([
      getCurrentFactsForEntity(entityId),
      getFactDefinitionsForEntityType(entityTypeId),
    ]);

    // Build fact_definition_id → key map
    const factDefIdToKey = new Map<string, string>(
      factDefs.map((fd) => [fd.id, fd.key])
    );

    const scorecard = computeKpiScorecard(factValues, factDefIdToKey);

    // Persist as analysis_snapshot (linked to processing_run)
    const snapshot = await insertAnalysisSnapshot({
      entity_id: entityId,
      analysis_type: "kpi_scorecard",
      title: "KPI Scorecard",
      content_json: {
        overall_score: scorecard.overall_score,
        overall_score_100: scorecard.overall_score_100,
        coverage_pct: scorecard.coverage_pct,
        missing_count: scorecard.missing_count,
        kpis: scorecard.kpis,
      },
      model_name: null,
      prompt_version: "v1",
      run_id: runId,
    }).catch((err) => {
      console.error("[kpiScoringService] Failed to persist KPI scorecard:", err);
      return null;
    });

    // Write score history entry
    await writeScoreHistory({
      entityId,
      scorecard,
      triggerType,
      triggerReason: options?.triggerReason ?? null,
      changedFactKey: options?.changedFactKey ?? null,
      snapshotId: (snapshot as { id?: string } | null)?.id ?? null,
    });

    if (runId) {
      await updateProcessingRun(runId, {
        status: "completed",
        output_summary_json: {
          overall_score: scorecard.overall_score,
          overall_score_100: scorecard.overall_score_100,
          coverage_pct: scorecard.coverage_pct,
          missing_count: scorecard.missing_count,
          kpi_count: scorecard.kpis.length,
        },
      }).catch(() => {});
    }

    return scorecard;
  } catch (err) {
    console.error("[kpiScoringService] scoreAndPersistKpis failed:", err);

    if (runId) {
      await updateProcessingRun(runId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }

    // Return empty scorecard on failure
    return {
      overall_score: null,
      overall_score_100: null,
      kpis: [],
      missing_count: 0,
      coverage_pct: 0,
    };
  }
}

/**
 * Load the latest persisted KPI scorecard for an entity from analysis_snapshots.
 * Returns null if none exists yet.
 */
export async function getLatestKpiScorecard(
  entityId: string
): Promise<KpiScorecardResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_snapshots")
    .select("content_json")
    .eq("entity_id", entityId)
    .eq("analysis_type", "kpi_scorecard")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.content_json) return null;

  const c = data.content_json as Record<string, unknown>;
  return {
    overall_score: (c.overall_score as number | null) ?? null,
    overall_score_100: (c.overall_score_100 as number | null) ?? null,
    coverage_pct: (c.coverage_pct as number) ?? 0,
    missing_count: (c.missing_count as number) ?? 0,
    kpis: (c.kpis as KpiScore[]) ?? [],
  };
}
