/**
 * Repository: deal_files
 * Provider-agnostic file registry. Supersedes deal_drive_files for new code.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  DealFile,
  FileIngestStatus,
  FileSourceKind,
  FileStorageProvider,
} from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalize(row: Record<string, unknown>): DealFile {
  return {
    id: row.id as string,
    deal_id: row.deal_id as string,
    user_id: row.user_id as string,
    storage_provider: (row.storage_provider as FileStorageProvider) ?? "google_drive",
    provider_file_id: (row.provider_file_id as string) ?? null,
    provider_file_name: (row.provider_file_name as string) ?? null,
    web_view_link: (row.web_view_link as string) ?? null,
    original_file_name: row.original_file_name as string,
    mime_type: (row.mime_type as string) ?? null,
    size_bytes: (row.size_bytes as number) ?? null,
    checksum_sha256: (row.checksum_sha256 as string) ?? null,
    source_kind: (row.source_kind as FileSourceKind) ?? "uploaded_file",
    uploaded_by: (row.uploaded_by as string) ?? null,
    uploaded_at: row.uploaded_at as string,
    ingest_status: (row.ingest_status as FileIngestStatus) ?? "uploaded",
    legacy_drive_file_id: (row.legacy_drive_file_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

// ─── create ───────────────────────────────────────────────────────────────────

export type CreateDealFileInput = {
  deal_id: string;
  user_id: string;
  original_file_name: string;
  storage_provider?: FileStorageProvider;
  provider_file_id?: string | null;
  provider_file_name?: string | null;
  web_view_link?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum_sha256?: string | null;
  source_kind?: FileSourceKind;
  ingest_status?: FileIngestStatus;
  legacy_drive_file_id?: string | null;
};

export async function createDealFile(input: CreateDealFileInput): Promise<DealFile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .insert({
      deal_id: input.deal_id,
      user_id: input.user_id,
      original_file_name: input.original_file_name,
      storage_provider: input.storage_provider ?? "google_drive",
      provider_file_id: input.provider_file_id ?? null,
      provider_file_name: input.provider_file_name ?? null,
      web_view_link: input.web_view_link ?? null,
      mime_type: input.mime_type ?? null,
      size_bytes: input.size_bytes ?? null,
      checksum_sha256: input.checksum_sha256 ?? null,
      source_kind: input.source_kind ?? "uploaded_file",
      ingest_status: input.ingest_status ?? "uploaded",
      legacy_drive_file_id: input.legacy_drive_file_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createDealFile: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}

// ─── read ─────────────────────────────────────────────────────────────────────

export async function getDealFile(id: string): Promise<DealFile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getDealFile: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listDealFiles(dealId: string): Promise<DealFile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .select("*")
    .eq("deal_id", dealId)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`listDealFiles: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function listPendingDealFiles(dealId: string): Promise<DealFile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .select("*")
    .eq("deal_id", dealId)
    .in("ingest_status", ["uploaded", "queued"])
    .order("uploaded_at", { ascending: true });

  if (error) throw new Error(`listPendingDealFiles: ${error.message}`);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

/** Find a deal_files row by its Google Drive file ID (for dedup). */
export async function getDealFileByProviderId(
  dealId: string,
  providerFileId: string
): Promise<DealFile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .select("*")
    .eq("deal_id", dealId)
    .eq("provider_file_id", providerFileId)
    .maybeSingle();

  if (error) throw new Error(`getDealFileByProviderId: ${error.message}`);
  return data ? normalize(data as Record<string, unknown>) : null;
}

// ─── update ───────────────────────────────────────────────────────────────────

export type UpdateDealFileInput = Partial<
  Pick<
    DealFile,
    | "ingest_status"
    | "provider_file_id"
    | "provider_file_name"
    | "web_view_link"
    | "size_bytes"
    | "checksum_sha256"
  >
>;

export async function updateDealFile(
  id: string,
  patch: UpdateDealFileInput
): Promise<DealFile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`updateDealFile: ${error.message}`);
  return normalize(data as Record<string, unknown>);
}
