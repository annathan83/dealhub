/**
 * Repository: deal_opinion_deltas
 * Diffs between consecutive deal opinions.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  DealOpinionDelta,
  AIDealVerdict,
  DealRiskFlag,
  MetricChange,
} from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalize(row: Record<string, unknown>): DealOpinionDelta {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    from_opinion_id: (row.from_opinion_id as string) ?? null,
    to_opinion_id: row.to_opinion_id as string,
    score_before: (row.score_before as number) ?? null,
    score_after: (row.score_after as number) ?? null,
    score_change: (row.score_change as number) ?? null,
    verdict_before: (row.verdict_before as AIDealVerdict) ?? null,
    verdict_after: (row.verdict_after as AIDealVerdict) ?? null,
    verdict_changed: (row.verdict_changed as boolean) ?? false,
    changed_metrics: (row.changed_metrics as Record<string, MetricChange>) ?? {},
    added_risks: (row.added_risks as DealRiskFlag[]) ?? [],
    removed_risks: (row.removed_risks as DealRiskFlag[]) ?? [],
    resolved_missing: (row.resolved_missing as string[]) ?? [],
    new_missing: (row.new_missing as string[]) ?? [],
    triggering_file_ids: (row.triggering_file_ids as string[]) ?? [],
    created_at: row.created_at as string,
  };
}

// ─── create ───────────────────────────────────────────────────────────────────

export type CreateOpinionDeltaInput = {
  deal_id: string;
  user_id: string;
  from_opinion_id: string | null;
  to_opinion_id: string;
  score_before?: number | null;
  score_after?: number | null;
  score_change?: number | null;
  verdict_before?: AIDealVerdict | null;
  verdict_after?: AIDealVerdict | null;
  verdict_changed?: boolean;
  changed_metrics?: Record<string, MetricChange>;
  added_risks?: DealRiskFlag[];
  removed_risks?: DealRiskFlag[];
  resolved_missing?: string[];
  new_missing?: string[];
  triggering_file_ids?: string[];
};

export async function createOpinionDelta(
  input: CreateOpinionDeltaInput
): Promise<DealOpinionDelta> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinion_deltas")
    .insert({
      deal_id: input.deal_id,
      user_id: input.user_id,
      from_opinion_id: input.from_opinion_id ?? null,
      to_opinion_id: input.to_opinion_id,
      score_before: input.score_before ?? null,
      score_after: input.score_after ?? null,
      score_change: input.score_change ?? null,
      verdict_before: input.verdict_before ?? null,
      verdict_after: input.verdict_after ?? null,
      verdict_changed: input.verdict_changed ?? false,
      changed_metrics: input.changed_metrics ?? {},
      added_risks: input.added_risks ?? [],
      removed_risks: input.removed_risks ?? [],
      resolved_missing: input.resolved_missing ?? [],
      new_missing: input.new_missing ?? [],
      triggering_file_ids: input.triggering_file_ids ?? [],
    })
    .select()
    .single();

  if (error) throw new Error(`createOpinionDelta: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

// ─── read ─────────────────────────────────────────────────────────────────────

export async function getLatestDelta(dealId: string): Promise<DealOpinionDelta | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinion_deltas")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getLatestDelta: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listDeltas(
  dealId: string,
  limit = 10
): Promise<DealOpinionDelta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinion_deltas")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listDeltas: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function getDeltaByToOpinion(
  toOpinionId: string
): Promise<DealOpinionDelta | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_opinion_deltas")
    .select("*")
    .eq("to_opinion_id", toOpinionId)
    .maybeSingle();

  if (error) throw new Error(`getDeltaByToOpinion: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}
