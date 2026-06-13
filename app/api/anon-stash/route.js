import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getServiceClient } from "@/lib/supabase/service";

// Cross-device onboarding stash (PART 1). Unauthenticated — the user has not
// signed up yet, so there is no auth.uid() to derive. Writes go via the
// service-role client, which bypasses RLS on pending_anon_stash. Mirrors the
// structure of /api/track (service role, JSON response, Sentry on failure).

const MAX_ENTRIES = 500;                 // same cap as /api/anonymous-migration
const MAX_BODY_BYTES = 256 * 1024;       // raw-body backstop (~256KB)
const TTL_MS = 24 * 60 * 60 * 1000;      // 24h — refreshed on every write

// Keep only well-formed entries — same lenient filter /api/anonymous-migration
// applies. Bad rows are dropped silently rather than failing the whole stash.
function validEntry(e) {
  return (
    e &&
    typeof e === "object" &&
    e.printingId &&
    e.cardNumber !== undefined &&
    e.setId &&
    typeof e.quantity === "number" &&
    e.quantity > 0
  );
}

// Stable dedup key per entry.
function entryKey(e) {
  return `${e.setId}|${e.cardNumber}|${e.printingId}`;
}

// Union of two entry arrays by key, keeping the HIGHER quantity on collision.
function mergeEntries(existing, incoming) {
  const byKey = new Map();
  for (const e of existing) byKey.set(entryKey(e), e);
  for (const e of incoming) {
    const k = entryKey(e);
    const prev = byKey.get(k);
    if (!prev || e.quantity > prev.quantity) byKey.set(k, e);
  }
  return [...byKey.values()];
}

export async function POST(request) {
  // Raw-body byte backstop. The 500-entry cap is the primary bound; this guards
  // against a pathological oversized single body before we parse it.
  const rawText = await request.text();
  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "payload too large" }, { status: 400 });
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  // email — required, normalised to the canonical stash key.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ ok: false, reason: "email required" }, { status: 400 });
  }

  // entries — must be an array; empty (or all-invalid) is a no-op success.
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ ok: false, reason: "entries must be an array" }, { status: 400 });
  }

  let incoming = body.entries.filter(validEntry);
  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, stored: 0, truncated: false });
  }

  let truncated = false;
  if (incoming.length > MAX_ENTRIES) {
    incoming = incoming.slice(0, MAX_ENTRIES);
    truncated = true;
  }

  const incomingSetModes =
    body.setModes && typeof body.setModes === "object" && !Array.isArray(body.setModes)
      ? body.setModes
      : {};
  const incomingAnonId =
    typeof body.anon_id === "string" && body.anon_id ? body.anon_id : null;
  let incomingStartedAt = null;
  if (typeof body.started_at === "string") {
    const t = Date.parse(body.started_at);
    if (!Number.isNaN(t)) incomingStartedAt = new Date(t).toISOString();
  }

  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + TTL_MS).toISOString();

  try {
    const admin = getServiceClient();

    // Read-modify-write merge keyed by email (dedup-by-higher-quantity in JS).
    const { data: existingRow, error: selErr } = await admin
      .from("pending_anon_stash")
      .select("entries, set_modes, anon_id, started_at")
      .eq("email", email)
      .maybeSingle();

    if (selErr) {
      Sentry.captureException(selErr, { tags: { location: "anon-stash-select" } });
      return NextResponse.json({ ok: false, reason: "stash read failed" }, { status: 500 });
    }

    let mergedEntries = incoming;
    let mergedSetModes = incomingSetModes;
    let mergedAnonId = incomingAnonId;
    let mergedStartedAt = incomingStartedAt;

    if (existingRow) {
      const existingEntries = Array.isArray(existingRow.entries) ? existingRow.entries : [];
      mergedEntries = mergeEntries(existingEntries, incoming);
      // set_modes: incoming wins per-set.
      mergedSetModes = { ...(existingRow.set_modes || {}), ...incomingSetModes };
      // anon_id: prefer the freshest non-null (incoming, then existing).
      mergedAnonId = incomingAnonId ?? existingRow.anon_id ?? null;
      // started_at: earliest non-null of the two.
      const candidates = [existingRow.started_at, incomingStartedAt].filter(Boolean);
      mergedStartedAt = candidates.length
        ? candidates.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
        : null;
    }

    // Re-apply the cap to the merged union.
    if (mergedEntries.length > MAX_ENTRIES) {
      mergedEntries = mergedEntries.slice(0, MAX_ENTRIES);
      truncated = true;
    }

    const row = {
      email,
      entries: mergedEntries,
      set_modes: mergedSetModes,
      anon_id: mergedAnonId,
      started_at: mergedStartedAt,
      expires_at: expiresAt,
      updated_at: new Date(nowMs).toISOString(),
    };

    const { error: upsertErr } = await admin
      .from("pending_anon_stash")
      .upsert(row, { onConflict: "email" });

    if (upsertErr) {
      Sentry.captureException(upsertErr, { tags: { location: "anon-stash-upsert" } });
      return NextResponse.json({ ok: false, reason: "stash write failed" }, { status: 500 });
    }

    // Best-effort opportunistic cleanup — backstop to the hourly pg_cron sweep.
    // Fire-and-forget: never blocks or fails the write; errors swallowed to Sentry.
    // Covers active signup traffic; pg_cron covers quiet periods. Neither alone is
    // load-bearing.
    admin
      .from("pending_anon_stash")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .then(() => {}, (e) =>
        Sentry.captureException(e, { tags: { location: "anon-stash-lazy-cleanup" } })
      );

    return NextResponse.json({ ok: true, stored: mergedEntries.length, truncated });
  } catch (e) {
    Sentry.captureException(e, { tags: { location: "anon-stash-throw" } });
    return NextResponse.json({ ok: false, reason: "stash write failed" }, { status: 500 });
  }
}
