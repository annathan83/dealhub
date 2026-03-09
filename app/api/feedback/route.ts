import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const VALID_CATEGORIES = ["bug", "feature", "ux", "other"] as const;
type Category = typeof VALID_CATEGORIES[number];

export async function POST(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 422 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 422 });
  }

  const rating = typeof body.rating === "number" ? body.rating : null;
  if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 422 });
  }

  const category = typeof body.category === "string" && (VALID_CATEGORIES as readonly string[]).includes(body.category)
    ? (body.category as Category)
    : "other";

  const pagePath = typeof body.page_path === "string" ? body.page_path.slice(0, 500) : null;
  const pageContext = typeof body.page_context === "string" ? body.page_context.slice(0, 100) : null;
  const dealId = typeof body.deal_id === "string" ? body.deal_id : null;

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error } = await supabase.from("user_feedback").insert({
    user_id: user?.id ?? null,
    page_path: pagePath,
    page_context: pageContext,
    deal_id: dealId,
    rating,
    category,
    message,
    user_agent: userAgent,
    app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
  });

  if (error) {
    console.error("Feedback insert error:", error.message);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
