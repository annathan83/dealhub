/**
 * analysisContextBuilder
 *
 * Assembles the context object passed to the deep analysis AI.
 * Priority order:
 *   1. Structured facts (entity_fact_values + fact_definitions)
 *   2. Normalized extracted text (file_text.full_text, status = 'done')
 *   3. Document metadata (file names, types, upload dates)
 *
 * Never reads raw file blobs, audio, or images.
 * Text corpus is capped to avoid excessive token usage.
 * Duplicate text is deduplicated by content hash before sending.
 */

import {
  getCurrentFactsForEntity,
  getFactDefinitionsForEntityType,
  getFileTextsWithMetaForEntity,
} from "@/lib/db/entities";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceTextItem = {
  file_id: string;
  file_name: string;
  source_type: string | null;
  uploaded_at: string;
  text: string;
  char_count: number;
};

export type AnalysisContext = {
  entity_title: string;
  facts_context: string;
  text_corpus: string;
  source_metadata: string;
  facts_found: number;
  facts_missing_critical: number;
  source_count: number;
  total_text_chars: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CORPUS_CHARS = 20_000;
const MAX_CHARS_PER_FILE = 6_000;

// Human-readable labels for source_type values stored in entity_files
const SOURCE_TYPE_LABELS: Record<string, string> = {
  pasted_text:        "Pasted text",
  listing:            "Listing",
  broker_email:       "Broker email",
  financial_summary:  "Financial summary",
  pdf:                "PDF document",
  spreadsheet:        "Spreadsheet",
  word_doc:           "Word document",
  image:              "Image (OCR)",
  audio:              "Audio transcript",
  unknown:            "Document",
};

function sourceTypeLabel(raw: string | null): string {
  if (!raw) return "Document";
  return SOURCE_TYPE_LABELS[raw] ?? raw.replace(/_/g, " ");
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Simple content fingerprint: first 200 chars normalised.
 * Prevents sending the same pasted text twice if it was ingested multiple times.
 */
function contentFingerprint(text: string): string {
  return text.slice(0, 200).toLowerCase().replace(/\s+/g, " ").trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the full analysis context for an entity.
 * Reads from already-stored data only — no AI calls, no file re-uploads.
 */
export async function buildAnalysisContext(
  entityId: string,
  entityTypeId: string,
  entityTitle: string
): Promise<AnalysisContext> {
  const [factValues, factDefs, fileTexts] = await Promise.all([
    getCurrentFactsForEntity(entityId),
    getFactDefinitionsForEntityType(entityTypeId),
    getFileTextsWithMetaForEntity(entityId),
  ]);

  // ── 1. Build facts context ─────────────────────────────────────────────────
  const defById = new Map(factDefs.map((fd) => [fd.id, fd]));
  const factLines: string[] = [];

  for (const val of factValues) {
    if (val.status === "missing") continue;
    const def = defById.get(val.fact_definition_id);
    if (!def) continue;

    const qualifier =
      val.status === "conflicting"             ? " [CONFLICTING — verify with broker]"
      : val.status === "unclear"               ? " [UNCLEAR]"
      : val.status === "estimated"             ? " [ESTIMATED]"
      : val.value_source_type === "user_override" ? " [USER CONFIRMED]"
      : "";

    factLines.push(`${def.label}: ${val.value_raw ?? "unknown"}${qualifier}`);
  }

  // Note missing critical facts explicitly so the AI knows what it doesn't have
  const missingCriticalLabels = factDefs
    .filter((fd) => {
      if (!fd.is_critical) return false;
      const val = factValues.find((v) => v.fact_definition_id === fd.id);
      return !val || val.status === "missing";
    })
    .map((fd) => fd.label);

  const factsMissingCritical = missingCriticalLabels.length;

  if (missingCriticalLabels.length > 0) {
    factLines.push(`\nMissing critical facts: ${missingCriticalLabels.join(", ")}`);
  }

  const factsContext = factLines.length > 0
    ? factLines.join("\n")
    : "No facts extracted yet.";

  // ── 2. Build text corpus ───────────────────────────────────────────────────
  // Sort newest-first so the most recent documents get priority if we hit the cap.
  const sortedTexts = [...fileTexts].sort((a, b) => {
    const ta = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
    const tb = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    return tb - ta;
  });

  const corpusParts: string[] = [];
  let totalChars = 0;
  const sourceMetaLines: string[] = [];
  const seenFingerprints = new Set<string>();

  for (const item of sortedTexts) {
    const uploadDate = item.uploaded_at
      ? new Date(item.uploaded_at).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })
      : "unknown date";

    const typeLabel = sourceTypeLabel(item.source_type);
    sourceMetaLines.push(`- ${item.file_name} (${typeLabel}, ${uploadDate})`);

    if (totalChars >= MAX_CORPUS_CHARS) continue;

    // Deduplicate: skip if we've already included text with the same fingerprint
    const fp = contentFingerprint(item.full_text);
    if (seenFingerprints.has(fp)) continue;
    seenFingerprints.add(fp);

    const available = MAX_CORPUS_CHARS - totalChars;
    const perFileCap = Math.min(available, MAX_CHARS_PER_FILE);
    const excerpt = item.full_text.slice(0, perFileCap);
    const wasTruncated = excerpt.length < item.full_text.length;

    corpusParts.push(
      `=== ${item.file_name} (${typeLabel}) ===\n${excerpt}` +
      (wasTruncated ? "\n[... truncated — full text stored but not shown here ...]" : "")
    );
    totalChars += excerpt.length;
  }

  const textCorpus = corpusParts.length > 0
    ? corpusParts.join("\n\n")
    : "No extracted text available.";

  const sourceMetadata = sourceMetaLines.length > 0
    ? sourceMetaLines.join("\n")
    : "No source documents.";

  return {
    entity_title: entityTitle,
    facts_context: factsContext,
    text_corpus: textCorpus,
    source_metadata: sourceMetadata,
    // facts_found = lines that are actual fact values (not the missing-facts note line)
    facts_found: factLines.filter((l) => !l.startsWith("\n")).length,
    facts_missing_critical: factsMissingCritical,
    source_count: fileTexts.length,
    total_text_chars: totalChars,
  };
}
