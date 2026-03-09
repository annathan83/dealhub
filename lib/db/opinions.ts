/**
 * Repository: deal_opinions
 * Immutable AI-generated deal-level verdicts.
 * Supersedes deal_insights for new analysis runs.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  DealOpinion,
  AIDealVerdict,
  DealRiskFlag,
  DealValuationContext,
} from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalize(row: Record<string, unknown>): DealOpinion {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    analysis_run_id: row.analysis_run_id as string,
    metric_snapshot_id: (row.metric_snapshot_id as string) ?? null,
    ai_deal_score: (row.ai_deal_score as number) ?? null,
    ai_verdict: (row.ai_verdict as AIDealVerdict) ?? null,
    risk_flags: (row.risk_flags as DealRiskFlag[]) ?? [],
    missing_information: (row.missing_information as string[]) ?? [],
    broker_questions: (row.broker_questions as string[]) ?? [],
    running_summary: (row.running_summary as string) ?? null,
    valuation_context: (row.valuation_context as DealValuationContext) ?? null,
    model_name: (row.model_name as string) ?? null,
    input_tokens: (row.input_tokens as number) ?? null,
    output_tokens: (row.output_tokens as number) ?? null,
    derivative_ids_used: (row.derivative_ids_used as string[]) ?? [],
    created_at: row.created_at as string,
  };
}

// ─── create ───────────────────────────────────────────────────────────────────

export type CreateOpinionInput = {
  deal_id: string;
  user_id: string;
  analysis_run_id: string;
  metric_snapshot_id?: string | null;
  ai_deal_score?: number | null;
  ai_verdict?: AIDealVerdict | null;
  risk_flags?: DealRiskFlag[];
  missing_information?: string[];
  broker_questions?: string[];
  running_summary?: string | null;
  valuation_context?: DealValuationContext | null;
  model_name?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  derivative_ids_used?: string[];
};

export async function createOpinion(input: CreateOpinionInput): Promise<DealOpinion> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinions")
    .insert({
      deal_id: input.deal_id,
      user_id: input.user_id,
      analysis_run_id: input.analysis_run_id,
      metric_snapshot_id: input.metric_snapshot_id ?? null,
      ai_deal_score: input.ai_deal_score ?? null,
      ai_verdict: input.ai_verdict ?? null,
      risk_flags: input.risk_flags ?? [],
      missing_information: input.missing_information ?? [],
      broker_questions: input.broker_questions ?? [],
      running_summary: input.running_summary ?? null,
      valuation_context: input.valuation_context ?? null,
      model_name: input.model_name ?? null,
      input_tokens: input.input_tokens ?? null,
      output_tokens: input.output_tokens ?? null,
      derivative_ids_used: input.derivative_ids_used ?? [],
    })
    .select()
    .single();

  if (error) throw new Error(`createOpinion: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

// ─── read ─────────────────────────────────────────────────────────────────────

export async function getOpinion(id: string): Promise<DealOpinion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getOpinion: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function getLatestOpinion(dealId: string): Promise<DealOpinion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinions")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getLatestOpinion: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listOpinions(
  dealId: string,
  limit = 10
): Promise<DealOpinion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinions")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listOpinions: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}
