import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const WEBHOOK_SECRET       = process.env.PUSH_WEBHOOK_SECRET;
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  // 1. Shared-secret auth — Supabase sends this in the Authorization header.
  const authHeader = request.headers.get("authorization");
  if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse payload (Supabase webhook shape: { type, table, record, ... })
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const record = payload.record;
  if (!record?.user_id) {
    return NextResponse.json({ error: "missing_record" }, { status: 400 });
  }

  // 3. Look up the recipient's push subscriptions.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);

  if (subErr) {
    console.error("[push/notify] subscriptions lookup failed:", subErr.message);
    // Return 200 intentionally — non-2xx triggers Supabase webhook retries.
    return NextResponse.json({ ok: true, error: "subs_lookup_failed" });
  }

  if (!subs?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 4. Send push to each subscription.
  webpush.setVapidDetails(
    "mailto:alex.cann@outlook.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const pushPayload = JSON.stringify({
    title: record.title,
    body: record.body || "",
    url: record.link || "/",
  });

  let sent = 0;
  const failed = [];
  const deadIds = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or explicitly unsubscribed — clean up.
        deadIds.push(sub.id);
      } else {
        console.error(`[push/notify] send failed for ${sub.id}:`, err.message);
        failed.push(sub.id);
      }
    }
  }

  // 5. Delete dead subscriptions so they don't accumulate.
  if (deadIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", deadIds);
    if (deleteErr) {
      console.error("[push/notify] failed to delete dead subs:", deleteErr.message);
    }
  }

  // Always return 200 — non-2xx would trigger Supabase webhook retries.
  return NextResponse.json({ ok: true, sent, failed: failed.length, dead_cleaned: deadIds.length });
}
