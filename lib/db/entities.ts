/**
 * entities repository
 *
 * Read/write access to the new entity-fact-evidence tables.
 * All functions are safe to call from server components and API routes.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Entity,
  EntityType,
  EntityFile,
  FileText,
  FileChunk,
  FactDefinition,
  EntityFactValue,
  FactEvidence,
  AnalysisSnapshot,
  EntityEvent,
  EntityFileWithText,
  EntityPageData,
  FactEditLogEntry,
  FactChangeType,
} from "@/types/entity";

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeEntity(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    entity_type_id: row.entity_type_id as string,
    legacy_deal_id: (row.legacy_deal_id as string | null) ?? null,
    title: row.title as string,
    subtitle: (row.subtitle as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    owner_user_id: (row.owner_user_id as string | null) ?? null,
    workspace_id: (row.workspace_id as string | null) ?? null,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    archived_at: (row.archived_at as string | null) ?? null,
    deep_scan_status: (row.deep_scan_status as Entity["deep_scan_status"]) ?? null,
    deep_scan_started_at: (row.deep_scan_started_at as string | null) ?? null,
    deep_scan_completed_at: (row.deep_scan_completed_at as string | null) ?? null,
    deep_scan_facts_added: (row.deep_scan_facts_added as number | null) ?? null,
    deep_scan_facts_updated: (row.deep_scan_facts_updated as number | null) ?? null,
    deep_scan_conflicts_found: (row.deep_scan_conflicts_found as number | null) ?? null,
    deep_analysis_run_at: (row.deep_analysis_run_at as string | null) ?? null,
    deep_analysis_stale: (row.deep_analysis_stale as boolean) ?? false,
    latest_source_at: (row.latest_source_at as string | null) ?? null,
  };
}

function normalizeEntityFile(row: Record<string, unknown>): EntityFile {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    legacy_deal_id: (row.legacy_deal_id as string | null) ?? null,
    storage_path: row.storage_path as string,
    file_name: row.file_name as string,
    mime_type: (row.mime_type as string | null) ?? null,
    file_size_bytes: (row.file_size_bytes as number | null) ?? null,
    source_type: (row.source_type as string | null) ?? null,
    document_type: (row.document_type as string | null) ?? null,
    uploaded_by: (row.uploaded_by as string | null) ?? null,
    uploaded_at: row.uploaded_at as string,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
  };
}

function normalizeFileText(row: Record<string, unknown>): FileText {
  return {
    id: row.id as string,
    file_id: row.file_id as string,
    full_text: (row.full_text as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    extraction_method: (row.extraction_method as string | null) ?? null,
    extraction_status: (row.extraction_status as FileText["extraction_status"]) ?? "pending",
    extracted_at: (row.extracted_at as string | null) ?? null,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
  };
}

function normalizeFactDefinition(row: Record<string, unknown>): FactDefinition {
  return {
    id: row.id as string,
    key: row.key as string,
    label: row.label as string,
    description: (row.description as string | null) ?? null,
    category: (row.category as FactDefinition["category"]) ?? null,
    data_type: row.data_type as FactDefinition["data_type"],
    is_critical: (row.is_critical as boolean) ?? false,
    is_multi_value: (row.is_multi_value as boolean) ?? false,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  };
}

function normalizeEntityFactValue(row: Record<string, unknown>): EntityFactValue {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    fact_definition_id: row.fact_definition_id as string,
    value_raw: (row.value_raw as string | null) ?? null,
    value_normalized_json: (row.value_normalized_json as Record<string, unknown>) ?? {},
    status: (row.status as EntityFactValue["status"]) ?? "missing",
    confidence: (row.confidence as number | null) ?? null,
    current_evidence_id: (row.current_evidence_id as string | null) ?? null,
    manual_override: (row.manual_override as boolean) ?? false,
    override_note: (row.override_note as string | null) ?? null,
    override_by: (row.override_by as string | null) ?? null,
    override_at: (row.override_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

function normalizeFactEvidence(row: Record<string, unknown>): FactEvidence {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    fact_definition_id: row.fact_definition_id as string,
    file_id: row.file_id as string,
    file_chunk_id: (row.file_chunk_id as string | null) ?? null,
    extracted_value_raw: (row.extracted_value_raw as string | null) ?? null,
    normalized_value_json: (row.normalized_value_json as Record<string, unknown>) ?? {},
    snippet: (row.snippet as string | null) ?? null,
    page_number: (row.page_number as number | null) ?? null,
    confidence: (row.confidence as number | null) ?? null,
    extractor_version: (row.extractor_version as string | null) ?? null,
    evidence_status: (row.evidence_status as FactEvidence["evidence_status"]) ?? "raw",
    is_superseded: (row.is_superseded as boolean) ?? false,
    is_conflicting: (row.is_conflicting as boolean) ?? false,
    created_at: row.created_at as string,
  };
}

function normalizeAnalysisSnapshot(row: Record<string, unknown>): AnalysisSnapshot {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    analysis_type: row.analysis_type as AnalysisSnapshot["analysis_type"],
    title: (row.title as string | null) ?? null,
    content_json: (row.content_json as Record<string, unknown>) ?? {},
    model_name: (row.model_name as string | null) ?? null,
    prompt_version: (row.prompt_version as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function normalizeEntityEvent(row: Record<string, unknown>): EntityEvent {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    event_type: row.event_type as EntityEvent["event_type"],
    file_id: (row.file_id as string | null) ?? null,
    fact_definition_id: (row.fact_definition_id as string | null) ?? null,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  };
}

// ─── Entity queries ───────────────────────────────────────────────────────────

export async function getEntityByLegacyDealId(
  dealId: string,
  userId: string
): Promise<Entity | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entities")
    .select("*")
    .eq("legacy_deal_id", dealId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  return data ? normalizeEntity(data as Record<string, unknown>) : null;
}

export async function getEntityById(
  entityId: string,
  userId: string
): Promise<Entity | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entities")
    .select("*")
    .eq("id", entityId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  return data ? normalizeEntity(data as Record<string, unknown>) : null;
}

// ─── File queries ─────────────────────────────────────────────────────────────

export async function getFilesForEntity(entityId: string): Promise<EntityFile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_files")
    .select("*")
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: false });

  return (data ?? []).map((r) => normalizeEntityFile(r as Record<string, unknown>));
}

export async function getFilesWithTextForEntity(entityId: string): Promise<EntityFileWithText[]> {
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("entity_files")
    .select("*")
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: false });

  if (!files || files.length === 0) return [];

  const fileIds = files.map((f) => f.id as string);

  const [textResult, chunkCountResult] = await Promise.all([
    supabase.from("file_text").select("*").in("file_id", fileIds),
    supabase.from("file_chunks").select("file_id").in("file_id", fileIds),
  ]);

  const textByFileId = new Map<string, FileText>();
  for (const row of textResult.data ?? []) {
    textByFileId.set(row.file_id as string, normalizeFileText(row as Record<string, unknown>));
  }

  const chunkCountByFileId = new Map<string, number>();
  for (const row of chunkCountResult.data ?? []) {
    const id = row.file_id as string;
    chunkCountByFileId.set(id, (chunkCountByFileId.get(id) ?? 0) + 1);
  }

  return files.map((f) => ({
    ...normalizeEntityFile(f as Record<string, unknown>),
    file_text: textByFileId.get(f.id as string) ?? null,
    chunk_count: chunkCountByFileId.get(f.id as string) ?? 0,
  }));
}

// ─── Fact queries ─────────────────────────────────────────────────────────────

export async function getFactDefinitionsForEntityType(
  entityTypeId: string
): Promise<FactDefinition[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fact_definition_entity_types")
    .select("fact_definitions(*), display_order, is_required")
    .eq("entity_type_id", entityTypeId)
    .order("display_order");

  return (data ?? [])
    .map((row) => {
      const fd = (row as Record<string, unknown>).fact_definitions;
      return fd ? normalizeFactDefinition(fd as Record<string, unknown>) : null;
    })
    .filter((fd): fd is FactDefinition => fd !== null);
}

export async function getCurrentFactsForEntity(entityId: string): Promise<EntityFactValue[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_fact_values")
    .select("*")
    .eq("entity_id", entityId)
    .order("updated_at", { ascending: false });

  return (data ?? []).map((r) => normalizeEntityFactValue(r as Record<string, unknown>));
}

export async function getFactEvidenceForEntity(
  entityId: string,
  factDefinitionId?: string
): Promise<FactEvidence[]> {
  const supabase = await createClient();
  let query = supabase
    .from("fact_evidence")
    .select("*")
    .eq("entity_id", entityId)
    .eq("is_superseded", false)
    .order("confidence", { ascending: false });

  if (factDefinitionId) {
    query = query.eq("fact_definition_id", factDefinitionId);
  }

  const { data } = await query;

  return (data ?? []).map((r) => ({
    id: r.id as string,
    entity_id: r.entity_id as string,
    fact_definition_id: r.fact_definition_id as string,
    file_id: r.file_id as string,
    file_chunk_id: (r.file_chunk_id as string | null) ?? null,
    extracted_value_raw: (r.extracted_value_raw as string | null) ?? null,
    normalized_value_json: (r.normalized_value_json as Record<string, unknown>) ?? {},
    snippet: (r.snippet as string | null) ?? null,
    page_number: (r.page_number as number | null) ?? null,
    confidence: (r.confidence as number | null) ?? null,
    extractor_version: (r.extractor_version as string | null) ?? null,
    evidence_status: (r.evidence_status as FactEvidence["evidence_status"]) ?? "candidate",
    is_superseded: (r.is_superseded as boolean) ?? false,
    is_conflicting: (r.is_conflicting as boolean) ?? false,
    created_at: r.created_at as string,
  }));
}

// ─── Analysis snapshot queries ────────────────────────────────────────────────

export async function getAnalysisSnapshotsForEntity(
  entityId: string,
  analysisType?: AnalysisSnapshot["analysis_type"]
): Promise<AnalysisSnapshot[]> {
  const supabase = await createClient();
  let query = supabase
    .from("analysis_snapshots")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (analysisType) {
    query = query.eq("analysis_type", analysisType);
  }

  const { data } = await query;
  return (data ?? []).map((r) => normalizeAnalysisSnapshot(r as Record<string, unknown>));
}

export async function getLatestAnalysisSnapshot(
  entityId: string,
  analysisType: AnalysisSnapshot["analysis_type"]
): Promise<AnalysisSnapshot | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_snapshots")
    .select("*")
    .eq("entity_id", entityId)
    .eq("analysis_type", analysisType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? normalizeAnalysisSnapshot(data as Record<string, unknown>) : null;
}

// ─── Entity event queries ─────────────────────────────────────────────────────

export async function getEntityHistory(
  entityId: string,
  limit = 50
): Promise<EntityEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_events")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => normalizeEntityEvent(r as Record<string, unknown>));
}

// ─── Full page data ───────────────────────────────────────────────────────────

export async function getEntityPageData(
  dealId: string,
  userId: string
): Promise<EntityPageData | null> {
  const entity = await getEntityByLegacyDealId(dealId, userId);
  if (!entity) return null;

  const supabase = await createClient();

  const [entityTypeResult, files, factValues, snapshots, events, evidenceResult] = await Promise.all([
    supabase.from("entity_types").select("*").eq("id", entity.entity_type_id).maybeSingle(),
    getFilesWithTextForEntity(entity.id),
    getCurrentFactsForEntity(entity.id),
    getAnalysisSnapshotsForEntity(entity.id),
    getEntityHistory(entity.id),
    // Load non-superseded evidence for source traceability in the Facts tab
    supabase
      .from("fact_evidence")
      .select("*")
      .eq("entity_id", entity.id)
      .eq("is_superseded", false)
      .order("created_at", { ascending: false }),
  ]);

  if (!entityTypeResult.data) return null;

  const entityType = entityTypeResult.data as EntityType;
  const factDefs = await getFactDefinitionsForEntityType(entity.entity_type_id);

  const factEvidence = (evidenceResult.data ?? []).map((row) =>
    normalizeFactEvidence(row as Record<string, unknown>)
  );

  return {
    entity,
    entity_type: entityType,
    files,
    fact_values: factValues,
    fact_definitions: factDefs,
    fact_evidence: factEvidence,
    analysis_snapshots: snapshots,
    events,
  };
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export async function insertEntityFile(params: {
  entity_id: string;
  legacy_deal_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  source_type?: string | null;
  document_type?: string | null;
  uploaded_by?: string | null;
  metadata_json?: Record<string, unknown>;
}): Promise<EntityFile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entity_files")
    .insert({
      entity_id: params.entity_id,
      legacy_deal_id: params.legacy_deal_id,
      storage_path: params.storage_path,
      file_name: params.file_name,
      mime_type: params.mime_type ?? null,
      file_size_bytes: params.file_size_bytes ?? null,
      source_type: params.source_type ?? null,
      document_type: params.document_type ?? null,
      uploaded_by: params.uploaded_by ?? null,
      metadata_json: params.metadata_json ?? {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] insertEntityFile failed:", error.message);
    return null;
  }

  return normalizeEntityFile(data as Record<string, unknown>);
}

export async function upsertFileText(params: {
  file_id: string;
  full_text: string | null;
  extraction_method: string;
  extraction_status: FileText["extraction_status"];
  metadata_json?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("file_text")
    .upsert(
      {
        file_id: params.file_id,
        full_text: params.full_text,
        extraction_method: params.extraction_method,
        extraction_status: params.extraction_status,
        extracted_at: params.extraction_status === "done" ? new Date().toISOString() : null,
        metadata_json: params.metadata_json ?? {},
      },
      { onConflict: "file_id" }
    );

  if (error) {
    console.error("[entities] upsertFileText failed:", error.message);
  }
}

export async function insertFileChunks(
  fileId: string,
  chunks: Array<{ text: string; chunk_index: number; token_count?: number; page_number?: number }>
): Promise<void> {
  if (chunks.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("file_chunks").insert(
    chunks.map((c) => ({
      file_id: fileId,
      chunk_index: c.chunk_index,
      text: c.text,
      token_count: c.token_count ?? null,
      page_number: c.page_number ?? null,
    }))
  );

  if (error) {
    console.error("[entities] insertFileChunks failed:", error.message);
  }
}

export async function insertEntityEvent(params: {
  entity_id: string;
  event_type: EntityEvent["event_type"];
  file_id?: string | null;
  fact_definition_id?: string | null;
  metadata_json?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("entity_events").insert({
    entity_id: params.entity_id,
    event_type: params.event_type,
    file_id: params.file_id ?? null,
    fact_definition_id: params.fact_definition_id ?? null,
    metadata_json: params.metadata_json ?? {},
  });

  if (error) {
    console.error("[entities] insertEntityEvent failed:", error.message);
  }
}

export async function upsertEntityFactValue(params: {
  entity_id: string;
  fact_definition_id: string;
  value_raw: string | null;
  value_normalized_json?: Record<string, unknown>;
  status: EntityFactValue["status"];
  confidence?: number | null;
  current_evidence_id?: string | null;
}): Promise<EntityFactValue | null> {
  const supabase = await createClient();

  // Check if there is an existing manual override — if so, do not overwrite value/status.
  // We still update the evidence pointer so the new evidence is recorded.
  const { data: existing } = await supabase
    .from("entity_fact_values")
    .select("id, manual_override, value_raw, status")
    .eq("entity_id", params.entity_id)
    .eq("fact_definition_id", params.fact_definition_id)
    .maybeSingle();

  const isManuallyOverridden = (existing as Record<string, unknown> | null)?.manual_override === true;

  const upsertPayload: Record<string, unknown> = {
    entity_id: params.entity_id,
    fact_definition_id: params.fact_definition_id,
    updated_at: new Date().toISOString(),
    current_evidence_id: params.current_evidence_id ?? null,
  };

  if (isManuallyOverridden) {
    // Preserve the user's confirmed value and status.
    // Only update the evidence pointer so the new extraction is recorded.
    // If the extracted value conflicts, mark as conflicting but keep user value.
    const existingRaw = (existing as Record<string, unknown>).value_raw as string | null;
    const valuesMatch = existingRaw === params.value_raw;
    if (!valuesMatch) {
      upsertPayload.status = "conflicting";
    }
    // Do NOT overwrite value_raw, confidence, or manual_override
  } else {
    upsertPayload.value_raw = params.value_raw;
    upsertPayload.value_normalized_json = params.value_normalized_json ?? {};
    upsertPayload.status = params.status;
    upsertPayload.confidence = params.confidence ?? null;
  }

  const { data, error } = await supabase
    .from("entity_fact_values")
    .upsert(upsertPayload, { onConflict: "entity_id,fact_definition_id" })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] upsertEntityFactValue failed:", error.message);
    return null;
  }

  return normalizeEntityFactValue(data as Record<string, unknown>);
}

export async function insertFactEvidence(params: {
  entity_id: string;
  fact_definition_id: string;
  file_id: string;
  file_chunk_id?: string | null;
  extracted_value_raw: string | null;
  normalized_value_json?: Record<string, unknown>;
  snippet?: string | null;
  page_number?: number | null;
  confidence?: number | null;
  extractor_version?: string;
}): Promise<FactEvidence | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fact_evidence")
    .insert({
      entity_id: params.entity_id,
      fact_definition_id: params.fact_definition_id,
      file_id: params.file_id,
      file_chunk_id: params.file_chunk_id ?? null,
      extracted_value_raw: params.extracted_value_raw,
      normalized_value_json: params.normalized_value_json ?? {},
      snippet: params.snippet ?? null,
      page_number: params.page_number ?? null,
      confidence: params.confidence ?? null,
      extractor_version: params.extractor_version ?? null,
      evidence_status: "candidate",
      is_superseded: false,
      is_conflicting: false,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] insertFactEvidence failed:", error.message);
    return null;
  }

  return {
    id: data.id as string,
    entity_id: data.entity_id as string,
    fact_definition_id: data.fact_definition_id as string,
    file_id: data.file_id as string,
    file_chunk_id: (data.file_chunk_id as string | null) ?? null,
    extracted_value_raw: (data.extracted_value_raw as string | null) ?? null,
    normalized_value_json: (data.normalized_value_json as Record<string, unknown>) ?? {},
    snippet: (data.snippet as string | null) ?? null,
    page_number: (data.page_number as number | null) ?? null,
    confidence: (data.confidence as number | null) ?? null,
    extractor_version: (data.extractor_version as string | null) ?? null,
    evidence_status: (data.evidence_status as FactEvidence["evidence_status"]) ?? "candidate",
    is_superseded: (data.is_superseded as boolean) ?? false,
    is_conflicting: (data.is_conflicting as boolean) ?? false,
    created_at: data.created_at as string,
  };
}

// ─── Fact editing helpers ─────────────────────────────────────────────────────

/**
 * Manually update a fact value (confirm, edit, override, mark_conflict, mark_missing).
 * Sets manual_override=true for confirm/edit/override so future AI extraction
 * will not silently overwrite the value.
 */
export async function manuallyUpdateFactValue(params: {
  entity_id: string;
  fact_definition_id: string;
  value_raw: string | null;
  status: EntityFactValue["status"];
  change_type: FactChangeType;
  changed_by: string;
  note?: string | null;
  old_value?: string | null;
  old_status?: string | null;
}): Promise<EntityFactValue | null> {
  const supabase = await createClient();
  const isManual = ["confirm", "edit", "override"].includes(params.change_type);

  const { data, error } = await supabase
    .from("entity_fact_values")
    .upsert(
      {
        entity_id: params.entity_id,
        fact_definition_id: params.fact_definition_id,
        value_raw: params.value_raw,
        value_normalized_json: {},
        status: params.status,
        confidence: isManual ? 1.0 : null,
        manual_override: isManual,
        override_note: params.note ?? null,
        override_by: isManual ? params.changed_by : null,
        override_at: isManual ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_id,fact_definition_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[entities] manuallyUpdateFactValue failed:", error.message);
    return null;
  }

  // Write audit log entry
  await supabase.from("fact_edit_log").insert({
    entity_id: params.entity_id,
    fact_definition_id: params.fact_definition_id,
    changed_by: params.changed_by,
    change_type: params.change_type,
    old_value: params.old_value ?? null,
    new_value: params.value_raw,
    old_status: params.old_status ?? null,
    new_status: params.status,
    note: params.note ?? null,
  });

  return normalizeEntityFactValue(data as Record<string, unknown>);
}

export async function getFactEditLog(
  entityId: string,
  factDefinitionId?: string
): Promise<FactEditLogEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("fact_edit_log")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (factDefinitionId) {
    query = query.eq("fact_definition_id", factDefinitionId);
  }

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    entity_id: r.entity_id as string,
    fact_definition_id: r.fact_definition_id as string,
    changed_by: r.changed_by as string,
    change_type: r.change_type as FactChangeType,
    old_value: (r.old_value as string | null) ?? null,
    new_value: (r.new_value as string | null) ?? null,
    old_status: (r.old_status as string | null) ?? null,
    new_status: (r.new_status as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

// ─── Deep scan helpers ────────────────────────────────────────────────────────

export async function updateEntityDeepScanStatus(
  entityId: string,
  status: Entity["deep_scan_status"],
  stats?: {
    facts_added?: number;
    facts_updated?: number;
    conflicts_found?: number;
  }
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    deep_scan_status: status,
  };

  if (status === "running") {
    update.deep_scan_started_at = now;
    update.deep_scan_completed_at = null;
  } else if (status === "completed" || status === "failed") {
    update.deep_scan_completed_at = now;
    if (stats) {
      update.deep_scan_facts_added = stats.facts_added ?? 0;
      update.deep_scan_facts_updated = stats.facts_updated ?? 0;
      update.deep_scan_conflicts_found = stats.conflicts_found ?? 0;
    }
  }

  const { error } = await supabase
    .from("entities")
    .update(update)
    .eq("id", entityId);

  if (error) {
    console.error("[entities] updateEntityDeepScanStatus failed:", error.message);
  }
}

export async function getFileTextsForEntity(
  entityId: string
): Promise<Array<{ file_id: string; full_text: string; file_name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_files")
    .select("id, file_name, file_text(full_text, extraction_status)")
    .eq("entity_id", entityId);

  const results: Array<{ file_id: string; full_text: string; file_name: string }> = [];
  for (const row of data ?? []) {
    const ft = (row as Record<string, unknown>).file_text as Record<string, unknown> | null;
    const fullText = ft?.full_text as string | null;
    if (fullText && fullText.trim().length > 0) {
      results.push({
        file_id: row.id as string,
        full_text: fullText,
        file_name: row.file_name as string,
      });
    }
  }
  return results;
}

/** Richer version used by the analysis context builder — includes source metadata. */
export async function getFileTextsWithMetaForEntity(
  entityId: string
): Promise<Array<{
  file_id: string;
  full_text: string;
  file_name: string;
  source_type: string | null;
  uploaded_at: string;
}>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_files")
    .select("id, file_name, source_type, uploaded_at, file_text(full_text, extraction_status)")
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: true });

  const results: Array<{
    file_id: string;
    full_text: string;
    file_name: string;
    source_type: string | null;
    uploaded_at: string;
  }> = [];

  for (const row of data ?? []) {
    const ft = (row as Record<string, unknown>).file_text as Record<string, unknown> | null;
    const fullText = ft?.full_text as string | null;
    if (fullText && fullText.trim().length > 0) {
      results.push({
        file_id: row.id as string,
        full_text: fullText,
        file_name: row.file_name as string,
        source_type: (row.source_type as string | null) ?? null,
        uploaded_at: row.uploaded_at as string,
      });
    }
  }
  return results;
}

export async function insertAnalysisSnapshot(params: {
  entity_id: string;
  analysis_type: AnalysisSnapshot["analysis_type"];
  title?: string | null;
  content_json: Record<string, unknown>;
  model_name?: string | null;
  prompt_version?: string | null;
}): Promise<AnalysisSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analysis_snapshots")
    .insert({
      entity_id: params.entity_id,
      analysis_type: params.analysis_type,
      title: params.title ?? null,
      content_json: params.content_json,
      model_name: params.model_name ?? null,
      prompt_version: params.prompt_version ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] insertAnalysisSnapshot failed:", error.message);
    return null;
  }

  return normalizeAnalysisSnapshot(data as Record<string, unknown>);
}
