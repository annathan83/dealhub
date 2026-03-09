// Server-side only — never import this in client components

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const ACCEPTED_MIME_TYPES: Record<string, string> = {
  "text/plain": "txt",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx"];

export function validateFile(file: { size: number; type: string; name: string }): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large. Maximum size is 100 MB.`;
  }
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const mimeOk = file.type in ACCEPTED_MIME_TYPES;
  const extOk = ACCEPTED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    return `Unsupported file type. Accepted: TXT, PDF, Word (.doc/.docx), Excel (.xls/.xlsx).`;
  }
  return null;
}

/**
 * Extract plain text from a file buffer.
 * Returns the extracted text string, or throws if the type is unsupported.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // ── Plain text ────────────────────────────────────────────────────────────
  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  // ── PDF — uses pdf-parse (works in Node.js serverless) ───────────────────
  if (ext === "pdf") {
    // Dynamic import keeps it out of the client bundle.
    // pdf-parse is a lightweight wrapper around pdf.js that works in Node.js
    // without requiring a worker thread or canvas/DOM APIs.
    // pdf-parse v1 is a CJS module; cast to any to handle the default export shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse")) as any;
    const parse = pdfParse.default ?? pdfParse;
    const result = await parse(buffer);
    return result.text ?? "";
  }

  // ── Word (.docx) ──────────────────────────────────────────────────────────
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  // ── Word (.doc) — extract what we can as raw text ─────────────────────────
  if (ext === "doc") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (result.value?.trim()) return result.value;
    } catch {
      // fall through to raw text attempt
    }
    return buffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/ {3,}/g, "  ")
      .trim();
  }

  // ── Excel (.xlsx / .xls) ──────────────────────────────────────────────────
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        lines.push(`=== Sheet: ${sheetName} ===`);
        lines.push(csv);
      }
    }
    return lines.join("\n\n");
  }

  throw new Error(`Cannot extract text from file type: .${ext}`);
}
