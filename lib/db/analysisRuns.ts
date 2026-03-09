/**
 * Repository: deal_analysis_runs
 * Immutable run records — never overwritten.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  DealAnalysisRun,
  AnalysisRunType,
  AnalysisRunStatus,
  AnalysisRunTrigger,
} from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalize(row: Record<string, unknown>): DealAnalysisRun {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    run_type: row.run_type as AnalysisRunType,
    triggered_by: (row.triggered_by as AnalysisRunTrigger) ?? "system",
    status: (row.status as AnalysisRunStatus) ?? "pending",
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string) ?? null,
    model_name: (row.model_name as string) ?? null,
    input_tokens: (row.input_tokens as number) ?? null,
    output_tokens: (row.output_tokens as number) ?? null,
    cost_estimate: (row.cost_estimate as number) ?? null,
    notes: (row.notes as string) ?? null,
    error_message: (row.error_message as string) ?? null,
    source_file_ids: (row.source_file_ids as string[]) ?? [],
    derivative_ids: (row.derivative_ids as string[]) ?? [],
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

// ─── create ───────────────────────────────────────────────────────────────────

export type CreateAnalysisRunInput = {
  deal_id: string;
  user_id: string;
  run_type: AnalysisRunType;
  triggered_by?: AnalysisRunTrigger;
  source_file_ids?: string[];
  derivative_ids?: string[];
  notes?: string;
};

export async function createAnalysisRun(
  input: CreateAnalysisRunInput
): Promise<DealAnalysisRun> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_analysis_runs")
    .insert({
      deal_id: input.deal_id,
      user_id: input.user_id,
      run_type: input.run_type,
      triggered_by: input.triggered_by ?? "system",
      status: "pending",
      source_file_ids: input.source_file_ids ?? [],
      derivative_ids: input.derivative_ids ?? [],
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createAnalysisRun: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

// ─── read ─────────────────────────────────────────────────────────────────────

export async function getAnalysisRun(id: string): Promise<DealAnalysisRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_analysis_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getAnalysisRun: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function getLatestAnalysisRun(
  dealId: string,
  runType?: AnalysisRunType
): Promise<DealAnalysisRun | null> {
  const supabase = await createClient();
  let query = supabase
    .from("deal_analysis_runs")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (runType) query = query.eq("run_type", runType);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`getLatestAnalysisRun: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listAnalysisRuns(
  dealId: string,
  limit = 20
): Promise<DealAnalysisRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_analysis_runs")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listAnalysisRuns: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

// ─── update ───────────────────────────────────────────────────────────────────

export type UpdateAnalysisRunInput = Partial<
  Pick<
    DealAnalysisRun,
    | "status"
    | "completed_at"
    | "model_name"
    | "input_tokens"
    | "output_tokens"
    | "cost_estimate"
    | "error_message"
    | "notes"
  >
>;

export async function updateAnalysisRun(
  id: string,
  patch: UpdateAnalysisRunInput
): Promise<DealAnalysisRun> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_analysis_runs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`updateAnalysisRun: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

/** Convenience: mark a run as completed with cost metadata. */
export async function completeAnalysisRun(
  id: string,
  opts: {
    model_name?: string;
    input_tokens?: number;
    output_tokens?: number;
    cost_estimate?: number;
    notes?: string;
  } = {}
): Promise<DealAnalysisRun> {
  return updateAnalysisRun(id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    ...opts,
  });
}

/** Convenience: mark a run as failed with an error message. */
export async function failAnalysisRun(
  id: string,
  errorMessage: string
): Promise<DealAnalysisRun> {
  return updateAnalysisRun(id, {
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
  });
}
