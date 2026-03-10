/**
 * aiMemoryService
 *
 * Manages AI memories — durable contextual observations extracted from source
 * material that don't fit neatly into structured facts.
 *
 * Examples:
 *   - "Seller seems open to partial seller financing"
 *   - "Employee retention risk mentioned by broker"
 *   - "Landlord relationship may be a key deal factor"
 *
 * Separate from:
 *   - structured facts (normalized, typed, comparable)
 *   - analysis_snapshots (AI narrative blobs)
 *
 * Architecture: Layer 3 (Facts layer), stored in ai_memories table (migration 032).
 */

import { createClient } from "@/lib/supabase/server";
import type { AiMemory, AiMemoryType, AiMemoryImportance } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpsertAiMemoryInput = {
  entity_id: string;
  memory_type: AiMemoryType;
  memory_text: string;
  importance?: AiMemoryImportance;
  confidence?: number | null;
  source_file_id?: string | null;
  source_excerpt?: string | null;
  run_id?: string | null;
};

export type AiMemoryUpsertResult = {
  inserted: number;
  updated: number;
  superseded: number;
  memories: AiMemory[];
  error?: string;
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeMemory(row: Record<string, unknown>): AiMemory {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    memory_type: row.memory_type as AiMemory["memory_type"],
    memory_text: row.memory_text as string,
    importance: (row.importance as AiMemory["importance"]) ?? "medium",
    confidence: row.confidence != null ? Number(row.confidence) : null,
    source_file_id: (row.source_file_id as string | null) ?? null,
    source_excerpt: (row.source_excerpt as string | null) ?? null,
    status: (row.status as AiMemory["status"]) ?? "active",
    superseded_by: (row.superseded_by as string | null) ?? null,
    run_id: (row.run_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Fetch all active AI memories for an entity, ordered by importance then recency. */
export async function getActiveMemories(entityId: string): Promise<AiMemory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_memories")
    .select("*")
    .eq("entity_id", entityId)
    .eq("status", "active")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[aiMemoryService] getActiveMemories failed:", error.message);
    return [];
  }
  return (data ?? []).map(normalizeMemory);
}

/** Fetch all memories (including superseded/dismissed) for an entity. */
export async function getAllMemories(entityId: string): Promise<AiMemory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_memories")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[aiMemoryService] getAllMemories failed:", error.message);
    return [];
  }
  return (data ?? []).map(normalizeMemory);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Insert a new AI memory.
 * Does not deduplicate — call supersedeSimilarMemories first if needed.
 */
export async function insertMemory(input: UpsertAiMemoryInput): Promise<AiMemory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_memories")
    .insert({
      entity_id: input.entity_id,
      memory_type: input.memory_type,
      memory_text: input.memory_text,
      importance: input.importance ?? "medium",
      confidence: input.confidence ?? null,
      source_file_id: input.source_file_id ?? null,
      source_excerpt: input.source_excerpt ?? null,
      run_id: input.run_id ?? null,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[aiMemoryService] insertMemory failed:", error.message);
    return null;
  }
  return normalizeMemory(data as Record<string, unknown>);
}

/**
 * Dismiss a memory (soft delete — keeps record for history).
 */
export async function dismissMemory(memoryId: string, reason?: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_memories")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", memoryId);

  if (error) {
    console.error("[aiMemoryService] dismissMemory failed:", error.message);
    return false;
  }
  void reason; // reserved for fact_history logging
  return true;
}

/**
 * Bulk insert memories from an AI extraction run.
 * Returns counts of inserted memories.
 */
export async function bulkInsertMemories(
  entityId: string,
  memories: Omit<UpsertAiMemoryInput, "entity_id">[],
  runId?: string | null
): Promise<AiMemoryUpsertResult> {
  const result: AiMemoryUpsertResult = {
    inserted: 0,
    updated: 0,
    superseded: 0,
    memories: [],
  };

  if (!memories.length) return result;

  const supabase = await createClient();
  const rows = memories.map((m) => ({
    entity_id: entityId,
    memory_type: m.memory_type,
    memory_text: m.memory_text,
    importance: m.importance ?? "medium",
    confidence: m.confidence ?? null,
    source_file_id: m.source_file_id ?? null,
    source_excerpt: m.source_excerpt ?? null,
    run_id: runId ?? null,
    status: "active",
  }));

  const { data, error } = await supabase
    .from("ai_memories")
    .insert(rows)
    .select();

  if (error) {
    console.error("[aiMemoryService] bulkInsertMemories failed:", error.message);
    result.error = error.message;
    return result;
  }

  result.inserted = (data ?? []).length;
  result.memories = (data ?? []).map(normalizeMemory);
  return result;
}
