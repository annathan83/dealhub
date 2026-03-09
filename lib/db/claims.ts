/**
 * Repository: deal_source_claims
 * Atomic, evidence-linked extracted facts.
 */

import { createClient } from "@/lib/supabase/server";
import type { DealSourceClaim } from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalize(row: Record<string, unknown>): DealSourceClaim {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    analysis_run_id: (row.analysis_run_id as string) ?? null,
    source_file_id: (row.source_file_id as string) ?? null,
    source_derivative_id: (row.source_derivative_id as string) ?? null,
    source_deal_source_id: (row.source_deal_source_id as string) ?? null,
    field_name: row.field_name as string,
    raw_value: (row.raw_value as string) ?? null,
    numeric_value: (row.numeric_value as number) ?? null,
    text_value: (row.text_value as string) ?? null,
    unit: (row.unit as string) ?? null,
    confidence: (row.confidence as number) ?? null,
    extraction_model: (row.extraction_model as string) ?? null,
    extraction_run_id: (row.extraction_run_id as string) ?? null,
    superseded_by: (row.superseded_by as string) ?? null,
    is_active: (row.is_active as boolean) ?? true,
    extracted_at: row.extracted_at as string,
    created_at: row.created_at as string,
  };
}

// ─── create ───────────────────────────────────────────────────────────────────

export type CreateClaimInput = {
  deal_id: string;
  user_id: string;
  field_name: string;
  raw_value?: string | null;
  numeric_value?: number | null;
  text_value?: string | null;
  unit?: string | null;
  confidence?: number | null;
  extraction_model?: string | null;
  extraction_run_id?: string | null;
  analysis_run_id?: string | null;
  source_file_id?: string | null;
  source_derivative_id?: string | null;
  source_deal_source_id?: string | null;
};

export async function createClaim(input: CreateClaimInput): Promise<DealSourceClaim> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_source_claims")
    .insert({
      deal_id: input.deal_id,
      user_id: input.user_id,
      field_name: input.field_name,
      raw_value: input.raw_value ?? null,
      numeric_value: input.numeric_value ?? null,
      text_value: input.text_value ?? null,
      unit: input.unit ?? null,
      confidence: input.confidence ?? null,
      extraction_model: input.extraction_model ?? null,
      extraction_run_id: input.extraction_run_id ?? null,
      analysis_run_id: input.analysis_run_id ?? null,
      source_file_id: input.source_file_id ?? null,
      source_derivative_id: input.source_derivative_id ?? null,
      source_deal_source_id: input.source_deal_source_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createClaim: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

/** Bulk-insert multiple claims from a single extraction run. */
export async function createClaims(
  inputs: CreateClaimInput[]
): Promise<DealSourceClaim[]> {
  if (inputs.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_source_claims")
    .insert(
      inputs.map((input) => ({
        deal_id: input.deal_id,
        user_id: input.user_id,
        field_name: input.field_name,
        raw_value: input.raw_value ?? null,
        numeric_value: input.numeric_value ?? null,
        text_value: input.text_value ?? null,
        unit: input.unit ?? null,
        confidence: input.confidence ?? null,
        extraction_model: input.extraction_model ?? null,
        extraction_run_id: input.extraction_run_id ?? null,
        analysis_run_id: input.analysis_run_id ?? null,
        source_file_id: input.source_file_id ?? null,
        source_derivative_id: input.source_derivative_id ?? null,
        source_deal_source_id: input.source_deal_source_id ?? null,
      }))
    )
    .select();

  if (error) throw new Error(`createClaims: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

// ─── read ─────────────────────────────────────────────────────────────────────

/** Returns only active (non-superseded) claims for a deal. */
export async function listActiveClaimsForDeal(
  dealId: string
): Promise<DealSourceClaim[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_source_claims")
    .select("*")
    .eq("deal_id", dealId)
    .eq("is_active", true)
    .order("extracted_at", { ascending: false });

  if (error) throw new Error(`listActiveClaimsForDeal: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/** Returns all active claims for a specific field (e.g. 'asking_price'). */
export async function getActiveClaimsForField(
  dealId: string,
  fieldName: string
): Promise<DealSourceClaim[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_source_claims")
    .select("*")
    .eq("deal_id", dealId)
    .eq("field_name", fieldName)
    .eq("is_active", true)
    .order("confidence", { ascending: false });

  if (error) throw new Error(`getActiveClaimsForField: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

// ─── supersede ────────────────────────────────────────────────────────────────

/**
 * Marks older claims for the same field as superseded by a newer claim.
 * Call after inserting a new claim to keep only the latest active.
 */
export async function supersedePreviousClaims(
  dealId: string,
  fieldName: string,
  newClaimId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deal_source_claims")
    .update({ is_active: false, superseded_by: newClaimId })
    .eq("deal_id", dealId)
    .eq("field_name", fieldName)
    .eq("is_active", true)
    .neq("id", newClaimId);

  if (error) throw new Error(`supersedePreviousClaims: ${error.message}`);
}
