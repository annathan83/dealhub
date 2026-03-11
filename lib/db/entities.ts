/**
 * entities repository
 *
 * Read/write access to the entity-fact-evidence tables.
 * All functions are safe to call from server components and API routes.
 *
 * Architecture notes (migration 026):
 * - file_text table renamed to file_texts; supports multiple text records per file
 * - file_chunks now reference file_text_id (specific text record)
 * - fact_definitions have fact_scope / stage metadata
 * - entity_fact_values have richer value_source_type + review_status lifecycle
 * - processing_runs table tracks all system operations explicitly
 * - analysis_snapshots linked to processing_runs via run_id
 * - entity_events have run_id + actor_user_id
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Entity,
  EntityType,
  EntityFile,
  FileText,
  FileTextType,
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
  ProcessingRun,
  ProcessingRunType,
  ProcessingRunStatus,
  ProcessingRunTrigger,
  ValueSourceType,
  ReviewStatus,
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
    // Denormalized summary fields (source of truth for staleness UI)
    deep_analysis_run_at: (row.deep_analysis_run_at as string | null) ?? null,
    deep_analysis_stale: (row.deep_analysis_stale as boolean) ?? false,
    latest_source_at: (row.latest_source_at as string | null) ?? null,
    // Incremental revaluation tracking (migration 034)
    last_revaluation_at: (row.last_revaluation_at as string | null) ?? null,
    revaluation_stale: (row.revaluation_stale as boolean) ?? false,
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
    web_view_link: (row.web_view_link as string | null) ?? null,
    drive_created_time: (row.drive_created_time as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
  };
}

function normalizeFileText(row: Record<string, unknown>): FileText {
  return {
    id: row.id as string,
    file_id: row.file_id as string,
    text_type: (row.text_type as FileTextType) ?? "raw_extracted",
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
    fact_scope: (row.fact_scope as FactDefinition["fact_scope"]) ?? "deep",
    display_order: (row.display_order as number | null) ?? null,
    is_user_visible_initially: (row.is_user_visible_initially as boolean) ?? false,
    is_required_for_kpi: (row.is_required_for_kpi as boolean) ?? false,
    industry_key: (row.industry_key as string | null) ?? null,
    is_derived: (row.is_derived as boolean) ?? false,
    fact_group: (row.fact_group as FactDefinition["fact_group"]) ?? null,
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
    // Source/review lifecycle
    value_source_type: (row.value_source_type as ValueSourceType) ?? "ai_extracted",
    review_status: (row.review_status as ReviewStatus) ?? "unreviewed",
    confirmed_by_user_id: (row.confirmed_by_user_id as string | null) ?? null,
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    change_reason: (row.change_reason as string | null) ?? null,
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
    evidence_status: (row.evidence_status as FactEvidence["evidence_status"]) ?? "candidate",
    evidence_type: (row.evidence_type as FactEvidence["evidence_type"]) ?? "ai_extraction",
    is_primary: (row.is_primary as boolean) ?? false,
    evidence_rank: (row.evidence_rank as number | null) ?? null,
    is_superseded: (row.is_superseded as boolean) ?? false,
    superseded_at: (row.superseded_at as string | null) ?? null,
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
    run_id: (row.run_id as string | null) ?? null,
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
    run_id: (row.run_id as string | null) ?? null,
    actor_user_id: (row.actor_user_id as string | null) ?? null,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  };
}

function normalizeProcessingRun(row: Record<string, unknown>): ProcessingRun {
  return {
    id: row.id as string,
    entity_id: row.entity_id as string,
    run_type: row.run_type as ProcessingRunType,
    status: row.status as ProcessingRunStatus,
    triggered_by_type: (row.triggered_by_type as ProcessingRunTrigger) ?? "system",
    triggered_by_user_id: (row.triggered_by_user_id as string | null) ?? null,
    model_name: (row.model_name as string | null) ?? null,
    model_version: (row.model_version as string | null) ?? null,
    prompt_version: (row.prompt_version as string | null) ?? null,
    input_hash: (row.input_hash as string | null) ?? null,
    related_file_id: (row.related_file_id as string | null) ?? null,
    related_text_id: (row.related_text_id as string | null) ?? null,
    output_summary_json: (row.output_summary_json as Record<string, unknown>) ?? {},
    error_message: (row.error_message as string | null) ?? null,
    error_details_json: (row.error_details_json as Record<string, unknown> | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
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
    // Fetch all text records (multi-version); prefer raw_extracted for backward compat
    supabase.from("file_texts").select("*").in("file_id", fileIds),
    supabase.from("file_chunks").select("file_id").in("file_id", fileIds),
  ]);

  // Group all text records by file_id
  const textsByFileId = new Map<string, FileText[]>();
  for (const row of textResult.data ?? []) {
    const fileId = row.file_id as string;
    const existing = textsByFileId.get(fileId) ?? [];
    existing.push(normalizeFileText(row as Record<string, unknown>));
    textsByFileId.set(fileId, existing);
  }

  const chunkCountByFileId = new Map<string, number>();
  for (const row of chunkCountResult.data ?? []) {
    const id = row.file_id as string;
    chunkCountByFileId.set(id, (chunkCountByFileId.get(id) ?? 0) + 1);
  }

  return files.map((f) => {
    const allTexts = textsByFileId.get(f.id as string) ?? [];
    // Prefer raw_extracted for the primary file_text field (backward compat)
    const primaryText =
      allTexts.find((t) => t.text_type === "raw_extracted") ??
      allTexts.find((t) => t.text_type === "transcript") ??
      allTexts[0] ??
      null;

    return {
      ...normalizeEntityFile(f as Record<string, unknown>),
      file_text: primaryText,
      chunk_count: chunkCountByFileId.get(f.id as string) ?? 0,
      all_texts: allTexts,
    };
  });
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

/** Returns only triage-scoped fact definitions (for initial review). */
export async function getTriageFactDefinitions(
  entityTypeId: string
): Promise<FactDefinition[]> {
  const all = await getFactDefinitionsForEntityType(entityTypeId);
  return all.filter((fd) => fd.fact_scope === "triage" || fd.is_user_visible_initially);
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
  return (data ?? []).map((r) => normalizeFactEvidence(r as Record<string, unknown>));
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

// ─── Processing run queries ───────────────────────────────────────────────────

export async function getProcessingRunsForEntity(
  entityId: string,
  runType?: ProcessingRunType
): Promise<ProcessingRun[]> {
  const supabase = await createClient();
  let query = supabase
    .from("processing_runs")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (runType) {
    query = query.eq("run_type", runType);
  }

  const { data } = await query;
  return (data ?? []).map((r) => normalizeProcessingRun(r as Record<string, unknown>));
}

export async function getLatestProcessingRun(
  entityId: string,
  runType: ProcessingRunType
): Promise<ProcessingRun | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("processing_runs")
    .select("*")
    .eq("entity_id", entityId)
    .eq("run_type", runType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? normalizeProcessingRun(data as Record<string, unknown>) : null;
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
  title?: string | null;
  summary?: string | null;
  web_view_link?: string | null;
  drive_created_time?: string | null;
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
      title: params.title ?? null,
      summary: params.summary ?? null,
      web_view_link: params.web_view_link ?? null,
      drive_created_time: params.drive_created_time ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] insertEntityFile failed:", error.message);
    return null;
  }

  return normalizeEntityFile(data as Record<string, unknown>);
}

/**
 * Upsert a text record for a file.
 * Migration 026: file_text renamed to file_texts; unique constraint is now (file_id, text_type).
 * Defaults to text_type='raw_extracted' for backward compatibility.
 */
export async function upsertFileText(params: {
  file_id: string;
  full_text: string | null;
  extraction_method: string;
  extraction_status: FileText["extraction_status"];
  text_type?: FileTextType;
  metadata_json?: Record<string, unknown>;
}): Promise<FileText | null> {
  const supabase = await createClient();
  const textType = params.text_type ?? "raw_extracted";

  const { data, error } = await supabase
    .from("file_texts")
    .upsert(
      {
        file_id: params.file_id,
        text_type: textType,
        full_text: params.full_text,
        extraction_method: params.extraction_method,
        extraction_status: params.extraction_status,
        extracted_at: params.extraction_status === "done" ? new Date().toISOString() : null,
        metadata_json: params.metadata_json ?? {},
      },
      { onConflict: "file_id,text_type" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[entities] upsertFileText failed:", error.message);
    return null;
  }

  return normalizeFileText(data as Record<string, unknown>);
}

/**
 * Insert file chunks.
 * Migration 026: chunks now reference file_text_id for provenance.
 * Provide file_text_id when available; file_id is kept for backward compat.
 */
export async function insertFileChunks(
  fileId: string,
  chunks: Array<{ text: string; chunk_index: number; token_count?: number; page_number?: number }>,
  fileTextId?: string | null
): Promise<void> {
  if (chunks.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("file_chunks").insert(
    chunks.map((c) => ({
      file_id: fileId,
      file_text_id: fileTextId ?? null,
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
  run_id?: string | null;
  actor_user_id?: string | null;
  metadata_json?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("entity_events").insert({
    entity_id: params.entity_id,
    event_type: params.event_type,
    file_id: params.file_id ?? null,
    fact_definition_id: params.fact_definition_id ?? null,
    run_id: params.run_id ?? null,
    actor_user_id: params.actor_user_id ?? null,
    metadata_json: params.metadata_json ?? {},
  });

  if (error) {
    console.error("[entities] insertEntityEvent failed:", error.message);
  }
}

/**
 * Upsert a fact value.
 * Respects manual_override (deprecated) and new value_source_type='user_override'.
 * AI extractions will not overwrite user-confirmed values.
 */
export async function upsertEntityFactValue(params: {
  entity_id: string;
  fact_definition_id: string;
  value_raw: string | null;
  value_normalized_json?: Record<string, unknown>;
  status: EntityFactValue["status"];
  confidence?: number | null;
  current_evidence_id?: string | null;
  value_source_type?: ValueSourceType;
  /** Explicit review status. When omitted, defaults to "confirmed" for user_override
   *  and "unreviewed" for all other source types. */
  review_status?: ReviewStatus;
}): Promise<EntityFactValue | null> {
  const supabase = await createClient();

  // Check if there is an existing user override — if so, do not overwrite value/status.
  const { data: existing } = await supabase
    .from("entity_fact_values")
    .select("id, value_source_type, value_raw, status")
    .eq("entity_id", params.entity_id)
    .eq("fact_definition_id", params.fact_definition_id)
    .maybeSingle();

  const existingRow = existing as Record<string, unknown> | null;
  const isUserOverride = existingRow?.value_source_type === "user_override";

  const upsertPayload: Record<string, unknown> = {
    entity_id: params.entity_id,
    fact_definition_id: params.fact_definition_id,
    updated_at: new Date().toISOString(),
    current_evidence_id: params.current_evidence_id ?? null,
  };

  if (isUserOverride) {
    // Preserve the user's confirmed value and status.
    // If the extracted value conflicts, mark as conflicting but keep user value.
    const existingRaw = existingRow?.value_raw as string | null;
    const valuesMatch = existingRaw === params.value_raw;
    if (!valuesMatch) {
      upsertPayload.status = "conflicting";
    }
    // Do NOT overwrite value_raw, confidence, value_source_type, or review_status
  } else {
    upsertPayload.value_raw = params.value_raw;
    upsertPayload.value_normalized_json = params.value_normalized_json ?? {};
    upsertPayload.status = params.status;
    upsertPayload.confidence = params.confidence ?? null;
    upsertPayload.value_source_type = params.value_source_type ?? "ai_extracted";
    // Use explicit review_status if provided; otherwise default based on source type.
    // user_override → confirmed (user explicitly entered), everything else → unreviewed.
    upsertPayload.review_status =
      params.review_status ??
      (params.value_source_type === "user_override" ? "confirmed" : "unreviewed");
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
  file_id?: string | null;
  file_chunk_id?: string | null;
  extracted_value_raw: string | null;
  normalized_value_json?: Record<string, unknown>;
  snippet?: string | null;
  page_number?: number | null;
  confidence?: number | null;
  extractor_version?: string;
  evidence_type?: FactEvidence["evidence_type"];
  is_primary?: boolean;
}): Promise<FactEvidence | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fact_evidence")
    .insert({
      entity_id: params.entity_id,
      fact_definition_id: params.fact_definition_id,
      file_id: params.file_id ?? null,
      file_chunk_id: params.file_chunk_id ?? null,
      extracted_value_raw: params.extracted_value_raw,
      normalized_value_json: params.normalized_value_json ?? {},
      snippet: params.snippet ?? null,
      page_number: params.page_number ?? null,
      confidence: params.confidence ?? null,
      extractor_version: params.extractor_version ?? null,
      evidence_status: "candidate",
      evidence_type: params.evidence_type ?? "ai_extraction",
      is_primary: params.is_primary ?? false,
      is_superseded: false,
      is_conflicting: false,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] insertFactEvidence failed:", error.message);
    return null;
  }

  return normalizeFactEvidence(data as Record<string, unknown>);
}

/**
 * Promote one evidence row to is_primary=true and demote all others for the
 * same (entity_id, fact_definition_id) pair to is_primary=false.
 *
 * Called by reconcileFacts after determining the winning evidence row.
 * Uses two separate updates rather than a single conditional to keep the
 * query simple and avoid RLS issues with bulk updates.
 */
export async function promoteEvidenceToPrimary(
  entityId: string,
  factDefinitionId: string,
  primaryEvidenceId: string
): Promise<void> {
  const supabase = await createClient();

  // Demote all existing primary rows for this fact
  const { error: demoteError } = await supabase
    .from("fact_evidence")
    .update({ is_primary: false })
    .eq("entity_id", entityId)
    .eq("fact_definition_id", factDefinitionId)
    .eq("is_primary", true)
    .neq("id", primaryEvidenceId);

  if (demoteError) {
    console.error("[entities] promoteEvidenceToPrimary (demote) failed:", demoteError.message);
  }

  // Promote the winning row
  const { error: promoteError } = await supabase
    .from("fact_evidence")
    .update({ is_primary: true })
    .eq("id", primaryEvidenceId);

  if (promoteError) {
    console.error("[entities] promoteEvidenceToPrimary (promote) failed:", promoteError.message);
  }
}

// ─── Fact editing helpers ─────────────────────────────────────────────────────

/**
 * Manually update a fact value (confirm, edit, override, mark_conflict, mark_missing).
 * Sets value_source_type='user_override' and review_status='confirmed'/'edited'
 * for confirm/edit/override actions so future AI extraction will not silently
 * overwrite the value.
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

  const reviewStatus: ReviewStatus =
    params.change_type === "confirm" ? "confirmed" :
    params.change_type === "edit" || params.change_type === "override" ? "edited" :
    "rejected";

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
        // New fields
        value_source_type: isManual ? "user_override" : "ai_extracted",
        review_status: reviewStatus,
        confirmed_by_user_id: isManual ? params.changed_by : null,
        confirmed_at: isManual ? new Date().toISOString() : null,
        change_reason: params.note ?? null,
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

  // Write a fact_evidence row for user-entered values so the evidence table
  // has a complete record of all fact sources, not just AI extractions.
  if (isManual && params.value_raw) {
    const evidenceRow = await insertFactEvidence({
      entity_id: params.entity_id,
      fact_definition_id: params.fact_definition_id,
      file_id: null,
      extracted_value_raw: params.value_raw,
      snippet: params.note ?? null,
      confidence: 1.0,
      evidence_type: "user_input",
      is_primary: true,
    });

    // Point the fact value at this new evidence row
    if (evidenceRow) {
      await supabase
        .from("entity_fact_values")
        .update({ current_evidence_id: evidenceRow.id })
        .eq("entity_id", params.entity_id)
        .eq("fact_definition_id", params.fact_definition_id);
    }
  }

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

// ─── Processing run helpers ───────────────────────────────────────────────────

/**
 * Create a new processing run record.
 * Call this at the start of any system operation to get an ID for traceability.
 */
export async function createProcessingRun(params: {
  entity_id: string;
  run_type: ProcessingRunType;
  triggered_by_type?: ProcessingRunTrigger;
  triggered_by_user_id?: string | null;
  model_name?: string | null;
  prompt_version?: string | null;
  related_file_id?: string | null;
  related_text_id?: string | null;
  input_hash?: string | null;
}): Promise<ProcessingRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processing_runs")
    .insert({
      entity_id: params.entity_id,
      run_type: params.run_type,
      status: "queued",
      triggered_by_type: params.triggered_by_type ?? "system",
      triggered_by_user_id: params.triggered_by_user_id ?? null,
      model_name: params.model_name ?? null,
      prompt_version: params.prompt_version ?? null,
      related_file_id: params.related_file_id ?? null,
      related_text_id: params.related_text_id ?? null,
      input_hash: params.input_hash ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] createProcessingRun failed:", error.message);
    return null;
  }

  return normalizeProcessingRun(data as Record<string, unknown>);
}

/**
 * Update a processing run's status and optional output/error details.
 */
export async function updateProcessingRun(
  runId: string,
  update: {
    status: ProcessingRunStatus;
    output_summary_json?: Record<string, unknown>;
    error_message?: string | null;
    error_details_json?: Record<string, unknown> | null;
    model_name?: string | null;
    model_version?: string | null;
    prompt_version?: string | null;
  }
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = { status: update.status };

  if (update.status === "running") {
    payload.started_at = now;
  } else if (update.status === "completed" || update.status === "failed") {
    payload.completed_at = now;
    if (!payload.started_at) payload.started_at = now; // safety
  }

  if (update.output_summary_json !== undefined) {
    payload.output_summary_json = update.output_summary_json;
  }
  if (update.error_message !== undefined) payload.error_message = update.error_message;
  if (update.error_details_json !== undefined) payload.error_details_json = update.error_details_json;
  if (update.model_name !== undefined) payload.model_name = update.model_name;
  if (update.model_version !== undefined) payload.model_version = update.model_version;
  if (update.prompt_version !== undefined) payload.prompt_version = update.prompt_version;

  const { error } = await supabase
    .from("processing_runs")
    .update(payload)
    .eq("id", runId);

  if (error) {
    console.error("[entities] updateProcessingRun failed:", error.message);
  }
}


// ─── Text retrieval helpers ───────────────────────────────────────────────────

export async function getFileTextsForEntity(
  entityId: string
): Promise<Array<{ file_id: string; full_text: string; file_name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_files")
    .select("id, file_name, file_texts(full_text, extraction_status, text_type)")
    .eq("entity_id", entityId);

  const results: Array<{ file_id: string; full_text: string; file_name: string }> = [];
  for (const row of data ?? []) {
    // file_texts is now an array (multiple records per file)
    const texts = (row as Record<string, unknown>).file_texts;
    const textArr = Array.isArray(texts) ? texts : texts ? [texts] : [];
    // Prefer raw_extracted, then transcript, then first available
    const preferred =
      textArr.find((t: Record<string, unknown>) => t.text_type === "raw_extracted") ??
      textArr.find((t: Record<string, unknown>) => t.text_type === "transcript") ??
      textArr[0];
    const fullText = preferred?.full_text as string | null;
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
    .select("id, file_name, source_type, uploaded_at, file_texts(full_text, extraction_status, text_type)")
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
    const texts = (row as Record<string, unknown>).file_texts;
    const textArr = Array.isArray(texts) ? texts : texts ? [texts] : [];
    const preferred =
      textArr.find((t: Record<string, unknown>) => t.text_type === "raw_extracted") ??
      textArr.find((t: Record<string, unknown>) => t.text_type === "transcript") ??
      textArr[0];
    const fullText = preferred?.full_text as string | null;
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
  run_id?: string | null;
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
      run_id: params.run_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[entities] insertAnalysisSnapshot failed:", error.message);
    return null;
  }

  return normalizeAnalysisSnapshot(data as Record<string, unknown>);
}
