/**
 * POST /api/buyer-profile/upload
 *
 * Accepts a PDF or Word document containing the buyer's acquisition criteria.
 * The document flows through the standard entity/fact extraction pipeline:
 *
 *   1. Extract text from the file
 *   2. Upload original file + text extract to Drive "Buyer" folder (best-effort)
 *   3. Run the entity fact pipeline (ingestBuyerProfileDocument):
 *      - Creates entity_file + file_texts + file_chunks records
 *      - Runs GPT fact extraction against buyer fact definitions
 *      - Reconciles extracted facts into entity_fact_values
 *   4. Syncs entity_fact_values → buyer_profiles (so computeBuyerFit has fresh data)
 *
 * Drive upload is best-effort — if Drive is not connected the profile is still
 * saved to the database from the AI extraction.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromBuffer } from "@/lib/files/extractText";
import {
  uploadFileToBuyerFolder,
  uploadTextToBuyerFolder,
} from "@/lib/google/drive";
import { ingestBuyerProfileDocument } from "@/lib/services/entity/buyerEntityService";

export const maxDuration = 60;

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rawFile = formData.get("file");
  if (!(rawFile instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const file = rawFile;
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: PDF, Word (.doc/.docx), TXT." },
      { status: 422 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 20 MB limit." }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = (file.type || "application/octet-stream").split(";")[0].trim();

  // ── 1. Extract text ───────────────────────────────────────────────────────
  const extractedText = await extractTextFromBuffer(buffer, file.name);

  if (extractedText.startsWith("[Text extraction note:")) {
    return NextResponse.json(
      { error: `Could not read text from this file: ${extractedText}` },
      { status: 422 }
    );
  }
  if (extractedText.trim().length < 50) {
    return NextResponse.json(
      { error: "The file appears to be empty or contains too little text." },
      { status: 422 }
    );
  }

  // ── 2. Upload to Drive "Buyer" folder (best-effort) ──────────────
  let storagePath = `buyer-profile/${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  let webViewLink: string | null = null;
  let driveCreatedTime: string | null = null;

  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokenRow) {
    try {
      const fileMeta = await uploadFileToBuyerFolder({
        userId: user.id,
        fileBuffer: buffer,
        originalFileName: file.name,
        mimeType,
      });
      storagePath = fileMeta.fileId;
      webViewLink = fileMeta.webViewLink;

      // Also upload the text extract alongside the original file (non-fatal)
      const baseName = fileMeta.fileName.replace(/\.[^.]+$/, "");
      uploadTextToBuyerFolder({
        userId: user.id,
        text: extractedText,
        baseName,
      }).catch((e) => console.warn("[buyer-profile/upload] Text extract Drive upload failed:", e));
    } catch (driveErr) {
      console.warn("[buyer-profile/upload] Drive upload failed (non-fatal), using Supabase Storage:", driveErr);

      // Fall back to Supabase Storage
      const storageKey = `buyer-profile/${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: storageErr } = await supabase.storage
        .from("deal-files")
        .upload(storageKey, buffer, { contentType: mimeType, upsert: false });
      if (!storageErr) storagePath = storageKey;
    }
  } else {
    // No Drive — store in Supabase Storage
    const storageKey = `buyer-profile/${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: storageErr } = await supabase.storage
      .from("deal-files")
      .upload(storageKey, buffer, { contentType: mimeType, upsert: false });
    if (!storageErr) storagePath = storageKey;
  }

  // ── 3. Run entity fact pipeline ───────────────────────────────────────────
  // This stores the file, extracts facts via GPT against buyer fact definitions,
  // reconciles them into entity_fact_values, and syncs to buyer_profiles.
  const extractionMethod = ext === ".pdf" ? "pdf-parse"
    : ext === ".docx" || ext === ".doc" ? "mammoth"
    : "text";

  const { factsExtracted } = await ingestBuyerProfileDocument({
    userId: user.id,
    storagePath,
    originalFileName: file.name,
    mimeType,
    fileSizeBytes: file.size,
    extractedText,
    extractionMethod,
    webViewLink,
    driveCreatedTime,
  });

  // ── 4. Also update source tracking on buyer_profiles ─────────────────────
  await supabase
    .from("buyer_profiles")
    .upsert(
      {
        user_id: user.id,
        profile_source_file_name: file.name,
        profile_source_drive_file_id: tokenRow ? storagePath : null,
        profile_source_text: extractedText,
        profile_source_uploaded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  return NextResponse.json({
    success: true,
    source_file_name: file.name,
    facts_extracted: factsExtracted,
    drive_stored: !!tokenRow,
  });
}
