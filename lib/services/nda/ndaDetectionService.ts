/**
 * ndaDetectionService
 *
 * Classifies whether an uploaded file is likely an NDA and whether it appears
 * to be signed. Returns a structured result that the upload pipeline uses to
 * update the deal's NDA milestone fields.
 *
 * Detection is purely heuristic (filename + extracted text). No extra AI call
 * is made — we use the text already extracted during the normal ingest pipeline.
 */

export type NdaDetectionResult = {
  /** Is this file likely an NDA document? */
  isNda: boolean;
  /** Is the NDA likely signed? Only meaningful when isNda is true. */
  isSigned: boolean;
  /** Confidence 0–1 for the signed determination */
  confidence: number;
  /** Human-readable notes about what was detected */
  notes: string;
};

// ─── Filename clues ───────────────────────────────────────────────────────────

const NDA_FILENAME_PATTERNS = [
  /\bnda\b/i,
  /non[\s_-]?disclosure/i,
  /confidentiality[\s_-]?agreement/i,
  /signed[\s_-]?nda/i,
  /executed[\s_-]?nda/i,
  /nda[\s_-]?signed/i,
  /nda[\s_-]?executed/i,
];

// ─── Text content clues: NDA document ─────────────────────────────────────────

const NDA_CONTENT_PATTERNS = [
  /non[\s-]?disclosure\s+agreement/i,
  /confidentiality\s+agreement/i,
  /mutual\s+nda/i,
  /one[\s-]?way\s+nda/i,
  /\bnda\b.{0,40}(agreement|form|template)/i,
  /agree\s+to\s+keep.{0,60}confidential/i,
  /shall\s+not\s+disclose/i,
  /confidential\s+information.{0,60}shall/i,
];

// ─── Signed clues ─────────────────────────────────────────────────────────────

const SIGNED_STRONG_PATTERNS = [
  // E-signature platforms
  /docusign/i,
  /adobe\s+sign/i,
  /hellosign/i,
  /pandadoc/i,
  /signnow/i,
  /envelope\s+id[:.\s]/i,
  /electronically\s+signed/i,
  /digital\s+signature/i,
  /audit\s+trail/i,
  /certificate\s+of\s+completion/i,
  /signing\s+certificate/i,
];

const SIGNED_MODERATE_PATTERNS = [
  /^signature[:.\s]/im,
  /^signed[:.\s]/im,
  /^executed\s+by[:.\s]/im,
  /^signed\s+by[:.\s]/im,
  /^authorized\s+signature[:.\s]/im,
  /\/s\/\s+\w/,           // /s/ John Doe style e-sig
  /\[signature\]/i,
  /date\s+signed[:.\s]/i,
];

// ─── Unsigned / blank template clues ─────────────────────────────────────────

const UNSIGNED_PATTERNS = [
  /\[your\s+name\]/i,
  /\[company\s+name\]/i,
  /\[date\]/i,
  /\[signature\s+here\]/i,
  /\[print\s+name\]/i,
  /fill\s+in\s+the\s+blank/i,
  /sample\s+nda/i,
  /template\s+nda/i,
  /nda\s+template/i,
];

// ─── Main detection function ──────────────────────────────────────────────────

export function detectNda(
  fileName: string,
  extractedText: string | null
): NdaDetectionResult {
  const textToCheck = extractedText ?? "";

  // 1. Is it an NDA?
  const filenameIsNda = NDA_FILENAME_PATTERNS.some((p) => p.test(fileName));
  const contentIsNda  = NDA_CONTENT_PATTERNS.some((p) => p.test(textToCheck));
  const isNda = filenameIsNda || contentIsNda;

  if (!isNda) {
    return { isNda: false, isSigned: false, confidence: 0, notes: "Not identified as an NDA" };
  }

  // 2. Check for blank template signals — if found, not signed
  const looksBlank = UNSIGNED_PATTERNS.some((p) => p.test(textToCheck));
  if (looksBlank) {
    return {
      isNda: true,
      isSigned: false,
      confidence: 0.85,
      notes: "Identified as NDA template/blank — no signature detected",
    };
  }

  // 3. Score signature evidence
  const strongHits  = SIGNED_STRONG_PATTERNS.filter((p) => p.test(textToCheck));
  const moderateHits = SIGNED_MODERATE_PATTERNS.filter((p) => p.test(textToCheck));

  const signatureScore = strongHits.length * 0.4 + moderateHits.length * 0.2;

  // Filename bonus: "signed nda" or "executed nda" in filename
  const filenameSigned = /signed|executed/i.test(fileName) && filenameIsNda;
  const adjustedScore  = signatureScore + (filenameSigned ? 0.3 : 0);

  const confidence = Math.min(1, adjustedScore);

  if (confidence >= 0.7) {
    const sources = [
      ...strongHits.map((p) => p.source.slice(1, 20)),
      ...moderateHits.map((p) => p.source.slice(1, 20)),
    ].slice(0, 3);
    return {
      isNda: true,
      isSigned: true,
      confidence,
      notes: `NDA detected as signed (confidence ${(confidence * 100).toFixed(0)}%). Signals: ${sources.join(", ")}`,
    };
  }

  if (confidence > 0) {
    return {
      isNda: true,
      isSigned: false,
      confidence,
      notes: `NDA detected but signature confidence too low (${(confidence * 100).toFixed(0)}%) — review needed`,
    };
  }

  return {
    isNda: true,
    isSigned: false,
    confidence: 0,
    notes: "NDA detected but no signature indicators found — likely unsigned template",
  };
}
