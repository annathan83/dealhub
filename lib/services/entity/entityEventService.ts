/**
 * entityEventService
 *
 * Thin wrapper around insertEntityEvent that provides typed helpers
 * for each event type in the entity-fact-evidence pipeline.
 *
 * All functions are non-fatal — they log errors but never throw.
 */

import { insertEntityEvent } from "@/lib/db/entities";
import type { EntityEvent } from "@/types/entity";

type EventMeta = Record<string, unknown>;

export async function logFileUploaded(
  entityId: string,
  fileId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "file_uploaded",
    file_id: fileId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFileUploaded:", err));
}

export async function logTextExtracted(
  entityId: string,
  fileId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "text_extracted",
    file_id: fileId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logTextExtracted:", err));
}

export async function logFactsExtracted(
  entityId: string,
  fileId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "facts_extracted",
    file_id: fileId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactsExtracted:", err));
}

export async function logFactUpdated(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_updated",
    fact_definition_id: factDefinitionId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactUpdated:", err));
}

export async function logFactConflictDetected(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_conflict_detected",
    fact_definition_id: factDefinitionId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactConflictDetected:", err));
}

export async function logAnalysisRefreshed(
  entityId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "analysis_refreshed",
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logAnalysisRefreshed:", err));
}

export async function logFactManuallyEdited(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_manually_edited",
    fact_definition_id: factDefinitionId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactManuallyEdited:", err));
}

export async function logFactManuallyConfirmed(
  entityId: string,
  factDefinitionId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "fact_manually_confirmed",
    fact_definition_id: factDefinitionId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logFactManuallyConfirmed:", err));
}

export async function logDealEdited(
  entityId: string,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "deal_edited",
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logDealEdited:", err));
}

export async function logEntryAdded(
  entityId: string,
  fileId: string | null,
  meta: EventMeta = {}
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: "entry_added",
    file_id: fileId,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logEntryAdded:", err));
}

/** Generic event logger for any event type */
export async function logEntityEvent(
  entityId: string,
  eventType: EntityEvent["event_type"],
  meta: EventMeta = {},
  fileId?: string,
  factDefinitionId?: string
): Promise<void> {
  await insertEntityEvent({
    entity_id: entityId,
    event_type: eventType,
    file_id: fileId ?? null,
    fact_definition_id: factDefinitionId ?? null,
    metadata_json: meta,
  }).catch((err) => console.error("[entityEventService] logEntityEvent:", err));
}
