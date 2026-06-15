import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getServiceClient } from "@/lib/supabase/service";

// Server-side pending-intent carrier (signup trade intent). Unauthenticated and
// service-role — at signup the user exists but has no session yet (confirmation-ON
// signUp returns session:null), so there is no auth.uid() for a client RLS insert.
// Mirrors /api/anon-stash. The only writer of pending_intents is this route.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const intentType = clean(body.intent_type);
  if (!UUID_RE.test(userId) || !intentType) {
    return NextResponse.json(
      { ok: false, reason: "user_id (uuid) and intent_type required" },
      { status: 400 }
    );
  }

  try {
    const admin = getServiceClient();

    // HARDENING: only an existing, still-UNCONFIRMED user is a valid target. This
    // bounds abuse to the exact legitimate window (a just-signed-up, not-yet-
    // confirmed account). The auth schema isn't exposed to PostgREST, so the user
    // is read via the Admin API rather than a `.from("users")` select.
    const { data: lookup, error: lookupErr } = await admin.auth.admin.getUserById(userId);
    const authUser = lookup?.user;
    if (lookupErr || !authUser || authUser.confirmed_at) {
      // no such user, lookup failed, or already confirmed → reject, write nothing.
      return NextResponse.json({ ok: false, reason: "invalid target" }, { status: 403 });
    }

    const row = {
      user_id: userId,
      intent_type: intentType,
      intent_subtype: clean(body.intent_subtype),
      sharer_handle: clean(body.sharer_handle),
      target_printing_id: clean(body.target_printing_id),
      target_card_name: clean(body.target_card_name),
    };

    // Last write wins (one pending intent per user).
    const { error: upsertErr } = await admin
      .from("pending_intents")
      .upsert(row, { onConflict: "user_id" });

    if (upsertErr) {
      Sentry.captureException(upsertErr, { tags: { location: "pending-intent-upsert" } });
      return NextResponse.json({ ok: false, reason: "write failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    Sentry.captureException(e, { tags: { location: "pending-intent-throw" } });
    return NextResponse.json({ ok: false, reason: "write failed" }, { status: 500 });
  }
}
