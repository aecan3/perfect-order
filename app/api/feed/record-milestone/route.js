import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { selectMasterPrintings } from "@/lib/queries/printings";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

const THRESHOLDS = [50, 75, 90];

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

  // 3. Compute ownership percentage (master-tier printings only)
  const { data: masterPrintings, error: printingsError } = await selectMasterPrintings(supabase, "id")
    .eq("set_id", setId);
  if (printingsError) {
    console.error("[feed/record-milestone] printings query failed:", printingsError);
    return NextResponse.json({ error: "Failed to load set data" }, { status: 500 });
  }

  const total = (masterPrintings || []).length;
  if (total === 0) {
    return NextResponse.json({ thresholds_fired: [], pct: 0 });
  }

  const masterPrintingIds = masterPrintings.map((p) => p.id);

  const { data: ownedEntries, error: ownedError } = await supabase
    .from("collection_entries")
    .select("printing_id")
    .eq("user_id", user.id)
    .eq("set_id", setId)
    .eq("checked", true)
    .in("printing_id", masterPrintingIds);
  if (ownedError) {
    console.error("[feed/record-milestone] collection_entries query failed:", ownedError);
    return NextResponse.json({ error: "Failed to load collection data" }, { status: 500 });
  }

  const owned = (ownedEntries || []).length;
  const pct = Math.round((owned / total) * 100);

  // 4. Determine candidate thresholds met
  const candidates = THRESHOLDS.filter((t) => pct >= t);
  if (candidates.length === 0) {
    return NextResponse.json({ thresholds_fired: [], pct });
  }

  // 5. Idempotency check — fetch already-fired milestones for this user+set
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
  const toFire = candidates.filter((t) => !alreadyFired.has(t));

  if (toFire.length === 0) {
    return NextResponse.json({ thresholds_fired: [], pct });
  }

  // 6. Insert missing thresholds — service role bypasses RLS (no INSERT policy for authenticated users)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const rows = toFire.map((t) => ({
    actor_user_id: user.id,
    event_type: "set_milestone",
    related_set_id: setId,
    metadata: { threshold: t },
  }));

  const { error: insertError } = await admin.from("feed_events").insert(rows);
  if (insertError) {
    console.error("[feed/record-milestone] feed_events insert failed:", insertError);
    return NextResponse.json({ error: "Failed to record milestone" }, { status: 500 });
  }

  // 7. Return fired thresholds and current pct for client-side debugging
  return NextResponse.json({ thresholds_fired: toFire, pct });
}
