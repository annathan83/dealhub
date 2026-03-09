// Server-side only — never import this in client components

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const ACCEPTED_MIME_TYPES: Record<string, string> = {
  "text/plain": "txt",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
};

export const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv"];

export function validateFile(file: { size: number; type: string; name: string }): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large. Maximum size is 100 MB.`;
  }
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const mimeOk = file.type in ACCEPTED_MIME_TYPES;
  const extOk = ACCEPTED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    return `Unsupported file type. Accepted: TXT, PDF, Word (.doc/.docx), Excel (.xls/.xlsx), CSV.`;
  }
  return null;
}

/**
 * Describes why text extraction produced no usable content.
 * Returned as the text value so the AI still receives context about the file.
 */
function noTextNote(reason: string): string {
  return `[Text extraction note: ${reason}]`;
}

/**
 * Extract plain text from a file buffer.
 *
 * Never throws — always returns a string (may be a diagnostic note if extraction
 * fails or produces no content). The caller can pass this directly to the AI as
 * a content preview; the AI will still classify from filename + MIME type.
 *
 * Known challenges handled:
 *  - PDF: scanned/image-only (empty text), password-protected (throws), corrupted (throws)
 *  - DOCX: password-protected (throws), corrupted (throws)
 *  - DOC: binary format mammoth can't parse (falls back to ASCII strip)
 *  - XLSX/XLS: password-protected (throws), corrupted (throws), empty sheets
 *  - CSV: non-UTF-8 encoding (falls back to latin1)
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // ── Plain text ────────────────────────────────────────────────────────────
  if (ext === "txt") {
    const text = buffer.toString("utf-8").trim();
    return text || noTextNote("file appears to be empty");
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (ext === "pdf") {
    try {
      // pdf-parse v1 is a CJS module; cast to any to handle the default export shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = (await import("pdf-parse")) as any;
      const parse = pdfParse.default ?? pdfParse;
      const result = await parse(buffer);
      const text = (result.text ?? "").trim();
      const pageCount: number = result.numpages ?? 0;

      if (!text) {
        // Has pages but no extractable text → scanned / image-only PDF
        if (pageCount > 0) {
          return noTextNote(
            `this appears to be a scanned or image-only PDF (${pageCount} page${pageCount !== 1 ? "s" : ""}, no selectable text). ` +
            `Consider uploading a photo of the key pages instead for AI analysis.`
          );
        }
        return noTextNote("PDF contains no extractable text");
      }

      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Password-protected PDFs throw a specific error
      if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypted")) {
        return noTextNote("PDF is password-protected — remove the password and re-upload");
      }
      console.error(`[extractText] PDF parse failed for "${filename}":`, msg);
      return noTextNote(`PDF could not be parsed (${msg.slice(0, 120)})`);
    }
  }

  // ── Word (.docx) ──────────────────────────────────────────────────────────
  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value ?? "").trim();
      if (!text) {
        return noTextNote("Word document appears to be empty or contains only images/charts");
      }
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypted")) {
        return noTextNote("Word document is password-protected — remove the password and re-upload");
      }
      // Corrupted or not a real .docx (e.g. renamed from something else)
      console.error(`[extractText] DOCX parse failed for "${filename}":`, msg);
      return noTextNote(`Word document could not be parsed — file may be corrupted or not a valid .docx`);
    }
  }

  // ── Word (.doc) — legacy binary format ────────────────────────────────────
  if (ext === "doc") {
    // Mammoth handles some .doc files (those that are actually OOXML in disguise)
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value ?? "").trim();
      if (text) return text;
    } catch {
      // Mammoth can't parse true binary .doc — fall through
    }

    // Last resort: strip binary noise and return printable ASCII characters.
    // This often recovers the body text from old Word 97-2003 files.
    const raw = buffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/ {3,}/g, "  ")
      .trim();

    if (raw.length < 50) {
      // Too little content — likely a binary file with no recoverable text
      return noTextNote(
        ".doc is an old binary Word format that could not be parsed. " +
        "Save as .docx and re-upload for better AI analysis."
      );
    }

    return raw;
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  if (ext === "csv") {
    // Try UTF-8 first, fall back to latin1 for Windows-exported CSVs
    let text = "";
    try {
      text = buffer.toString("utf-8").trim();
      // Detect UTF-8 BOM (Excel sometimes adds it)
      if (text.startsWith("\uFEFF")) text = text.slice(1);
    } catch {
      text = buffer.toString("latin1").trim();
    }
    return text || noTextNote("CSV file appears to be empty");
  }

  // ── Excel (.xlsx / .xls) ──────────────────────────────────────────────────
  if (ext === "xlsx" || ext === "xls") {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });

      if (!workbook.SheetNames.length) {
        return noTextNote("Excel workbook contains no sheets");
      }

      const lines: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        if (csv.trim()) {
          lines.push(`=== Sheet: ${sheetName} ===`);
          lines.push(csv);
        }
      }

      if (!lines.length) {
        return noTextNote("Excel workbook contains only empty sheets");
      }

      return lines.join("\n\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypted")) {
        return noTextNote("Excel file is password-protected — remove the password and re-upload");
      }
      if (ext === "xls") {
        // Old binary .xls sometimes fails — give a specific hint
        console.error(`[extractText] XLS parse failed for "${filename}":`, msg);
        return noTextNote(
          ".xls is an old Excel format that could not be parsed. " +
          "Save as .xlsx and re-upload for better AI analysis."
        );
      }
      console.error(`[extractText] XLSX parse failed for "${filename}":`, msg);
      return noTextNote(`Excel file could not be parsed — file may be corrupted`);
    }
  }

  // Unknown extension — should not reach here if validation runs first
  return noTextNote(`unsupported file type: .${ext}`);
}
