/**
 * GET  /api/settings/scoring-config  — fetch user's default scoring weights
 * PATCH /api/settings/scoring-config — save user's default scoring weights
 *
 * The default scoring config is applied to new deals at creation time.
 * It is stored in user_settings.default_scoring_config as a
 * Record<kpi_key, weight> where weights are normalized to sum to 1.0.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_settings")
    .select("default_scoring_config")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    default_scoring_config: (data?.default_scoring_config as Record<string, number> | null) ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { default_scoring_config: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = body.default_scoring_config;
  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "default_scoring_config must be an object" }, { status: 422 });
  }

  // Validate: all values must be numbers >= 0
  for (const [key, val] of Object.entries(config)) {
    if (typeof val !== "number" || val < 0) {
      return NextResponse.json(
        { error: `Invalid weight for "${key}": must be a non-negative number` },
        { status: 422 }
      );
    }
  }

  // Normalize weights to sum to 1.0
  const total = Object.values(config).reduce((s, v) => s + v, 0);
  const normalized: Record<string, number> = {};
  if (total > 0) {
    for (const [k, v] of Object.entries(config)) {
      normalized[k] = v / total;
    }
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, default_scoring_config: normalized, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ default_scoring_config: normalized });
}
