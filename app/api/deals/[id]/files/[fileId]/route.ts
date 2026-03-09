import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/deals/:id/files/:fileId
 *
 * Returns extracted facts for a specific file, joining fact_evidence →
 * fact_definitions → entity_fact_values so the modal can show:
 *   - fact label
 *   - extracted value
 *   - confidence
 *   - snippet (evidence quote)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: dealId, fileId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the deal belongs to this user
  const { data: entity } = await supabase
    .from("entities")
    .select("id")
    .eq("id", dealId)
    .eq("owner_user_id", user.id)
    .single();

  if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch fact evidence for this file (non-superseded only)
  const { data: evidenceRows, error } = await supabase
    .from("fact_evidence")
    .select(`
      id,
      fact_definition_id,
      extracted_value_raw,
      confidence,
      snippet,
      page_number,
      is_primary,
      evidence_type,
      created_at,
      fact_definitions ( id, key, label, category, fact_scope, display_order )
    `)
    .eq("entity_id", dealId)
    .eq("file_id", fileId)
    .eq("is_superseded", false)
    .order("is_primary", { ascending: false })
    .order("confidence", { ascending: false });

  if (error) {
    console.error("[files/[fileId]] fact_evidence query failed:", error.message);
    return NextResponse.json({ facts: [] });
  }

  // Deduplicate by fact_definition_id — keep the primary/highest-confidence one
  const seen = new Set<string>();
  const facts = (evidenceRows ?? [])
    .filter((row) => {
      const defId = row.fact_definition_id as string;
      if (seen.has(defId)) return false;
      seen.add(defId);
      return true;
    })
    .map((row) => {
      const defRaw = row.fact_definitions;
      const def = (Array.isArray(defRaw) ? defRaw[0] : defRaw) as { id: string; key: string; label: string; category: string | null; fact_scope: string; display_order: number | null } | null;
      return {
        evidence_id: row.id as string,
        fact_definition_id: row.fact_definition_id as string,
        label: def?.label ?? (row.fact_definition_id as string),
        category: def?.category ?? null,
        fact_scope: def?.fact_scope ?? "deep",
        display_order: def?.display_order ?? 999,
        value: row.extracted_value_raw as string | null,
        confidence: row.confidence as number | null,
        snippet: row.snippet as string | null,
        page_number: row.page_number as number | null,
        is_primary: row.is_primary as boolean,
        evidence_type: row.evidence_type as string,
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  return NextResponse.json({ facts });
}
