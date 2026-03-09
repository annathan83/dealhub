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
    case "analysis_refreshed":
      return "analysis";
    case "deep_analysis_started":
    case "deep_scan_started":
      return "processing";
    case "entity_passed":
      return "pass";
    case "entity_archived":
      return "status";
    default:
      return "check";
  }
}

// ─── Deterministic title templates ───────────────────────────────────────────

function titleForEvent(event: EntityEvent, file?: EntityFile): string {
  const fileName = file?.title ?? file?.file_name ?? (event.metadata_json?.file_name as string | undefined) ?? "File";
  const shortName = fileName.length > 40 ? fileName.slice(0, 38) + "…" : fileName;

  switch (event.event_type) {
    case "file_uploaded": {
      const mime = file?.mime_type ?? "";
      const ext = (file?.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
      if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) return "Audio added";
      if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) return "Photo added";
      if (ext === "pdf") return "PDF uploaded";
      if (["xls","xlsx","csv"].includes(ext)) return "Spreadsheet uploaded";
      if (["doc","docx"].includes(ext)) return "Document uploaded";
      if (file?.source_type === "pasted_text") return "Note added";
      return "File uploaded";
    }
    case "text_extracted":
      return "Text extracted";
    case "ocr_completed":
      return "OCR completed";
    case "transcript_completed":
      return "Transcript created";
    case "facts_extracted": {
      const count = event.metadata_json?.facts_found as number | undefined;
      return count ? `${count} facts extracted` : "Facts extracted";
    }
    case "fact_updated":
      return "Fact updated";
    case "fact_manually_edited":
      return "Fact edited";
    case "fact_manually_confirmed":
      return "Fact confirmed";
    case "fact_conflict_detected":
      return "Fact conflict detected";
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
    case "analysis_refreshed":
      return "Analysis refreshed";
    case "entity_passed":
      return "Deal passed";
    case "entity_archived":
      return "Deal archived";
    default:
      return shortName;
  }
}

// ─── Deterministic summary templates ─────────────────────────────────────────

function summaryForEvent(event: EntityEvent, file?: EntityFile): string {
  // Use cached AI-generated summary if present
  const cached = event.metadata_json?.display_summary as string | undefined;
  if (cached) return cached;

  const fileName = file?.title ?? file?.file_name ?? "the file";
  const shortName = fileName.length > 50 ? fileName.slice(0, 48) + "…" : fileName;

  switch (event.event_type) {
    case "file_uploaded": {
      const mime = file?.mime_type ?? "";
      const ext = (file?.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
      if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext))
        return `Audio recording was added and queued for transcription.`;
      if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext))
        return `Photo was added and queued for AI analysis.`;
      if (ext === "pdf")
        return `PDF "${shortName}" was uploaded and queued for text extraction.`;
      if (["xls","xlsx","csv"].includes(ext))
        return `Spreadsheet "${shortName}" was uploaded and queued for processing.`;
      if (file?.source_type === "pasted_text")
        return `Text note was added and queued for fact extraction.`;
      return `"${shortName}" was uploaded and queued for processing.`;
    }
    case "text_extracted": {
      const chunks = event.metadata_json?.chunk_count as number | undefined;
      return chunks
        ? `Text was extracted and split into ${chunks} searchable chunks.`
        : `Text was extracted and indexed for analysis.`;
    }
    case "ocr_completed":
      return `Image text was extracted via OCR and added to the searchable record.`;
    case "transcript_completed":
      return `Audio was transcribed and the text was added to the searchable record.`;
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
      return `Key deal facts were extracted and stored.`;
    }
    case "fact_updated":
      return `A deal fact was updated based on new evidence.`;
    case "fact_manually_edited":
      return `A deal fact was manually edited.`;
    case "fact_manually_confirmed":
      return `A deal fact was reviewed and confirmed.`;
    case "fact_conflict_detected":
      return `Conflicting evidence was found for a deal fact — review recommended.`;
    case "manual_override_applied":
      return `A fact value was manually overridden.`;
    case "triage_completed":
    case "initial_review_completed":
      return `AI generated an initial review based on the current inputs.`;
    case "deep_analysis_started":
    case "deep_scan_started":
      return `Deep analysis was triggered and is running.`;
    case "deep_analysis_completed":
    case "deep_scan_completed":
      return `Deep analysis completed — executive summary, risks, and valuation support are available.`;
    case "analysis_refreshed":
      return `Analysis was refreshed after new information was added.`;
    case "entity_passed":
      return `This deal was marked as passed and moved to the archive.`;
    case "entity_archived":
      return `This deal was archived.`;
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
    const mime = file.mime_type ?? "";
    const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "";
    if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext))
      return hasTranscript ? "Audio transcribed" : "Audio added";
    if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext))
      return hasOcr ? "Photo processed" : "Photo added";
    if (file.source_type === "pasted_text") return hasFacts ? "Note analyzed" : "Note added";
    return hasFacts ? "Document analyzed" : "Document added";
  }

  return titleForEvent(events[0], file);
}

function summaryForGroup(events: EntityEvent[], file?: EntityFile): string {
  // Use cached AI summary from the most significant event if available
  for (const e of events) {
    const cached = e.metadata_json?.display_summary as string | undefined;
    if (cached) return cached;
  }

  const hasUpload = events.some((e) => e.event_type === "file_uploaded");
  const hasTranscript = events.some((e) => e.event_type === "transcript_completed");
  const hasOcr = events.some((e) => e.event_type === "ocr_completed");
  const hasText = events.some((e) => e.event_type === "text_extracted");
  const hasFacts = events.some((e) => e.event_type === "facts_extracted");
  const factsEvent = events.find((e) => e.event_type === "facts_extracted");
  const factsFound = factsEvent?.metadata_json?.facts_found as number | undefined;

  const fileName = file?.title ?? file?.file_name ?? "File";
  const shortName = fileName.length > 50 ? fileName.slice(0, 48) + "…" : fileName;

  if (hasUpload && file) {
    const mime = file.mime_type ?? "";
    const ext = file.file_name.split(".").pop()?.toLowerCase() ?? "";

    if (mime.startsWith("audio/") || ["mp3","m4a","wav","webm","ogg","aac"].includes(ext)) {
      return hasTranscript
        ? `Recording was uploaded and transcribed — text is now searchable.`
        : `Audio recording "${shortName}" was added and is being processed.`;
    }
    if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp"].includes(ext)) {
      return hasOcr
        ? `Photo was uploaded and text was extracted via OCR.`
        : `Photo "${shortName}" was added and analyzed by AI.`;
    }
    if (file.source_type === "pasted_text") {
      return hasFacts && factsFound
        ? `Note was added and ${factsFound} deal facts were extracted.`
        : `Text note was added and indexed for analysis.`;
    }

    const parts: string[] = [`"${shortName}" was uploaded`];
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
    };
  });

  return items;
}
