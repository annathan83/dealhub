/**
 * factHistoryService
 *
 * Writes structured diff records to the fact_history table (migration 033).
 * Covers both AI-driven fact changes and user overrides for structured_facts
 * and ai_memories.
 *
 * Complements:
 *   - entity_events (timeline/UI log — "what happened")
 *   - fact_edit_log (manual user edits only)
 *
 * fact_history is the source of truth for change-awareness in incremental
 * revaluation ("what changed since last run, why it matters").
 */

import { createClient } from "@/lib/supabase/server";
import type { FactHistoryEntry, FactHistoryAction, FactHistoryRecordType } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WriteFactHistoryInput = {
  entity_id: string;
  record_type: FactHistoryRecordType;
  record_id: string;
  action: FactHistoryAction;
  old_value_json?: Record<string, unknown> | null;
  new_value_json?: Record<string, unknown> | null;
  reason?: string | null;
  source_file_id?: string | null;
  run_id?: string | null;
  created_by?: string;
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeEntry(row: Record<string, unknown>): FactHistoryEntry {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    record_type: row.record_type as FactHistoryRecordType,
    record_id: row.record_id as string,
    action: row.action as FactHistoryAction,
    old_value_json: (row.old_value_json as Record<string, unknown> | null) ?? null,
    new_value_json: (row.new_value_json as Record<string, unknown> | null) ?? null,
    reason: (row.reason as string | null) ?? null,
    source_file_id: (row.source_file_id as string | null) ?? null,
    run_id: (row.run_id as string | null) ?? null,
    created_at: row.created_at as string,
    created_by: (row.created_by as string) ?? "system",
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Write a single fact history entry.
 * Non-throwing — logs errors but does not propagate them to avoid
 * breaking the main write path.
 */
export async function writeFactHistory(input: WriteFactHistoryInput): Promise<FactHistoryEntry | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("fact_history")
      .insert({
        entity_id: input.entity_id,
        record_type: input.record_type,
        record_id: input.record_id,
        action: input.action,
        old_value_json: input.old_value_json ?? null,
        new_value_json: input.new_value_json ?? null,
        reason: input.reason ?? null,
        source_file_id: input.source_file_id ?? null,
        run_id: input.run_id ?? null,
        created_by: input.created_by ?? "system",
      })
      .select()
      .single();

    if (error) {
      console.error("[factHistoryService] writeFactHistory failed:", error.message);
      return null;
    }
    return normalizeEntry(data as Record<string, unknown>);
  } catch (err) {
    console.error("[factHistoryService] writeFactHistory threw:", err);
    return null;
  }
}

/**
 * Bulk write fact history entries (e.g. after a reconciliation pass).
 * Non-throwing.
 */
export async function bulkWriteFactHistory(inputs: WriteFactHistoryInput[]): Promise<number> {
  if (!inputs.length) return 0;
  try {
    const supabase = await createClient();
    const rows = inputs.map((input) => ({
      entity_id: input.entity_id,
      record_type: input.record_type,
      record_id: input.record_id,
      action: input.action,
      old_value_json: input.old_value_json ?? null,
      new_value_json: input.new_value_json ?? null,
      reason: input.reason ?? null,
      source_file_id: input.source_file_id ?? null,
      run_id: input.run_id ?? null,
      created_by: input.created_by ?? "system",
    }));

    const { data, error } = await supabase
      .from("fact_history")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("[factHistoryService] bulkWriteFactHistory failed:", error.message);
      return 0;
    }
    return (data ?? []).length;
  } catch (err) {
    console.error("[factHistoryService] bulkWriteFactHistory threw:", err);
    return 0;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch recent fact history for an entity.
 * Used by incremental revaluation to understand "what changed since last run".
 */
export async function getRecentFactHistory(
  entityId: string,
  sinceIso?: string,
  limit = 50
): Promise<FactHistoryEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("fact_history")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sinceIso) {
    query = query.gte("created_at", sinceIso);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[factHistoryService] getRecentFactHistory failed:", error.message);
    return [];
  }
  return (data ?? []).map(normalizeEntry);
}

/**
 * Fetch history for a specific fact or memory record.
 */
export async function getRecordHistory(recordId: string): Promise<FactHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fact_history")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[factHistoryService] getRecordHistory failed:", error.message);
    return [];
  }
  return (data ?? []).map(normalizeEntry);
}
