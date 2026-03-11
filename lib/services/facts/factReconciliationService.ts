/**
 * factReconciliationService
 *
 * Implements the 5-state reconciliation logic for entity_fact_values.
 *
 * States:
 *   confirmed    — one or more consistent pieces of evidence
 *   unclear      — evidence present but low confidence
 *   missing      — no evidence found
 *   conflicting  — multiple pieces of evidence disagree
 *   estimated    — value derived/calculated, not directly stated
 *
 * Reconciliation rules (as specified in the plan):
 *   1. No current value → use best evidence → confirmed
 *   2. New evidence matches current → update confidence if stronger
 *   3. New evidence differs → mark conflicting, keep both
 *   4. New evidence clearly stronger/newer → supersede old, update → confirmed
 */

import {
  insertFactEvidence,
  upsertEntityFactValue,
  getFactEvidenceForEntity,
  getCurrentFactsForEntity,
  promoteEvidenceToPrimary,
} from "@/lib/db/entities";
import { logFactUpdated, logFactConflictDetected } from "../entity/entityEventService";
import type { ExtractedFactCandidate } from "./factExtractionService";
import type { FactDefinition, EntityFactValue } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReconciliationInput = {
  entityId: string;
  fileId: string;
  entityTitle: string;
  factDefinitions: FactDefinition[];
  candidates: ExtractedFactCandidate[];
  extractor_version: string;
};

export type ReconciliationResult = {
  facts_inserted: number;
  facts_updated: number;
  facts_conflicted: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFLICT_THRESHOLD = 0.15;         // values differ by more than 15% → conflicting
const MIN_CONFIDENCE_FOR_SUPERSEDE = 0.7; // new evidence must be ≥ 0.7 to supersede
/**
 * AI facts at or above this confidence are automatically marked review_status=confirmed.
 * Below this threshold they stay "unreviewed" and surface as "Needs Review" in the UI.
 */
const AUTO_CONFIRM_CONFIDENCE_THRESHOLD = 0.7;

function valuesConflict(
  existing: string | null,
  incoming: string,
  dataType: string
): boolean {
  if (!existing) return false;

  if (dataType === "currency" || dataType === "number" || dataType === "percent") {
    const a = parseFloat(existing.replace(/[^0-9.-]/g, ""));
    const b = parseFloat(incoming.replace(/[^0-9.-]/g, ""));
    if (isNaN(a) || isNaN(b)) return existing.trim() !== incoming.trim();
    if (a === 0 && b === 0) return false;
    const diff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
    return diff > CONFLICT_THRESHOLD;
  }

  if (dataType === "boolean") {
    return existing.toLowerCase() !== incoming.toLowerCase();
  }

  // Text: consider conflicting only if substantially different
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return normalize(existing) !== normalize(incoming);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reconcile extracted fact candidates with existing entity_fact_values.
 * Inserts fact_evidence rows and upserts entity_fact_values.
 * Non-fatal — logs errors but does not throw.
 */
export async function reconcileFacts(
  input: ReconciliationInput
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    facts_inserted: 0,
    facts_updated: 0,
    facts_conflicted: 0,
  };

  if (input.candidates.length === 0) return result;

  const factDefByKey = new Map<string, FactDefinition>();
  for (const fd of input.factDefinitions) {
    factDefByKey.set(fd.key, fd);
  }

  // Fetch all current evidence for this entity (to check conflicts)
  const [existingEvidence, currentFactValues] = await Promise.all([
    getFactEvidenceForEntity(input.entityId),
    getCurrentFactsForEntity(input.entityId),
  ]);

  const evidenceByFactId = new Map<string, typeof existingEvidence[0][]>();
  for (const ev of existingEvidence) {
    const list = evidenceByFactId.get(ev.fact_definition_id) ?? [];
    list.push(ev);
    evidenceByFactId.set(ev.fact_definition_id, list);
  }

  // Map current fact values by fact_definition_id for conflict detection against manual entries
  const currentFactByDefId = new Map<string, EntityFactValue>();
  for (const fv of currentFactValues) {
    currentFactByDefId.set(fv.fact_definition_id, fv);
  }

  for (const candidate of input.candidates) {
    try {
      const factDef = factDefByKey.get(candidate.fact_key);
      if (!factDef) continue;

      // 1. Insert the new fact_evidence row
      const evidence = await insertFactEvidence({
        entity_id: input.entityId,
        fact_definition_id: factDef.id,
        file_id: input.fileId,
        extracted_value_raw: candidate.extracted_value_raw,
        normalized_value_json: candidate.normalized_value,
        snippet: candidate.snippet,
        page_number: candidate.page_number,
        confidence: candidate.confidence,
        extractor_version: input.extractor_version,
      });

      if (!evidence) continue;
      result.facts_inserted++;

      // 2. Get existing entity_fact_value for this fact
      const existingForFact = evidenceByFactId.get(factDef.id) ?? [];
      const bestExisting = existingForFact.reduce<typeof existingForFact[0] | null>(
        (best, ev) => {
          if (!best) return ev;
          return (ev.confidence ?? 0) > (best.confidence ?? 0) ? ev : best;
        },
        null
      );

      // 2b. Also check if there's a manually-entered (user_override) value.
      //     This handles the case where the user entered values at deal creation,
      //     whether or not there is already an evidence row.
      const existingFactValue = currentFactByDefId.get(factDef.id);
      const isExistingUserOverride =
        existingFactValue?.value_source_type === "user_override" &&
        existingFactValue?.value_raw !== null;

      let newStatus: EntityFactValue["status"] = "confirmed";
      let newConfidence = candidate.confidence;
      let newEvidenceId = evidence.id;

      if (!bestExisting && !isExistingUserOverride) {
        // Rule 1: No existing evidence or manual entry — use this as confirmed
        newStatus = candidate.confidence >= 0.5 ? "confirmed" : "unclear";
      } else if (isExistingUserOverride) {
        // Rule 1b: There IS a manually-entered value (with or without prior evidence).
        // Check if the new AI value conflicts with what the user manually entered.
        const manualValue = existingFactValue!.value_raw!;
        const hasConflictWithManual = valuesConflict(
          manualValue,
          candidate.extracted_value_raw,
          factDef.data_type
        );

        if (hasConflictWithManual) {
          // AI value differs from manual entry — surface as conflict for user to resolve.
          // Keep the existing manual value as the current value (do not overwrite with AI value).
          newStatus = "conflicting";
          newConfidence = existingFactValue!.confidence ?? candidate.confidence;
          // Keep the existing evidence id so the displayed value stays as the manual entry
          newEvidenceId = existingFactValue!.current_evidence_id ?? evidence.id;
          result.facts_conflicted++;

          await logFactConflictDetected(input.entityId, factDef.id, {
            existing_value: manualValue,
            new_value: candidate.extracted_value_raw,
            fact_key: candidate.fact_key,
            fact_label: factDef.label,
            source_file_id: input.fileId,
            snippet: candidate.snippet ?? null,
          }, { fileId: input.fileId });
        } else {
          // AI confirms the manual value — upgrade to document-backed
          newStatus = "confirmed";
          newConfidence = candidate.confidence;
          newEvidenceId = evidence.id;
          result.facts_updated++;

          await logFactUpdated(input.entityId, factDef.id, {
            old_value: manualValue,
            new_value: candidate.extracted_value_raw,
            fact_key: candidate.fact_key,
            fact_label: factDef.label,
            source_file_id: input.fileId,
            snippet: candidate.snippet ?? null,
          }, { fileId: input.fileId });
        }
      } else {
        // Rule 2/3/4: There is prior evidence — compare new evidence against the best existing one.
        const hasConflict = valuesConflict(
          bestExisting!.extracted_value_raw,
          candidate.extracted_value_raw,
          factDef.data_type
        );

        if (hasConflict) {
          // Rule 3: Values conflict
          newStatus = "conflicting";
          newConfidence = Math.max(candidate.confidence, bestExisting!.confidence ?? 0);
          newEvidenceId = bestExisting!.id; // keep existing as "current"
          result.facts_conflicted++;

          await logFactConflictDetected(input.entityId, factDef.id, {
            existing_value: bestExisting!.extracted_value_raw,
            new_value: candidate.extracted_value_raw,
            fact_key: candidate.fact_key,
            fact_label: factDef.label,
            source_file_id: input.fileId,
            snippet: candidate.snippet ?? null,
          }, { fileId: input.fileId });
        } else if (
          candidate.confidence >= MIN_CONFIDENCE_FOR_SUPERSEDE &&
          candidate.confidence > (bestExisting!.confidence ?? 0)
        ) {
          // Rule 4: New evidence is clearly stronger — supersede old
          newStatus = "confirmed";
          newConfidence = candidate.confidence;
          newEvidenceId = evidence.id;
          result.facts_updated++;

          await logFactUpdated(input.entityId, factDef.id, {
            old_value: bestExisting!.extracted_value_raw,
            new_value: candidate.extracted_value_raw,
            fact_key: candidate.fact_key,
            fact_label: factDef.label,
            source_file_id: input.fileId,
            snippet: candidate.snippet ?? null,
          }, { fileId: input.fileId });
        } else {
          // Rule 2: New evidence matches or is weaker — update confidence if stronger
          newStatus = "confirmed";
          if (candidate.confidence > (bestExisting!.confidence ?? 0)) {
            newConfidence = candidate.confidence;
            newEvidenceId = evidence.id;
            result.facts_updated++;
          } else {
            newConfidence = bestExisting!.confidence ?? candidate.confidence;
            newEvidenceId = bestExisting!.id;
          }
        }
      }

      // 3. Upsert entity_fact_value
      // ai_extracted = direct quote/number found in source material (has snippet)
      // ai_inferred  = AI estimated from context without a direct evidence snippet
      const sourceType = candidate.snippet ? "ai_extracted" : "ai_inferred";

      // Auto-confirm high-confidence AI facts so users are not prompted to review them.
      // Conflicts and low-confidence facts stay "unreviewed" and surface in the UI.
      const autoConfirmed =
        newStatus !== "conflicting" &&
        newConfidence >= AUTO_CONFIRM_CONFIDENCE_THRESHOLD;
      const reviewStatusToSet = autoConfirmed ? "confirmed" : "unreviewed";

      // When conflicting, upsertEntityFactValue preserves the existing user_override value
      // automatically (it only updates status + current_evidence_id for user_override rows).
      // For non-user-override conflicts, keep the existing evidence value as current.
      const valueToStore = newStatus === "conflicting" && !isExistingUserOverride
        ? (bestExisting?.extracted_value_raw ?? candidate.extracted_value_raw)
        : candidate.extracted_value_raw;

      await upsertEntityFactValue({
        entity_id: input.entityId,
        fact_definition_id: factDef.id,
        value_raw: valueToStore,
        value_normalized_json: candidate.normalized_value,
        status: newStatus,
        confidence: newConfidence,
        current_evidence_id: newEvidenceId,
        value_source_type: sourceType,
        review_status: reviewStatusToSet,
      });

      // 4. Promote the winning evidence row to is_primary=true, demote others.
      //    Skip when conflicting — no clear winner in that case.
      if (newStatus !== "conflicting") {
        await promoteEvidenceToPrimary(
          input.entityId,
          factDef.id,
          newEvidenceId
        ).catch((err) => {
          console.error(
            `[factReconciliationService] promoteEvidenceToPrimary failed for "${candidate.fact_key}":`,
            err
          );
        });
      }
    } catch (err) {
      console.error(
        `[factReconciliationService] Failed to reconcile fact "${candidate.fact_key}":`,
        err
      );
    }
  }

  return result;
}
