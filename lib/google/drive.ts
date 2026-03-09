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

  if (!tokenRow.refresh_token) {
    throw new Error("Google Drive refresh token is missing. Please reconnect Google Drive in Settings → Integrations.");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  });

  // If the access token is expired (or will expire within 60s), proactively refresh it
  // before making any API calls. This avoids relying on the async 'tokens' event.
  const isExpired = tokenRow.expiry_date
    ? Date.now() > Number(tokenRow.expiry_date) - 60_000
    : true;

  if (isExpired) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Persist the refreshed token synchronously before returning
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (credentials.access_token) updates.access_token = credentials.access_token;
      if (credentials.expiry_date) updates.expiry_date = credentials.expiry_date;
      await supabase
        .from("google_oauth_tokens")
        .update(updates)
        .eq("user_id", userId);
    } catch (refreshErr) {
      const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
      throw new Error(`Google Drive token refresh failed: ${msg}. Please reconnect Google Drive in Settings → Integrations.`);
    }
  }

  // Also listen for any further token refreshes during the request lifetime
  oauth2Client.on("tokens", async (newTokens) => {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newTokens.access_token) updates.access_token = newTokens.access_token;
    if (newTokens.expiry_date) updates.expiry_date = newTokens.expiry_date;
    await supabase
      .from("google_oauth_tokens")
      .update(updates)
      .eq("user_id", userId)
      .then(({ error: e }) => {
        if (e) console.error("[drive] Failed to persist refreshed token:", e.message);
      });
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

// ─── Subfolder names ──────────────────────────────────────────────────────────

/**
 * The three subfolders created inside every deal folder:
 *   raw/          — original uploads and pasted text (source of truth)
 *   derived/      — AI assessment .txt files generated from raw files
 *   intelligence/ — deal-edit audit notes, change logs, internal memos
 */
export type DealSubfolder = "raw" | "derived" | "intelligence";

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

  // Persist — upsert so this works whether or not a row already exists
  await supabase
    .from("google_drive_connections")
    .upsert(
      { user_id: userId, root_folder_id: folderId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  return folderId;
}

/** Format a deal number as a zero-padded 5-digit string, e.g. 1 → "00001" */
export function formatDealNumber(n: number): string {
  return String(n).padStart(5, "0");
}

/**
 * Build the canonical Drive folder name for a deal.
 * Format: 00001_Deal-Name
 */
export function buildDealFolderName(dealNumber: number, dealName: string): string {
  return `${formatDealNumber(dealNumber)}_${sanitizeName(dealName)}`;
}

/**
 * Ensure a deal-specific folder exists inside the DealHub root folder.
 * Stores the folder ID on the deal row.
 * Folder name format: 00001_Deal-Name
 */
export async function ensureDealFolder(
  userId: string,
  dealId: string,
  dealName: string,
  dealNumber?: number
): Promise<string> {
  const supabase = await createClient();

  // Check if deal already has a folder
  const { data: dealRow } = await supabase
    .from("deals")
    .select("google_drive_folder_id, deal_number")
    .eq("id", dealId)
    .eq("user_id", userId)
    .single();

  if (dealRow?.google_drive_folder_id) return dealRow.google_drive_folder_id as string;

  const drive = await getAuthorizedDriveClient(userId);
  const rootFolderId = await ensureDealHubRootFolder(userId);

  const num = dealNumber ?? (dealRow?.deal_number as number | null) ?? 0;
  const folderName = buildDealFolderName(num, dealName);
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
 * Ensure all three subfolders (raw/, derived/, intelligence/) exist inside
 * the deal folder. Returns a map of subfolder name → Drive folder ID.
 *
 * Called eagerly at deal creation and lazily as a fallback before any write.
 * Safe to call multiple times — uses findFolder before createFolder.
 */
export async function ensureDealSubfolders(
  userId: string,
  dealId: string,
  dealName: string,
  dealNumber?: number
): Promise<Record<DealSubfolder, string>> {
  const drive = await getAuthorizedDriveClient(userId);
  const dealFolderId = await ensureDealFolder(userId, dealId, dealName, dealNumber);

  const subfolderNames: DealSubfolder[] = ["raw", "derived", "intelligence"];
  const result = {} as Record<DealSubfolder, string>;

  await Promise.all(
    subfolderNames.map(async (name) => {
      let id = await findFolder(drive, name, dealFolderId);
      if (!id) id = await createFolder(drive, name, dealFolderId);
      result[name] = id;
    })
  );

  return result;
}

/**
 * Get the Drive folder ID for a specific subfolder of a deal.
 * Creates the subfolder (and deal folder if needed) if they don't exist yet.
 */
export async function getDealSubfolderId(
  userId: string,
  dealId: string,
  dealName: string,
  subfolder: DealSubfolder,
  dealNumber?: number
): Promise<string> {
  const subfolders = await ensureDealSubfolders(userId, dealId, dealName, dealNumber);
  return subfolders[subfolder];
}

/**
 * Upload raw pasted text as a .txt file into the deal's raw/ subfolder.
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

  const folderId = await getDealSubfolderId(userId, dealId, dealName, "raw");
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

  return metadata;
}

/**
 * Upload a file (binary) into the deal's Drive folder.
 * - User uploads (files, photos, audio) → raw/
 * - AI assessment text files            → derived/
 * Uses a timestamped name derived from the original filename.
 * Stores both the Drive name and the original filename in Supabase.
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

  // AI assessments go to derived/, everything else (raw uploads) goes to raw/
  const subfolder: DealSubfolder = sourceKind === "ai_assessment" ? "derived" : "raw";
  const folderId = await getDealSubfolderId(userId, dealId, dealName, subfolder);

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
 * Save a plain-text note directly to the deal's intelligence/ subfolder.
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
  const folderId = await getDealSubfolderId(userId, dealId, dealName, "intelligence");

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
 * Sync the deal's Google Drive folder contents into entity_files, then return
 * the full merged list ordered newest first.
 *
 * - Files already tracked (by storage_path = googleFileId) are left untouched.
 * - Files present in Drive but missing from entity_files (e.g. manually dropped
 *   into the folder) are inserted with source_type = "manual".
 * - Files in entity_files but no longer in Drive are NOT deleted (preserve history).
 * - If Drive is not connected or the folder doesn't exist yet, falls back to
 *   the entity_files-only list silently.
 */
export async function syncAndListDealDriveFiles(userId: string, dealId: string): Promise<import("@/types/entity").EntityFile[]> {
  const supabase = await createClient();

  // ── 1. Resolve entity for this deal ──────────────────────────────────────
  const { data: entityRow } = await supabase
    .from("entities")
    .select("id")
    .eq("legacy_deal_id", dealId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  const entityId = entityRow?.id as string | null;

  // ── 2. Try to fetch live file list from Drive ─────────────────────────────
  if (entityId) {
    try {
      const { data: dealRow } = await supabase
        .from("deals")
        .select("google_drive_folder_id")
        .eq("id", dealId)
        .eq("user_id", userId)
        .single();

      const folderId = dealRow?.google_drive_folder_id as string | null;

      if (folderId) {
        const drive = await getAuthorizedDriveClient(userId);

        const res = await drive.files.list({
          q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
          fields: "files(id,name,mimeType,webViewLink,createdTime)",
          spaces: "drive",
          pageSize: 200,
        });

        const driveFiles = res.data.files ?? [];

        if (driveFiles.length > 0) {
          // Fetch storage_paths (= googleFileId) we already know about
          const { data: existing } = await supabase
            .from("entity_files")
            .select("storage_path")
            .eq("entity_id", entityId);

          const knownPaths = new Set((existing ?? []).map((r) => r.storage_path as string));

          const newFiles = driveFiles.filter((f) => f.id && !knownPaths.has(f.id));

          if (newFiles.length > 0) {
            const rows = newFiles.map((f) => ({
              entity_id: entityId,
              legacy_deal_id: dealId,
              storage_path: f.id!,
              file_name: f.name ?? f.id!,
              mime_type: f.mimeType ?? null,
              source_type: "manual",
              uploaded_by: userId,
              metadata_json: { google_file_id: f.id! },
              web_view_link: f.webViewLink ?? null,
              drive_created_time: f.createdTime ?? null,
            }));

            const { error: insertErr } = await supabase
              .from("entity_files")
              .insert(rows);

            if (insertErr) {
              console.error("Drive sync insert failed:", insertErr.message);
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn("Drive sync skipped:", (syncErr as Error).message);
    }
  }

  // ── 3. Return the full entity_files list for this deal ────────────────────
  if (!entityId) return [];

  const { data, error } = await supabase
    .from("entity_files")
    .select("*")
    .eq("entity_id", entityId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("syncAndListDealDriveFiles error:", error.message);
    return [];
  }

  return (data ?? []) as import("@/types/entity").EntityFile[];
}

/**
 * Return the deal's Drive files from Supabase metadata only, newest first.
 * Use syncAndListDealDriveFiles when you need a live-synced list.
 */
export async function listDealDriveFiles(userId: string, dealId: string): Promise<import("@/types/entity").EntityFile[]> {
  const supabase = await createClient();

  const { data: entityRow } = await supabase
    .from("entities")
    .select("id")
    .eq("legacy_deal_id", dealId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (!entityRow?.id) return [];

  const { data, error } = await supabase
    .from("entity_files")
    .select("*")
    .eq("entity_id", entityRow.id as string)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("listDealDriveFiles error:", error.message);
    return [];
  }

  return (data ?? []) as import("@/types/entity").EntityFile[];
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
