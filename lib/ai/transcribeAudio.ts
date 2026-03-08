// Server-side only — never import from client components

import OpenAI, { toFile } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/wav",
  "audio/webm", "audio/ogg", "audio/aac", "audio/x-m4a",
]);

export function isAudioFile(mimeType: string, filename: string): boolean {
  if (AUDIO_MIME_TYPES.has(mimeType)) return true;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return [".mp3", ".m4a", ".mp4", ".wav", ".webm", ".ogg", ".aac"].includes(`.${ext}`);
}

/**
 * Transcribe audio using OpenAI Whisper API.
 * Returns the transcript text or null if transcription fails.
 */
export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string | null> {
  try {
    const file = await toFile(buffer, filename);
    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return response.text?.trim() ?? null;
  } catch (err) {
    console.error("transcribeAudio failed:", err);
    return null;
  }
}
