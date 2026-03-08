// Server-side only — never import from client components
import { createClient } from "@/lib/supabase/server";
import type { DealInsight, AIDealVerdict, DealRiskFlag, DealValuationContext } from "@/types";

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return the most recent deal_insights row for a deal.
 * Returns null if no analysis has been run yet (Phase 1/2 state).
 */
export async function getLatestInsight(
  dealId: string,
  userId: string
): Promise<DealInsight | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_insights")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getLatestInsight error:", error.message);
    return null;
  }

  return normalizeInsight(data);
}

/**
 * Return all insight rows for a deal, newest first.
 * Useful for showing analysis history.
 */
export async function listInsights(
  dealId: string,
  userId: string
): Promise<DealInsight[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_insights")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listInsights error:", error.message);
    return [];
  }

  return (data ?? []).map(normalizeInsight).filter((r): r is DealInsight => r !== null);
}

// ─── Insert (Phase 3 will use this) ──────────────────────────────────────────

export type CreateInsightInput = {
  dealId: string;
  userId: string;
  runId: string;
  aiDealScore?: number | null;
  aiVerdict?: AIDealVerdict | null;
  verdictReasoning?: string | null;
  riskFlags?: DealRiskFlag[];
  missingInformation?: string[];
  brokerQuestions?: string[];
  runningSummary?: string | null;
  valuationContext?: DealValuationContext | null;
  sourceDerivativeIds?: string[];
};

/**
 * Insert a new deal_insights row.
 * Called at the end of a Phase 3 deal-level analysis run.
 */
export async function createInsight(
  input: CreateInsightInput
): Promise<DealInsight> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_insights")
    .insert({
      deal_id: input.dealId,
      user_id: input.userId,
      run_id: input.runId,
      ai_deal_score: input.aiDealScore ?? null,
      ai_verdict: input.aiVerdict ?? null,
      verdict_reasoning: input.verdictReasoning ?? null,
      risk_flags: input.riskFlags ?? [],
      missing_information: input.missingInformation ?? [],
      broker_questions: input.brokerQuestions ?? [],
      running_summary: input.runningSummary ?? null,
      valuation_context: input.valuationContext ?? null,
      source_derivative_ids: input.sourceDerivativeIds ?? [],
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createInsight failed: ${error?.message ?? "no data"}`);
  }

  return normalizeInsight(data)!;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Coerce a raw Supabase row into a typed DealInsight.
 * Handles JSONB fields that arrive as plain JS objects.
 */
function normalizeInsight(row: Record<string, unknown> | null): DealInsight | null {
  if (!row) return null;

  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    run_id: row.run_id as string,
    ai_deal_score: typeof row.ai_deal_score === "number" ? row.ai_deal_score : null,
    ai_verdict: (row.ai_verdict as AIDealVerdict) ?? null,
    verdict_reasoning: (row.verdict_reasoning as string) ?? null,
    risk_flags: Array.isArray(row.risk_flags) ? (row.risk_flags as DealRiskFlag[]) : [],
    missing_information: Array.isArray(row.missing_information)
      ? (row.missing_information as string[])
      : [],
    broker_questions: Array.isArray(row.broker_questions)
      ? (row.broker_questions as string[])
      : [],
    running_summary: (row.running_summary as string) ?? null,
    valuation_context: row.valuation_context
      ? (row.valuation_context as DealValuationContext)
      : null,
    source_derivative_ids: Array.isArray(row.source_derivative_ids)
      ? (row.source_derivative_ids as string[])
      : [],
    created_at: row.created_at as string,
  };
}
