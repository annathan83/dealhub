/**
 * entityEventService
 *
 * Thin wrapper around insertEntityEvent that provides typed helpers
 * for each event type in the entity-fact-evidence pipeline.
 *
 * All functions are non-fatal — they log errors but never throw.
 *
 * Migration 026: all helpers now accept optional run_id and actor_user_id
 * for richer audit trail and run traceability.
 */

import { insertEntityEvent } from "@/lib/db/entities";
import type { EntityEvent } from "@/types/entity";

type EventMeta = Record<string, unknown>;

type EventOptions = {
  runId?: string | null;
  actorUserId?: string | null;
};

export async function logFileUploaded(
  entityId: string,
  fileId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "file_uploaded",
    file_id: fileId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFileUploaded:", err));
}

export async function logTextExtracted(
  entityId: string,
  fileId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "text_extracted",
    file_id: fileId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logTextExtracted:", err));
}

export async function logFactsExtracted(
  entityId: string,
  fileId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "facts_extracted",
    file_id: fileId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactsExtracted:", err));
}

export async function logFactUpdated(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_updated",
    fact_definition_id: factDefinitionId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactUpdated:", err));
}

export async function logFactConflictDetected(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_conflict_detected",
    fact_definition_id: factDefinitionId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactConflictDetected:", err));
}

export async function logAnalysisRefreshed(
  entityId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "analysis_refreshed",
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logAnalysisRefreshed:", err));
}

export async function logFactManuallyEdited(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_manually_edited",
    fact_definition_id: factDefinitionId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactManuallyEdited:", err));
}

export async function logFactManuallyConfirmed(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_manually_confirmed",
    fact_definition_id: factDefinitionId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactManuallyConfirmed:", err));
}

export async function logDealEdited(
  entityId: string,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "deal_edited",
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logDealEdited:", err));
}

export async function logEntryAdded(
  entityId: string,
  fileId: string | null,
  meta: EventMeta = {},
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "entry_added",
    file_id: fileId,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logEntryAdded:", err));
}

/** Generic event logger for any event type */
export async function logEntityEvent(
  entityId: string,
  eventType: EntityEvent["event_type"],
  meta: EventMeta = {},
  fileId?: string,
  factDefinitionId?: string,
  opts: EventOptions = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: eventType,
    file_id: fileId ?? null,
    fact_definition_id: factDefinitionId ?? null,
    run_id: opts.runId ?? null,
    actor_user_id: opts.actorUserId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logEntityEvent:", err));
}
