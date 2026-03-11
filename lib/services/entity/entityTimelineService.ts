/**
 * entityTimelineService
 *
 * Transforms raw entity_events into human-readable timeline items.
 *
 * Architecture:
 *   1. Read raw EntityEvent[] (already fetched by dealViewModel)
 *   2. Group related low-level events that belong to the same logical action
 *      (e.g. file_uploaded + text_extracted + facts_extracted → one "Document added" item)
 *   3. Apply deterministic title/summary templates for all known event types
 *   4. Enrich with file/analysis context from EntityFile[] and AnalysisSnapshot[]
 *
 * AI generation is NOT called on every render. Instead, richer summaries are
 * stored in event metadata_json.display_summary when events are written
 * (see entityEventService). This service reads those cached values when present
 * and falls back to deterministic templates otherwise.
 */

import type { EntityEvent, EntityFile, AnalysisSnapshot } from "@/types/entity";

// ─── Timeline item type ───────────────────────────────────────────────────────

export type TimelineIconType =
  | "file"
  | "note"
  | "audio"
  | "image"
  | "pdf"
  | "spreadsheet"
  | "analysis"
  | "fact"
  | "status"
  | "pass"
  | "processing"
  | "check";

export type TimelineItem = {
  id: string;
  icon: TimelineIconType;
  title: string;
  summary: string;
  timestamp: string;
  /** IDs of the raw events that were merged into this item */
  sourceEventIds: string[];
  /** If set, clicking this item should open the file detail for this file ID */
  fileId?: string;
  /** If set, clicking opens the analysis section */
  analysisType?: string;
  /** Extra context for display */
  metadata?: Record<string, unknown>;
  /** If this is a conflict event, structured conflict data for the conflict modal */
  conflictData?: {
    factLabel: string;
    existingValue: string;
    newValue: string;
    factDefinitionId?: string;
    snippet?: string;
  };
};

// ─── Event grouping window (ms) ───────────────────────────────────────────────

// Events within this window that share the same file_id are merged into one item
const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─── Icon mapping ─────────────────────────────────────────────────────────────

function iconForMime(mimeType: string | null, fileName: string): TimelineIconType {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType ?? "";
  if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) return "audio";
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls","xlsx","csv"].includes(ext)) return "spreadsheet";
  if (["doc","docx"].includes(ext)) return "file";
  return "file";
}

function iconForEvent(event: EntityEvent, file?: EntityFile): TimelineIconType {
  switch (event.event_type) {
    case "file_uploaded":
      if (file) return iconForMime(file.mime_type, file.file_name);
      return "file";
    case "text_extracted":
    case "ocr_completed":
      return "processing";
    case "transcript_completed":
      return "audio";
    case "facts_extracted":
    case "fact_updated":
    case "fact_conflict_detected":
    case "fact_manually_edited":
    case "fact_manually_confirmed":
    case "manual_override_applied":
      return "fact";
    case "triage_completed":
    case "initial_review_completed":
    case "deep_analysis_completed":
    case "deep_scan_completed":
      return "analysis";
    case "analysis_refreshed":
      // Show as "check" (score updated) when it carries a score, otherwise "analysis"
      return event.metadata_json?.overall_score !== undefined ? "check" : "analysis";
    case "deep_analysis_started":
    case "deep_scan_started":
      return "processing";
    case "entity_passed":
      return "pass";
    case "entity_archived":
      return "status";
    case "nda_detected":
    case "nda_marked_signed":
    case "nda_status_updated":
      return "check";
    default:
      return "check";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clean display name for a file: prefer AI title, strip extension, cap length */
function displayFileName(file: EntityFile): string {
  const raw = file.title ?? file.file_name;
  // Strip extension for cleaner display
  const stripped = raw.replace(/\.[^.]+$/, "").trim() || raw;
  return stripped.length > 40 ? stripped.slice(0, 38) + "…" : stripped;
}

// ─── Deterministic title templates ───────────────────────────────────────────

function titleForEvent(event: EntityEvent, file?: EntityFile): string {
  const name = file ? displayFileName(file) : ((event.metadata_json?.file_name as string | undefined) ?? "File");

  switch (event.event_type) {
    case "file_uploaded": {
      const mime = file?.mime_type ?? "";
      const ext = (file?.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
      if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) return name;
      if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) return name;
      if (file?.source_type === "pasted_text") return name;
      return name;
    }
    case "text_extracted":
      return file ? `${displayFileName(file)} — text extracted` : "Text extracted";
    case "ocr_completed":
      return file ? `${displayFileName(file)} — OCR completed` : "OCR completed";
    case "transcript_completed":
      return file ? `${displayFileName(file)} — transcribed` : "Transcript created";
    case "facts_extracted": {
      const count = event.metadata_json?.facts_found as number | undefined;
      return count ? `${count} facts extracted` : "Facts extracted";
    }
    case "fact_updated": {
      const label = event.metadata_json?.fact_label as string | undefined;
      const newVal = event.metadata_json?.new_value as string | undefined;
      if (label && newVal) return `${label} updated to ${newVal}`;
      if (label) return `${label} updated`;
      return "Fact updated";
    }
    case "fact_manually_edited": {
      const label = event.metadata_json?.fact_label as string | undefined;
      return label ? `${label} edited` : "Fact edited";
    }
    case "fact_manually_confirmed": {
      const label = event.metadata_json?.fact_label as string | undefined;
      return label ? `${label} confirmed` : "Fact confirmed";
    }
    case "fact_conflict_detected": {
      const label = event.metadata_json?.fact_label as string | undefined;
      return label ? `Conflict: ${label}` : "Fact conflict detected";
    }
    case "manual_override_applied":
      return "Manual override applied";
    case "triage_completed":
    case "initial_review_completed":
      return "Initial review generated";
    case "deep_analysis_started":
    case "deep_scan_started":
      return "Deep analysis started";
    case "deep_analysis_completed":
    case "deep_scan_completed":
      return "Deep analysis completed";
    case "analysis_refreshed": {
      const score = event.metadata_json?.overall_score as number | undefined;
      return score !== null && score !== undefined
        ? `Score updated — ${score.toFixed(1)}/10`
        : "Analysis refreshed";
    }
    case "entity_passed":
      return "Deal passed";
    case "entity_archived":
      return "Deal archived";
    case "nda_detected": {
      const signed = event.metadata_json?.signed as boolean | undefined;
      const confidence = event.metadata_json?.confidence as number | undefined;
      if (signed) return "NDA marked as signed";
      if (confidence !== undefined && confidence > 0) return "NDA uploaded — review needed";
      return "NDA detected";
    }
    case "nda_marked_signed":
      return "NDA marked as signed";
    case "nda_status_updated": {
      const source = event.metadata_json?.source as string | undefined;
      return source === "manual" || source === "override"
        ? "NDA status manually updated"
        : "NDA status updated";
    }
    default:
      return name;
  }
}

// ─── Deterministic summary templates ─────────────────────────────────────────

function summaryForEvent(event: EntityEvent, file?: EntityFile): string {
  // Use cached AI-generated summary if present (written by entityFileService after processing)
  const cached = event.metadata_json?.display_summary as string | undefined;
  if (cached) return cached;

  // Use the file's own AI summary if available — this is the richest signal
  if (file?.summary) return file.summary;

  const ext = (file?.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
  const mime = file?.mime_type ?? "";

  switch (event.event_type) {
    case "file_uploaded": {
      if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext))
        return `Audio recording added — queued for transcription.`;
      if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext))
        return `Photo added — queued for AI analysis.`;
      if (ext === "pdf")
        return `PDF uploaded — queued for text extraction.`;
      if (["xls","xlsx","csv"].includes(ext))
        return `Spreadsheet uploaded — queued for processing.`;
      if (file?.source_type === "pasted_text")
        return `Note added — queued for fact extraction.`;
      return `File uploaded — queued for processing.`;
    }
    case "text_extracted": {
      const chunks = event.metadata_json?.chunk_count as number | undefined;
      return chunks
        ? `Text extracted and split into ${chunks} searchable chunks.`
        : `Text extracted and indexed for analysis.`;
    }
    case "ocr_completed":
      return `Image text extracted via OCR.`;
    case "transcript_completed":
      return `Audio transcribed — text is now searchable.`;
    case "facts_extracted": {
      const found = event.metadata_json?.facts_found as number | undefined;
      const inserted = event.metadata_json?.facts_inserted as number | undefined;
      const updated = event.metadata_json?.facts_updated as number | undefined;
      if (found && (inserted || updated)) {
        const parts = [];
        if (inserted) parts.push(`${inserted} new`);
        if (updated) parts.push(`${updated} updated`);
        return `${found} facts found — ${parts.join(", ")} stored.`;
      }
      return `Key deal facts extracted and stored.`;
    }
    case "fact_updated": {
      const oldVal = event.metadata_json?.old_value as string | undefined;
      const newVal = event.metadata_json?.new_value as string | undefined;
      const snippet = event.metadata_json?.snippet as string | undefined;
      if (oldVal && newVal) return `Changed from ${oldVal} to ${newVal}.${snippet ? ` Source: "${snippet.slice(0, 60)}…"` : ""}`;
      return `A deal fact was updated based on new evidence.`;
    }
    case "fact_manually_edited": {
      const oldVal = event.metadata_json?.old_value as string | undefined;
      const newVal = event.metadata_json?.new_value as string | undefined;
      if (oldVal && newVal) return `Changed from ${oldVal} to ${newVal}.`;
      return `A deal fact was manually edited.`;
    }
    case "fact_manually_confirmed":
      return `A deal fact was reviewed and confirmed.`;
    case "fact_conflict_detected": {
      const existing = event.metadata_json?.existing_value as string | undefined;
      const incoming = event.metadata_json?.new_value as string | undefined;
      if (existing && incoming) return `Existing value ${existing} conflicts with new evidence ${incoming} — review needed.`;
      return `Conflicting evidence found — review needed in Facts tab.`;
    }
    case "manual_override_applied":
      return `A fact value was manually overridden.`;
    case "triage_completed":
    case "initial_review_completed":
      return `AI generated an initial review based on current inputs.`;
    case "deep_analysis_started":
    case "deep_scan_started":
      return `Deep analysis triggered and running.`;
    case "deep_analysis_completed":
    case "deep_scan_completed":
      return `Deep analysis complete — executive summary, risks, and valuation support available.`;
    case "analysis_refreshed": {
      const score = event.metadata_json?.overall_score as number | undefined;
      const conf = event.metadata_json?.confidence_score as number | undefined;
      const facts = event.metadata_json?.facts_used as number | undefined;
      const trigger = event.metadata_json?.trigger_reason as string | undefined;
      if (score !== null && score !== undefined) {
        const parts: string[] = [`Deal score: ${score.toFixed(1)}/10`];
        if (conf !== undefined) parts.push(`confidence ${conf}%`);
        if (facts !== undefined) parts.push(`${facts} facts used`);
        if (trigger) parts.push(`triggered by: ${trigger}`);
        return parts.join(" · ") + ".";
      }
      return `Analysis refreshed after new information was added.`;
    }
    case "entity_passed":
      return `Deal marked as passed.`;
    case "entity_archived":
      return `Deal archived.`;
    case "nda_detected": {
      const signed = event.metadata_json?.signed as boolean | undefined;
      const confidence = event.metadata_json?.confidence as number | undefined;
      const notes = event.metadata_json?.notes as string | undefined;
      if (signed) return notes ?? "A signed NDA was detected in the uploaded file.";
      if (confidence !== undefined && confidence > 0)
        return notes ?? "An NDA was detected but signature confidence is low — review needed.";
      return notes ?? "An NDA document was detected.";
    }
    case "nda_marked_signed": {
      const source = event.metadata_json?.source as string | undefined;
      return source === "manual" || source === "override"
        ? "NDA manually confirmed as signed."
        : "NDA marked as signed.";
    }
    case "nda_status_updated": {
      const signed = event.metadata_json?.signed as boolean | undefined;
      const source = event.metadata_json?.source as string | undefined;
      if (source === "manual" || source === "override") {
        return signed ? "NDA manually marked as signed." : "NDA manually marked as not signed.";
      }
      return "NDA status updated.";
    }
    default:
      return `Activity recorded.`;
  }
}

// ─── Group icon for merged items ──────────────────────────────────────────────

function iconForGroup(events: EntityEvent[], file?: EntityFile): TimelineIconType {
  // Prefer the file-upload event's icon for the group
  const uploadEvent = events.find((e) => e.event_type === "file_uploaded");
  if (uploadEvent) return iconForEvent(uploadEvent, file);
  return iconForEvent(events[0], file);
}

function titleForGroup(events: EntityEvent[], file?: EntityFile): string {
  const hasUpload = events.some((e) => e.event_type === "file_uploaded");
  const hasTranscript = events.some((e) => e.event_type === "transcript_completed");
  const hasOcr = events.some((e) => e.event_type === "ocr_completed");
  const hasFacts = events.some((e) => e.event_type === "facts_extracted");

  if (hasUpload && file) {
    const name = displayFileName(file);
    const mime = file.mime_type ?? "";
    const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "";
    if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext))
      return hasTranscript ? `${name} — transcribed` : name;
    if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext))
      return hasOcr ? `${name} — processed` : name;
    if (file.source_type === "pasted_text") return hasFacts ? `${name} — analyzed` : name;
    return hasFacts ? `${name} — analyzed` : name;
  }

  return titleForEvent(events[0], file);
}

function summaryForGroup(events: EntityEvent[], file?: EntityFile): string {
  // Prefer cached AI summary from the most significant event
  for (const e of events) {
    const cached = e.metadata_json?.display_summary as string | undefined;
    if (cached) return cached;
  }

  // Use the file's own AI-generated summary — this is the richest signal
  if (file?.summary) return file.summary;

  const hasUpload = events.some((e) => e.event_type === "file_uploaded");
  const hasTranscript = events.some((e) => e.event_type === "transcript_completed");
  const hasOcr = events.some((e) => e.event_type === "ocr_completed");
  const hasText = events.some((e) => e.event_type === "text_extracted");
  const hasFacts = events.some((e) => e.event_type === "facts_extracted");
  const factsEvent = events.find((e) => e.event_type === "facts_extracted");
  const factsFound = factsEvent?.metadata_json?.facts_found as number | undefined;

  if (hasUpload && file) {
    const mime = file.mime_type ?? "";
    const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "";

    if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) {
      return hasTranscript
        ? `Transcribed — text is now searchable.`
        : `Audio recording added and queued for transcription.`;
    }
    if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) {
      return hasOcr
        ? `Photo processed — text extracted via OCR.`
        : `Photo added and queued for AI analysis.`;
    }
    if (file.source_type === "pasted_text") {
      return hasFacts && factsFound
        ? `Note added — ${factsFound} deal facts extracted.`
        : `Note added and indexed for analysis.`;
    }

    const parts: string[] = ["Uploaded"];
    if (hasText) parts.push("text extracted");
    if (hasFacts && factsFound) parts.push(`${factsFound} facts found`);
    return parts.join(", ") + ".";
  }

  return summaryForEvent(events[0], file);
}

// ─── Main assembly function ───────────────────────────────────────────────────

export function assembleTimeline(
  events: EntityEvent[],
  files: EntityFile[],
  snapshots: AnalysisSnapshot[]
): TimelineItem[] {
  if (events.length === 0) return [];

  // Build a file lookup map
  const fileMap = new Map<string, EntityFile>(files.map((f) => [f.id, f]));

  // Sort events newest-first
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Group events that share the same file_id and are within GROUP_WINDOW_MS of each other
  const groups: EntityEvent[][] = [];
  const used = new Set<string>();

  for (const event of sorted) {
    if (used.has(event.id)) continue;

    // Start a new group
    const group: EntityEvent[] = [event];
    used.add(event.id);

    // Only group file-related events that share the same file_id
    if (event.file_id) {
      const eventTime = new Date(event.created_at).getTime();
      for (const other of sorted) {
        if (used.has(other.id)) continue;
        if (other.file_id !== event.file_id) continue;
        const otherTime = new Date(other.created_at).getTime();
        if (Math.abs(eventTime - otherTime) <= GROUP_WINDOW_MS) {
          group.push(other);
          used.add(other.id);
        }
      }
    }

    groups.push(group);
  }

  // Convert groups to timeline items
  const items: TimelineItem[] = groups.map((group) => {
    const primary = group[0];
    const file = primary.file_id ? fileMap.get(primary.file_id) : undefined;

    const isSingle = group.length === 1;
    const title = isSingle ? titleForEvent(primary, file) : titleForGroup(group, file);
    const summary = isSingle ? summaryForEvent(primary, file) : summaryForGroup(group, file);
    const icon = isSingle ? iconForEvent(primary, file) : iconForGroup(group, file);

    // Determine click target
    let fileId: string | undefined;
    let analysisType: string | undefined;

    if (primary.file_id && file) {
      fileId = file.id;
    } else if (primary.metadata_json?.source_file_id) {
      // Fact events may store the originating file_id in metadata
      const metaFileId = primary.metadata_json.source_file_id as string;
      if (fileMap.has(metaFileId)) fileId = metaFileId;
    } else if (
      primary.event_type === "triage_completed" ||
      primary.event_type === "initial_review_completed"
    ) {
      analysisType = "triage_summary";
    } else if (
      primary.event_type === "deep_analysis_completed" ||
      primary.event_type === "deep_scan_completed"
    ) {
      analysisType = "deep_analysis";
    }

    // Conflict data for fact_conflict_detected events
    let conflictData: TimelineItem["conflictData"];
    if (primary.event_type === "fact_conflict_detected") {
      const m = primary.metadata_json ?? {};
      const existingVal = m.existing_value as string | undefined;
      const newVal = m.new_value as string | undefined;
      const factLabel = m.fact_label as string | undefined;
      if (existingVal && newVal && factLabel) {
        conflictData = {
          factLabel,
          existingValue: existingVal,
          newValue: newVal,
          factDefinitionId: primary.fact_definition_id ?? undefined,
          snippet: m.snippet as string | undefined,
        };
      }
    }

    return {
      id: primary.id,
      icon,
      title,
      summary,
      timestamp: primary.created_at,
      sourceEventIds: group.map((e) => e.id),
      fileId,
      analysisType,
      metadata: primary.metadata_json,
      conflictData,
    };
  });

  return items;
}
