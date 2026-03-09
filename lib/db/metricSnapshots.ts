/**
 * Repository: deal_metric_snapshots
 * Point-in-time financial/operational snapshot per analysis run.
 */

import { createClient } from "@/lib/supabase/server";
import type { DealMetricSnapshot } from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalize(row: Record<string, unknown>): DealMetricSnapshot {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    analysis_run_id: row.analysis_run_id as string,
    asking_price: (row.asking_price as number) ?? null,
    revenue: (row.revenue as number) ?? null,
    sde: (row.sde as number) ?? null,
    ebitda: (row.ebitda as number) ?? null,
    gross_profit: (row.gross_profit as number) ?? null,
    net_income: (row.net_income as number) ?? null,
    total_assets: (row.total_assets as number) ?? null,
    total_liabilities: (row.total_liabilities as number) ?? null,
    implied_multiple: (row.implied_multiple as number) ?? null,
    revenue_multiple: (row.revenue_multiple as number) ?? null,
    sde_multiple: (row.sde_multiple as number) ?? null,
    employee_count: (row.employee_count as number) ?? null,
    year_established: (row.year_established as number) ?? null,
    years_in_business: (row.years_in_business as number) ?? null,
    currency: (row.currency as string) ?? "USD",
    snapshot_notes: (row.snapshot_notes as string) ?? null,
    source_claim_ids: (row.source_claim_ids as string[]) ?? [],
    created_at: row.created_at as string,
  };
}

// ─── create ───────────────────────────────────────────────────────────────────

export type CreateMetricSnapshotInput = {
  deal_id: string;
  user_id: string;
  analysis_run_id: string;
  asking_price?: number | null;
  revenue?: number | null;
  sde?: number | null;
  ebitda?: number | null;
  gross_profit?: number | null;
  net_income?: number | null;
  total_assets?: number | null;
  total_liabilities?: number | null;
  implied_multiple?: number | null;
  revenue_multiple?: number | null;
  sde_multiple?: number | null;
  employee_count?: number | null;
  year_established?: number | null;
  years_in_business?: number | null;
  currency?: string;
  snapshot_notes?: string | null;
  source_claim_ids?: string[];
};

export async function createMetricSnapshot(
  input: CreateMetricSnapshotInput
): Promise<DealMetricSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_metric_snapshots")
    .insert({
      deal_id: input.deal_id,
      user_id: input.user_id,
      analysis_run_id: input.analysis_run_id,
      asking_price: input.asking_price ?? null,
      revenue: input.revenue ?? null,
      sde: input.sde ?? null,
      ebitda: input.ebitda ?? null,
      gross_profit: input.gross_profit ?? null,
      net_income: input.net_income ?? null,
      total_assets: input.total_assets ?? null,
      total_liabilities: input.total_liabilities ?? null,
      implied_multiple: input.implied_multiple ?? null,
      revenue_multiple: input.revenue_multiple ?? null,
      sde_multiple: input.sde_multiple ?? null,
      employee_count: input.employee_count ?? null,
      year_established: input.year_established ?? null,
      years_in_business: input.years_in_business ?? null,
      currency: input.currency ?? "USD",
      snapshot_notes: input.snapshot_notes ?? null,
      source_claim_ids: input.source_claim_ids ?? [],
    })
    .select()
    .single();

  if (error) throw new Error(`createMetricSnapshot: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

// ─── read ─────────────────────────────────────────────────────────────────────

export async function getMetricSnapshot(id: string): Promise<DealMetricSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_metric_snapshots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getMetricSnapshot: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function getLatestMetricSnapshot(
  dealId: string
): Promise<DealMetricSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_metric_snapshots")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getLatestMetricSnapshot: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listMetricSnapshots(
  dealId: string,
  limit = 10
): Promise<DealMetricSnapshot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_metric_snapshots")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listMetricSnapshots: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}
