import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { saveRawEntryToDrive } from "@/lib/google/drive";
import { ingestFromDealEntry } from "@/lib/services/entity/entityFileService";
import type { Deal } from "@/types";
import { getDealDisplayName } from "@/types";

// ─── AI title generation for pasted text ─────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates a short, descriptive title for a pasted text entry.
 * The title is used as both the display name and the .txt file name.
 * Falls back to a timestamp-based name if AI is unavailable.
 */
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
    // Sanitise: strip quotes, limit length, replace unsafe chars
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

function fallbackTitle(): string {
  const now = new Date();
  return `Note ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let content: string;
  try {
    const body = await request.json();
    content = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("id, name, description")
    .eq("id", dealId)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const deal = dealData as Pick<Deal, "id" | "name" | "description">;

  // ── 1. Save to Google Drive (non-fatal) ───────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (tokenRow) {
    saveRawEntryToDrive({ userId: user.id, dealId, dealName: getDealDisplayName(deal), rawContent: content })
      .catch((err) => console.error("Drive save failed (non-fatal):", err));
  }

  // ── 2. Generate AI title for the note (used as display name + .txt filename)
  const noteTitle = await generateNoteTitle(content, getDealDisplayName(deal)).catch(() => fallbackTitle());

  // ── 3. Entity pipeline: text → triage facts → triage summary ─────────────
  // Deep analysis is user-triggered only — never runs automatically on intake.
  ingestFromDealEntry({
    dealId,
    userId: user.id,
    entryContent: content,
    entryTitle: noteTitle,
  }).catch((err) => console.error("[entity pipeline] ingestFromDealEntry failed:", err));

  return NextResponse.json({ ok: true, title: noteTitle }, { status: 201 });
}
