/**
 * NDA detection unit tests — pure Node.js, no test runner needed.
 *
 * Run with: node tests/unit/ndaDetection.test.mjs
 *
 * Uses a compiled-on-the-fly approach via tsx:
 *   npx tsx tests/unit/ndaDetection.test.mjs
 */

// ─── Inline the detection logic (copy of ndaDetectionService.ts) ─────────────
// This avoids needing a TypeScript transpiler for a simple smoke test.

const NDA_FILENAME_PATTERNS = [
  /\bnda\b/i,
  /non[\s_-]?disclosure/i,
  /confidentiality[\s_-]?agreement/i,
  /signed[\s_-]?nda/i,
  /executed[\s_-]?nda/i,
  /nda[\s_-]?signed/i,
  /nda[\s_-]?executed/i,
];

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

const SIGNED_STRONG_PATTERNS = [
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
  /\/s\/\s+\w/,
  /\[signature\]/i,
  /date\s+signed[:.\s]/i,
];

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

function detectNda(fileName, extractedText) {
  const textToCheck = extractedText ?? "";
  const filenameIsNda = NDA_FILENAME_PATTERNS.some((p) => p.test(fileName));
  const contentIsNda  = NDA_CONTENT_PATTERNS.some((p) => p.test(textToCheck));
  const isNda = filenameIsNda || contentIsNda;

  if (!isNda) return { isNda: false, isSigned: false, confidence: 0, notes: "Not identified as an NDA" };

  const looksBlank = UNSIGNED_PATTERNS.some((p) => p.test(textToCheck));
  if (looksBlank) return { isNda: true, isSigned: false, confidence: 0.85, notes: "NDA template/blank" };

  const strongHits   = SIGNED_STRONG_PATTERNS.filter((p) => p.test(textToCheck));
  const moderateHits = SIGNED_MODERATE_PATTERNS.filter((p) => p.test(textToCheck));
  const signatureScore = strongHits.length * 0.4 + moderateHits.length * 0.2;
  const filenameSigned = /signed|executed/i.test(fileName) && filenameIsNda;
  const confidence = Math.min(1, signatureScore + (filenameSigned ? 0.3 : 0));

  if (confidence >= 0.7) return { isNda: true, isSigned: true, confidence, notes: `Signed (${(confidence*100).toFixed(0)}%)` };
  if (confidence > 0)    return { isNda: true, isSigned: false, confidence, notes: `NDA detected, low confidence (${(confidence*100).toFixed(0)}%)` };
  return { isNda: true, isSigned: false, confidence: 0, notes: "NDA detected, no signature indicators" };
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThanOrEqual: (n) => {
      if (actual < n) throw new Error(`Expected ${actual} >= ${n}`);
    },
    toBeLessThan: (n) => {
      if (actual >= n) throw new Error(`Expected ${actual} < ${n}`);
    },
    toBeGreaterThanOrEqual: (n) => {
      if (actual < n) throw new Error(`Expected ${actual} >= ${n}`);
    },
    toBeLessThanOrEqual: (n) => {
      if (actual > n) throw new Error(`Expected ${actual} <= ${n}`);
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\nNDA Detection Service Tests\n");

test("returns isNda=false for a generic P&L file", () => {
  const r = detectNda("profit-and-loss-2024.pdf", "Revenue: $500,000\nExpenses: $300,000");
  expect(r.isNda).toBe(false);
  expect(r.isSigned).toBe(false);
});

test("detects NDA from filename 'nda.pdf'", () => {
  const r = detectNda("nda.pdf", null);
  expect(r.isNda).toBe(true);
});

test("detects NDA from filename 'signed_nda.pdf'", () => {
  const r = detectNda("signed_nda.pdf", null);
  expect(r.isNda).toBe(true);
});

test("detects NDA from filename 'Non-Disclosure Agreement.docx'", () => {
  const r = detectNda("Non-Disclosure Agreement.docx", null);
  expect(r.isNda).toBe(true);
});

test("detects NDA from content 'Non-Disclosure Agreement'", () => {
  const r = detectNda("document.pdf", "This Non-Disclosure Agreement is entered into between the parties.");
  expect(r.isNda).toBe(true);
});

test("detects NDA from content 'shall not disclose'", () => {
  const r = detectNda("agreement.pdf", "The receiving party shall not disclose any confidential information.");
  expect(r.isNda).toBe(true);
});

test("marks as NOT signed when content has [Your Name] placeholder", () => {
  const r = detectNda("nda.pdf", "Non-Disclosure Agreement\n\nSigned by: [Your Name]\nDate: [Date]");
  expect(r.isNda).toBe(true);
  expect(r.isSigned).toBe(false);
});

test("marks as NOT signed for NDA template content", () => {
  const r = detectNda("nda_template.pdf", "This is a sample NDA template. Fill in the blank fields.");
  expect(r.isNda).toBe(true);
  expect(r.isSigned).toBe(false);
});

test("marks as SIGNED when DocuSign is mentioned", () => {
  const r = detectNda("nda.pdf", "Non-Disclosure Agreement\n\nThis document was signed via DocuSign.\nEnvelope ID: abc-123");
  expect(r.isNda).toBe(true);
  expect(r.isSigned).toBe(true);
  expect(r.confidence).toBeGreaterThanOrEqual(0.7);
});

test("marks as SIGNED when 'Electronically signed' + audit trail present", () => {
  const r = detectNda("nda.pdf", "Non-Disclosure Agreement\n\nElectronically signed by John Doe.\nAudit trail attached.");
  expect(r.isNda).toBe(true);
  expect(r.isSigned).toBe(true);
  expect(r.confidence).toBeGreaterThanOrEqual(0.7);
});

test("marks as SIGNED when filename says 'signed nda' and has signature line", () => {
  const r = detectNda("signed_nda.pdf", "Non-Disclosure Agreement\n\nSignature: John Smith\nDate Signed: January 15, 2024");
  expect(r.isNda).toBe(true);
  expect(r.isSigned).toBe(true);
});

test("unsigned NDA (no signature signals) leaves isSigned=false", () => {
  const r = detectNda("nda.pdf", "Non-Disclosure Agreement between Party A and Party B. All terms apply.");
  expect(r.isNda).toBe(true);
  expect(r.isSigned).toBe(false);
});

test("confidence is always between 0 and 1", () => {
  const cases = [
    detectNda("nda.pdf", null),
    detectNda("nda.pdf", "Non-Disclosure Agreement. DocuSign. Electronically signed. Audit trail. Envelope ID: 123."),
    detectNda("document.pdf", "Revenue report Q4"),
  ];
  for (const r of cases) {
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
