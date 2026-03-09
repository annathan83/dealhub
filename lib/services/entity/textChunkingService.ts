/**
 * textChunkingService
 *
 * Splits extracted text into overlapping chunks suitable for fact extraction.
 * Uses a simple character-based splitter (≈500 tokens ≈ 2000 chars, 50-token
 * overlap ≈ 200 chars). No external dependency required.
 *
 * Chunks are stored in the file_chunks table via the entities repository.
 */

import { insertFileChunks } from "@/lib/db/entities";

const CHUNK_SIZE_CHARS = 2000;   // ≈ 500 tokens
const OVERLAP_CHARS    = 200;    // ≈ 50 tokens

export type ChunkInput = {
  text: string;
  chunk_index: number;
  token_count?: number;
  page_number?: number;
};

/**
 * Split text into overlapping chunks.
 * Returns an array of chunk objects ready for DB insertion.
 */
export function splitTextIntoChunks(fullText: string): ChunkInput[] {
  if (!fullText || fullText.trim().length === 0) return [];

  const chunks: ChunkInput[] = [];
  let start = 0;
  let index = 0;

  while (start < fullText.length) {
    const end = Math.min(start + CHUNK_SIZE_CHARS, fullText.length);
    const text = fullText.slice(start, end).trim();

    if (text.length > 0) {
      chunks.push({
        text,
        chunk_index: index,
        // Rough token estimate: 1 token ≈ 4 chars
        token_count: Math.ceil(text.length / 4),
      });
      index++;
    }

    if (end >= fullText.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}

/**
 * Chunk the given text and persist all chunks for the entity file.
 * Non-fatal — logs errors but does not throw.
 */
export async function chunkAndStoreText(
  fileId: string,
  fullText: string
): Promise<number> {
  try {
    const chunks = splitTextIntoChunks(fullText);
    if (chunks.length === 0) return 0;

    await insertFileChunks(fileId, chunks);
    return chunks.length;
  } catch (err) {
    console.error("[textChunkingService] chunkAndStoreText failed:", err);
    return 0;
  }
}
