/**
 * dealNoteService
 *
 * Shared logic for creating a note/entry on a deal: Drive save, AI title, ingest.
 * Used by POST /api/deals/[id]/entries and POST /api/deals/[id]/notes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { saveRawEntryToDrive } from "@/lib/google/drive";
import { ingestFromDealEntry } from "@/lib/services/entity/entityFileService";
import { getDealDisplayName } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function fallbackTitle(): string {
  const now = new Date();
  return `Note ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

async function generateNoteTitle(content: string, dealName: string): Promise<string> {
  try {
    const preview = content.slice(0, 800);
    const response = await openai.chat.completions.create({
      model: process.env.DEALHUB_OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens: 20,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You generate short file names for deal-related text notes. " +
            "Respond with ONLY the file name, no extension, no quotes, no explanation. " +
            "Max 6 words. Use title case. Be specific and descriptive.",
        },
        {
          role: "user",
          content: `Deal: ${dealName}\n\nText:\n${preview}\n\nFile name:`,
        },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const clean = raw
      .replace(/^["']|["']$/g, "")
      .replace(/[/\\:*?"<>|]/g, "-")
      .slice(0, 60)
      .trim();
    return clean || fallbackTitle();
  } catch {
    return fallbackTitle();
  }
}

export type CreateNoteResult = { title: string };

/**
 * Create a note on a deal: save to Drive (if connected), generate AI title, run ingest.
 * Caller must have verified deal exists and belongs to the user.
 */
export async function createNoteForDeal(
  supabase: SupabaseClient,
  dealId: string,
  userId: string,
  content: string,
  deal: { id: string; name: string; description?: string | null }
): Promise<CreateNoteResult> {
  const dealName = getDealDisplayName(deal);

  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (tokenRow) {
    saveRawEntryToDrive({ userId, dealId, dealName, rawContent: content }).catch((err) =>
      console.error("Drive save failed (non-fatal):", err)
    );
  }

  const noteTitle = await generateNoteTitle(content, dealName).catch(() => fallbackTitle());

  ingestFromDealEntry({
    dealId,
    userId,
    entryContent: content,
    entryTitle: noteTitle,
  }).catch((err) => console.error("[entity pipeline] ingestFromDealEntry failed:", err));

  return { title: noteTitle };
}
