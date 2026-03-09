import { google, type drive_v3 } from "googleapis";
import { createOAuth2Client } from "./oauth";
import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DriveFileMetadata = {
  googleFileId: string;
  googleFileName: string;
  originalFileName: string | null;
  mimeType: string | null;
  webViewLink: string | null;
  createdTime: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitize a string for use in a file or folder name */
export function sanitizeName(input: string): string {
  return input
    .trim()
    .replace(/[^\w\s-]/g, "")   // keep word chars, spaces, hyphens
    .replace(/\s+/g, "-")       // spaces → hyphens
    .replace(/-{2,}/g, "-")     // collapse multiple hyphens
    .replace(/^-|-$/g, "")      // trim leading/trailing hyphens
    .slice(0, 60)
    || "entry";
}

/** Generate a timestamped filename for a raw pasted text entry */
export function buildEntryFileName(content: string): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  const words = content.trim().split(/\s+/).slice(0, 6).join(" ");
  const titleSlug = sanitizeName(words) || "entry";

  return `${mm}-${dd}-${yy}_${hh}-${min}_${titleSlug}.txt`;
}

/**
 * Generate a timestamped filename for an uploaded file.
 * Preserves the original extension.
 * Pattern: MM-DD-YY_HH-mm_{sanitized-original-name}.ext
 */
export function buildUploadFileName(originalName: string): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  const lastDot = originalName.lastIndexOf(".");
  const ext = lastDot !== -1 ? originalName.slice(lastDot).toLowerCase() : "";
  const base = lastDot !== -1 ? originalName.slice(0, lastDot) : originalName;
  const slug = sanitizeName(base) || "file";

  return `${mm}-${dd}-${yy}_${hh}-${min}_${slug}${ext}`;
}

// ─── Authenticated Drive client ───────────────────────────────────────────────

/**
 * Load the user's stored tokens from Supabase and return an authenticated
 * Drive client. Automatically refreshes the access token if expired.
 *
 * SECURITY NOTE: Tokens are stored in plaintext in Supabase.
 * For production, encrypt tokens at rest using a KMS or Supabase Vault.
 */
export async function getAuthorizedDriveClient(userId: string): Promise<drive_v3.Drive> {
  const supabase = await createClient();

  const { data: tokenRow, error } = await supabase
    .from("google_oauth_tokens")
    .select("access_token, refresh_token, expiry_date")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) {
    throw new Error("Google Drive is not connected for this user.");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  });

  // googleapis auto-refreshes using refresh_token when access_token is expired.
  // Listen for token refresh events and persist the new token.
  oauth2Client.on("tokens", async (newTokens) => {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newTokens.access_token) updates.access_token = newTokens.access_token;
    if (newTokens.expiry_date) updates.expiry_date = newTokens.expiry_date;
    // SECURITY NOTE: persist refreshed token back to Supabase
    await supabase
      .from("google_oauth_tokens")
      .update(updates)
      .eq("user_id", userId);
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

// ─── Folder helpers ───────────────────────────────────────────────────────────

async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string | null> {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await drive.files.list({
    q,
    fields: "files(id)",
    spaces: "drive",
    pageSize: 1,
  });

  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const metadata: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await drive.files.create({
    requestBody: metadata,
    fields: "id",
  });

  if (!res.data.id) throw new Error(`Failed to create Drive folder: ${name}`);
  return res.data.id;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Ensure the top-level "DealHub" folder exists in the user's Drive.
 * Stores the folder ID in google_drive_connections.
 */
export async function ensureDealHubRootFolder(userId: string): Promise<string> {
  const supabase = await createClient();
  const drive = await getAuthorizedDriveClient(userId);

  // Check if we already have the root folder ID stored
  const { data: conn } = await supabase
    .from("google_drive_connections")
    .select("root_folder_id")
    .eq("user_id", userId)
    .single();

  if (conn?.root_folder_id) return conn.root_folder_id;

  // Find or create the DealHub root folder
  let folderId = await findFolder(drive, "DealHub");
  if (!folderId) folderId = await createFolder(drive, "DealHub");

  // Persist
  await supabase
    .from("google_drive_connections")
    .update({ root_folder_id: folderId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return folderId;
}

/**
 * Ensure a deal-specific folder exists inside the DealHub root folder.
 * Stores the folder ID on the deal row.
 */
export async function ensureDealFolder(
  userId: string,
  dealId: string,
  dealName: string
): Promise<string> {
  const supabase = await createClient();

  // Check if deal already has a folder
  const { data: dealRow } = await supabase
    .from("deals")
    .select("google_drive_folder_id")
    .eq("id", dealId)
    .eq("user_id", userId)
    .single();

  if (dealRow?.google_drive_folder_id) return dealRow.google_drive_folder_id;

  const drive = await getAuthorizedDriveClient(userId);
  const rootFolderId = await ensureDealHubRootFolder(userId);

  const folderName = `${sanitizeName(dealName)}__${dealId}`;
  let folderId = await findFolder(drive, folderName, rootFolderId);
  if (!folderId) folderId = await createFolder(drive, folderName, rootFolderId);

  // Persist folder ID on the deal
  await supabase
    .from("deals")
    .update({ google_drive_folder_id: folderId })
    .eq("id", dealId)
    .eq("user_id", userId);

  return folderId;
}

/**
 * Upload raw pasted text as a .txt file into the deal's Drive folder.
 * Inserts a metadata row into deal_drive_files.
 * Returns the file metadata.
 */
export async function saveRawEntryToDrive(params: {
  userId: string;
  dealId: string;
  dealName: string;
  rawContent: string;
}): Promise<DriveFileMetadata> {
  const { userId, dealId, dealName, rawContent } = params;
  const supabase = await createClient();
  const drive = await getAuthorizedDriveClient(userId);

  const folderId = await ensureDealFolder(userId, dealId, dealName);
  const fileName = buildEntryFileName(rawContent);

  // Upload the file
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "text/plain",
      parents: [folderId],
    },
    media: {
      mimeType: "text/plain",
      body: rawContent,
    },
    fields: "id,name,mimeType,webViewLink,createdTime",
  });

  const file = res.data;
  if (!file.id) throw new Error("Drive file creation returned no ID.");

  const metadata: DriveFileMetadata = {
    googleFileId: file.id,
    googleFileName: file.name ?? fileName,
    originalFileName: null,
    mimeType: file.mimeType ?? "text/plain",
    webViewLink: file.webViewLink ?? null,
    createdTime: file.createdTime ?? null,
  };

  // Persist metadata in Supabase
  await supabase.from("deal_drive_files").insert({
    user_id: userId,
    deal_id: dealId,
    google_file_id: metadata.googleFileId,
    google_file_name: metadata.googleFileName,
    original_file_name: null,
    mime_type: metadata.mimeType,
    web_view_link: metadata.webViewLink,
    created_time: metadata.createdTime,
    source_kind: "raw_entry",
  });

  return metadata;
}

/**
 * Upload a file (binary) into the deal's Google Drive folder.
 * Uses a timestamped name derived from the original filename.
 * Stores both the Drive name and the original filename in Supabase.
 *
 * Structured for easy upgrade to resumable uploads for large files.
 */
export async function uploadFileToDealFolder(params: {
  userId: string;
  dealId: string;
  dealName: string;
  fileBuffer: Buffer;
  originalFileName: string;
  mimeType: string;
  sourceKind?: string;
}): Promise<DriveFileMetadata> {
  const {
    userId,
    dealId,
    dealName,
    fileBuffer,
    originalFileName,
    mimeType,
    sourceKind = "uploaded_file",
  } = params;

  const supabase = await createClient();
  const drive = await getAuthorizedDriveClient(userId);
  const folderId = await ensureDealFolder(userId, dealId, dealName);

  const driveFileName = buildUploadFileName(originalFileName);

  const { Readable } = await import("stream");
  const stream = Readable.from(fileBuffer);

  const res = await drive.files.create({
    requestBody: {
      name: driveFileName,
      mimeType,
      parents: [folderId],
    },
    media: { mimeType, body: stream },
    fields: "id,name,mimeType,webViewLink,createdTime",
  });

  const file = res.data;
  if (!file.id) throw new Error("Drive file creation returned no ID.");

  const metadata: DriveFileMetadata = {
    googleFileId: file.id,
    googleFileName: file.name ?? driveFileName,
    originalFileName,
    mimeType: file.mimeType ?? mimeType,
    webViewLink: file.webViewLink ?? null,
    createdTime: file.createdTime ?? null,
  };

  await supabase.from("deal_drive_files").insert({
    user_id: userId,
    deal_id: dealId,
    google_file_id: metadata.googleFileId,
    google_file_name: metadata.googleFileName,
    original_file_name: originalFileName,
    mime_type: metadata.mimeType,
    web_view_link: metadata.webViewLink,
    created_time: metadata.createdTime,
    source_kind: sourceKind,
  });

  return metadata;
}

/** @deprecated Use uploadFileToDealFolder instead */
export async function saveFileToDrive(params: {
  userId: string;
  dealId: string;
  dealName: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<DriveFileMetadata> {
  return uploadFileToDealFolder({
    ...params,
    originalFileName: params.fileName,
  });
}

/**
 * Save an AI assessment (image analysis or audio transcript) to the deal's Drive folder.
 * Filename: {originalFileBase}_AI assessment.txt
 * Inserts into deal_drive_files with source_kind "ai_assessment".
 */
export async function saveAIAssessmentToDrive(params: {
  userId: string;
  dealId: string;
  dealName: string;
  originalFileBase: string; // e.g. "photo" or "recording" (no extension)
  assessmentText: string;
}): Promise<DriveFileMetadata> {
  const assessmentFileName = `${params.originalFileBase}_AI assessment.txt`;
  const buffer = Buffer.from(params.assessmentText, "utf-8");
  return uploadFileToDealFolder({
    userId: params.userId,
    dealId: params.dealId,
    dealName: params.dealName,
    fileBuffer: buffer,
    originalFileName: assessmentFileName,
    mimeType: "text/plain",
    sourceKind: "ai_assessment",
  });
}

/**
 * Save a plain-text note directly to the deal's Drive folder.
 * Used for change-log notes (deal edits, status changes, etc.).
 * Does NOT insert a deal_drive_files row — this is an internal audit note.
 */
export async function saveTextNoteToDrive(params: {
  userId: string;
  dealId: string;
  dealName: string;
  noteContent: string;
  fileNameSuffix: string; // e.g. "deal-edit" or "status-change"
}): Promise<{ googleFileId: string; webViewLink: string | null }> {
  const { userId, dealId, dealName, noteContent, fileNameSuffix } = params;
  const drive = await getAuthorizedDriveClient(userId);
  const folderId = await ensureDealFolder(userId, dealId, dealName);

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const fileName = `${mm}-${dd}-${yy}_${hh}-${min}_${fileNameSuffix}.txt`;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "text/plain",
      parents: [folderId],
    },
    media: { mimeType: "text/plain", body: noteContent },
    fields: "id,webViewLink",
  });

  return {
    googleFileId: res.data.id ?? "",
    webViewLink: res.data.webViewLink ?? null,
  };
}

/**
 * Sync the deal's Google Drive folder contents into Supabase, then return
 * the full merged list ordered newest first.
 *
 * - Files already tracked in Supabase are left untouched.
 * - Files present in Drive but missing from Supabase (e.g. manually dropped
 *   into the folder) are upserted with source_kind = "manual".
 * - Files in Supabase but no longer in Drive are NOT deleted (preserve history).
 * - If Drive is not connected or the folder doesn't exist yet, falls back to
 *   the Supabase-only list silently.
 */
export async function syncAndListDealDriveFiles(userId: string, dealId: string) {
  const supabase = await createClient();

  // ── 1. Try to fetch live file list from Drive ─────────────────────────────
  try {
    // Need the folder ID — read from the deal row
    const { data: dealRow } = await supabase
      .from("deals")
      .select("google_drive_folder_id")
      .eq("id", dealId)
      .eq("user_id", userId)
      .single();

    const folderId = dealRow?.google_drive_folder_id as string | null;

    if (folderId) {
      const drive = await getAuthorizedDriveClient(userId);

      // List all non-trashed, non-folder files in the deal folder
      const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id,name,mimeType,webViewLink,createdTime)",
        spaces: "drive",
        pageSize: 200,
      });

      const driveFiles = res.data.files ?? [];

      if (driveFiles.length > 0) {
        // Fetch the google_file_ids we already know about for this deal
        const { data: existing } = await supabase
          .from("deal_drive_files")
          .select("google_file_id")
          .eq("deal_id", dealId)
          .eq("user_id", userId);

        const knownIds = new Set((existing ?? []).map((r) => r.google_file_id as string));

        // Upsert any Drive files not yet in Supabase
        const newFiles = driveFiles.filter((f) => f.id && !knownIds.has(f.id));

        if (newFiles.length > 0) {
          const rows = newFiles.map((f) => ({
            user_id: userId,
            deal_id: dealId,
            google_file_id: f.id!,
            google_file_name: f.name ?? f.id!,
            // original_file_name intentionally omitted for sync rows — unknown for Drive-only files
            mime_type: f.mimeType ?? null,
            web_view_link: f.webViewLink ?? null,
            created_time: f.createdTime ?? null,
            source_kind: "manual",
          }));

          const { error: insertErr } = await supabase
            .from("deal_drive_files")
            .insert(rows);

          if (insertErr) {
            console.error("Drive sync insert failed:", insertErr.message);
          }
        }
      }
    }
  } catch (syncErr) {
    // Non-fatal — Drive may not be connected, token may be expired, etc.
    console.warn("Drive sync skipped:", (syncErr as Error).message);
  }

  // ── 2. Return the full Supabase list (now includes any newly synced files) ─
  const { data, error } = await supabase
    .from("deal_drive_files")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listDealDriveFiles error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Return the deal's Drive files from Supabase metadata only, newest first.
 * Use syncAndListDealDriveFiles when you need a live-synced list.
 */
export async function listDealDriveFiles(userId: string, dealId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deal_drive_files")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listDealDriveFiles error:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Get the web URL for a Drive folder given its folder ID.
 */
export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ─── File download ────────────────────────────────────────────────────────────

/**
 * Download a file from Google Drive and return its content as a Buffer.
 * Used by DerivativeProcessingService to fetch files for AI extraction.
 * Throws if the file cannot be downloaded.
 */
export async function downloadDriveFile(
  userId: string,
  googleFileId: string
): Promise<Buffer> {
  const drive = await getAuthorizedDriveClient(userId);

  const response = await drive.files.get(
    { fileId: googleFileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data as ArrayBuffer);
}
