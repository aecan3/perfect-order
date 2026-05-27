import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { computeOwnershipPct } from "@/lib/feed-progression";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

const STARTED_THRESHOLD = 10;
const THRESHOLDS = [50, 75, 90];
const COMPLETED_THRESHOLD = 100;
const BULK_ADD_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req) {
  // 1. Auth
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { setId } = body;
  if (!setId || typeof setId !== "string") {
    return NextResponse.json({ error: "Invalid setId" }, { status: 400 });
  }

  // 3. Compute ownership percentage (master-tier only, GM excluded — see lib/feed-progression.js)
  let pct, total;
  try {
    ({ pct, total } = await computeOwnershipPct(supabase, user.id, setId));
  } catch (err) {
    console.error("[feed/record-milestone] pct computation failed:", err);
    return NextResponse.json({ error: "Failed to load set data" }, { status: 500 });
  }

  if (total === 0) {
    return NextResponse.json({ thresholds_fired: [], set_started_fired: false, set_completed_pending_fired: false, pct: 0 });
  }

  // Admin client for all feed_events inserts (service role bypasses RLS)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // 4. set_started — fires once at 10%, never re-fires.
  //    Checked before the milestone early-return so pct 10–49 still fires set_started.
  let setStartedFired = false;
  if (pct >= STARTED_THRESHOLD) {
    const { data: existingStart, error: startCheckErr } = await supabase
      .from("feed_events")
      .select("id")
      .eq("actor_user_id", user.id)
      .eq("event_type", "set_started")
      .eq("related_set_id", setId)
      .limit(1)
      .maybeSingle();
    if (startCheckErr) {
      console.error("[feed/record-milestone] set_started check failed:", startCheckErr);
      return NextResponse.json({ error: "Failed to check set_started" }, { status: 500 });
    }

    if (!existingStart) {
      const { error: startInsertErr } = await admin.from("feed_events").insert({
        actor_user_id: user.id,
        event_type: "set_started",
        related_set_id: setId,
        metadata: { pct },
      });
      if (startInsertErr && startInsertErr.code !== "23505") {
        console.error("[feed/record-milestone] set_started insert failed:", startInsertErr);
        return NextResponse.json({ error: "Failed to record set_started" }, { status: 500 });
      }
      if (!startInsertErr) setStartedFired = true;
    }
  }

  // 4b. set_completed_pending — INSERT at 100%.
  //     Cron flushes to feed_events after 5-min settle window.
  //     Delete-on-untick is handled by trg_delete_pending_on_collection_change.
  let setCompletedPendingFired = false;
  if (pct >= COMPLETED_THRESHOLD) {
    const { error: pendingErr } = await admin
      .from("set_completed_pending")
      .insert({ user_id: user.id, set_id: setId });
    if (pendingErr && pendingErr.code !== "23505") {
      console.error("[feed/record-milestone] set_completed_pending insert failed:", pendingErr);
      return NextResponse.json({ error: "Failed to record pending completion" }, { status: 500 });
    }
    if (!pendingErr) setCompletedPendingFired = true;
  }

  // 5. Determine candidate milestone thresholds
  const candidates = THRESHOLDS.filter((t) => pct >= t);
  if (candidates.length === 0) {
    return NextResponse.json({ thresholds_fired: [], set_started_fired: setStartedFired, set_completed_pending_fired: setCompletedPendingFired, pct });
  }

  // 6. Idempotency check — fetch already-fired milestones for this user+set
  const { data: existingEvents, error: eventsError } = await supabase
    .from("feed_events")
    .select("metadata")
    .eq("actor_user_id", user.id)
    .eq("event_type", "set_milestone")
    .eq("related_set_id", setId);
  if (eventsError) {
    console.error("[feed/record-milestone] feed_events query failed:", eventsError);
    return NextResponse.json({ error: "Failed to check existing milestones" }, { status: 500 });
  }

  const alreadyFired = new Set(
    (existingEvents || []).map((e) => e.metadata?.threshold).filter(Boolean)
  );
  const newlyCrossed = candidates.filter((t) => !alreadyFired.has(t));

  if (newlyCrossed.length === 0) {
    return NextResponse.json({ thresholds_fired: [], set_started_fired: setStartedFired, set_completed_pending_fired: setCompletedPendingFired, pct });
  }

  // 7. Bulk-add debounce — suppress all milestones inside the 30-min window.
  //    Outside the window, fire only the single highest unfired threshold.
  const { data: recentStart } = await supabase
    .from("feed_events")
    .select("created_at")
    .eq("actor_user_id", user.id)
    .eq("event_type", "set_started")
    .eq("related_set_id", setId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inBulkAddWindow =
    recentStart != null &&
    Date.now() - new Date(recentStart.created_at).getTime() < BULK_ADD_WINDOW_MS;

  // Bulk-add window: suppress all milestones entirely. Once the 30-min
  // window expires, the next tick fires only the single highest currently-
  // unfired threshold. This prevents the new-user onboarding flood (set_started
  // + 50 + 75 + 90 + set_completed) when filling in an existing collection.
  let toFire;
  if (inBulkAddWindow) {
    toFire = [];
  } else {
    const highest = [...newlyCrossed].sort((a, b) => b - a)[0];
    toFire = highest !== undefined ? [highest] : [];
  }

  if (toFire.length === 0) {
    return NextResponse.json({
      thresholds_fired: [],
      set_started_fired: setStartedFired,
      set_completed_pending_fired: setCompletedPendingFired,
      pct,
    });
  }

  // 8. Insert milestone events — partial unique index (feed_events_milestone_unique_idx)
  //    guards against concurrent races; 23505 treated as already-fired no-op.
  const rows = toFire.map((t) => ({
    actor_user_id: user.id,
    event_type: "set_milestone",
    related_set_id: setId,
    metadata: { threshold: t },
  }));

  const { error: insertError } = await admin.from("feed_events").insert(rows);
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ thresholds_fired: [], set_started_fired: setStartedFired, set_completed_pending_fired: setCompletedPendingFired, pct });
    }
    console.error("[feed/record-milestone] feed_events insert failed:", insertError);
    return NextResponse.json({ error: "Failed to record milestone" }, { status: 500 });
  }

  return NextResponse.json({ thresholds_fired: toFire, set_started_fired: setStartedFired, set_completed_pending_fired: setCompletedPendingFired, pct });
}
