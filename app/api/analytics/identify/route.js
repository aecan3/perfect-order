import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getServiceClient } from "@/lib/supabase/service";

// Resolve the acting user from the auth cookie — the identity source of truth.
// The client-supplied user_id is only ever validated against this, never trusted.
async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const anon_id = typeof body.anon_id === "string" ? body.anon_id.trim() : "";
  const user_id = typeof body.user_id === "string" ? body.user_id.trim() : "";

  if (!anon_id || !user_id) {
    return NextResponse.json(
      { error: "anon_id and user_id required" },
      { status: 400 }
    );
  }

  // Identity must come from the session cookie, not the body. Reject any
  // attempt to link an anon_id to a user_id that isn't the caller's own.
  const user = await getSessionUser();
  if (!user || user.id !== user_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const admin = getServiceClient();

    // First link wins (matches first-touch attribution semantics). If this
    // anon_id is already linked, never overwrite it.
    const { data: existing, error: selErr } = await admin
      .from("analytics_identity")
      .select("user_id")
      .eq("anon_id", anon_id)
      .maybeSingle();

    if (selErr) {
      Sentry.captureException(selErr, { tags: { location: "identify-select" } });
      return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }

    if (existing) {
      if (existing.user_id !== user_id) {
        Sentry.captureMessage(
          "analytics_identity anon_id already linked to a different user",
          { level: "warning", tags: { location: "identify-conflict" } }
        );
        return NextResponse.json(
          { linked: false, reason: "already_linked" },
          { status: 200 }
        );
      }
      return NextResponse.json({ linked: true }, { status: 200 });
    }

    const { error: insErr } = await admin
      .from("analytics_identity")
      .upsert({ anon_id, user_id }, { onConflict: "anon_id", ignoreDuplicates: true });

    if (insErr) {
      Sentry.captureException(insErr, { tags: { location: "identify-upsert" } });
      return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }

    return NextResponse.json({ linked: true }, { status: 200 });
  } catch (e) {
    Sentry.captureException(e, { tags: { location: "identify-throw" } });
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
}
