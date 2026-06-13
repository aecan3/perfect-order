import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getServiceClient } from "@/lib/supabase/service";

// Cross-device onboarding — consume the server-side stash at confirm time (PART 2).
// AUTHENTICATED (unlike the write endpoint): requires the post-verifyOtp session.
// NOT in PUBLIC_PATHS; the cookie-derived user double-checks auth inside.
//
// Two-client split (per the brief):
//   - SESSION client (cookie): auth gate + user.email lookup key + the
//     collection_entries / user_sets upserts — writing as user_id = user.id under
//     RLS, byte-identical to how /api/anonymous-migration writes today.
//   - SERVICE client: ONLY the stash row SELECT-by-email and the DELETE after
//     migrate (pending_anon_stash has RLS enabled + no policy -> service-role only).

const MAX_ENTRIES = 500;

async function getSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function POST() {
  // 1. Auth gate via the session cookie.
  const supabase = await getSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: 401 });
  }

  // 2. Normalise the stash key — IDENTICAL normalisation to the write side (PART 1).
  const email = (user.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: true, migrated: 0, setIds: [], anon_id: null });
  }

  const admin = getServiceClient();

  // 3. Service client → SELECT the stash row by email.
  const { data: stashRow, error: selErr } = await admin
    .from("pending_anon_stash")
    .select("entries, set_modes, anon_id")
    .eq("email", email)
    .maybeSingle();

  if (selErr) {
    Sentry.captureException(selErr, { tags: { location: "anon-stash-consume-select" } });
    return NextResponse.json({ ok: false, reason: "stash read failed" }, { status: 500 });
  }

  // No stash (e.g. signed up with no anonymous collection) — not an error.
  if (!stashRow) {
    return NextResponse.json({ ok: true, migrated: 0, setIds: [], anon_id: null });
  }

  const stashedAnonId = stashRow.anon_id ?? null;
  const setModes =
    stashRow.set_modes && typeof stashRow.set_modes === "object" ? stashRow.set_modes : {};

  // 4. Re-filter entries + re-apply the 500 cap (defensive — the write side already
  //    filtered, but never trust stored data). Same per-entry filter as the
  //    migration route.
  let entries = Array.isArray(stashRow.entries) ? stashRow.entries : [];
  entries = entries.filter(
    (e) =>
      e &&
      e.printingId &&
      e.cardNumber !== undefined &&
      e.setId &&
      typeof e.quantity === "number" &&
      e.quantity > 0
  );
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);

  // Nothing valid to migrate — clean up the dead row, return the carried anon_id.
  if (entries.length === 0) {
    const { error: delErr } = await admin.from("pending_anon_stash").delete().eq("email", email);
    if (delErr) {
      Sentry.captureException(delErr, { tags: { location: "anon-stash-consume-delete-empty" } });
    }
    return NextResponse.json({ ok: true, migrated: 0, setIds: [], anon_id: stashedAnonId });
  }

  // 5. SESSION client → collection_entries + user_sets upserts.
  //    NOTE: faithful replication of /api/anonymous-migration's inline logic —
  //    that route exposes no reusable function. DRY these two writers later.
  const rows = entries.map((e) => ({
    user_id: user.id,
    printing_id: e.printingId,
    card_number: e.cardNumber,
    set_id: e.setId,
    checked: true,
    duplicate_count: e.quantity > 1 ? e.quantity - 1 : 0,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("collection_entries")
    .upsert(rows, {
      onConflict: "user_id,set_id,card_number,printing_id",
      ignoreDuplicates: true,
    })
    .select("printing_id");

  if (insertErr) {
    // Migrate failed — do NOT delete the stash. 500 so the confirm page falls
    // through to its localStorage fallback; the row survives for a retry / TTL.
    Sentry.captureException(insertErr, { tags: { location: "anon-stash-consume-insert" } });
    return NextResponse.json({ ok: false, reason: insertErr.message }, { status: 500 });
  }

  const setIds = [...new Set(rows.map((r) => r.set_id))];

  // user_sets upsert (MY SETS visibility) — non-fatal, same as the migration route.
  const VALID_MODES = new Set(["any", "all", "first_edition", "unlimited", "shadowless"]);
  const userSetsRows = setIds.map((setId) => {
    const mode = setModes?.[setId];
    return {
      user_id: user.id,
      set_id: setId,
      hidden_at: null,
      edition_mode: mode && VALID_MODES.has(mode) ? mode : "any",
    };
  });

  const { error: userSetsErr } = await supabase
    .from("user_sets")
    .upsert(userSetsRows, { onConflict: "user_id,set_id", ignoreDuplicates: true });

  if (userSetsErr) {
    Sentry.captureException(userSetsErr, { tags: { location: "anon-stash-consume-user_sets" } });
    // Don't fail the migration — collection_entries already succeeded.
  }

  // 6. Migrate succeeded → DELETE the stash row (consume-on-migrate). A delete
  //    failure is non-fatal: the 24h TTL cleans it up and a re-migrate is
  //    idempotent (ON CONFLICT DO NOTHING), so a leftover row is harmless.
  const { error: delErr } = await admin.from("pending_anon_stash").delete().eq("email", email);
  if (delErr) {
    Sentry.captureException(delErr, { tags: { location: "anon-stash-consume-delete" } });
  }

  // 7. Done.
  return NextResponse.json({
    ok: true,
    migrated: inserted?.length || 0,
    setIds,
    anon_id: stashedAnonId,
  });
}
