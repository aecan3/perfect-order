// TEMPORARY — Stage 1 pipeline verification only.
// Sends a hardcoded test push to all stored subscriptions for the specified user.
// Remove or replace with real per-type sends in Stage 2.
import { NextResponse } from "next/server";
import webpush from "web-push";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(req) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  webpush.setVapidDetails(
    "mailto:alex.cann@outlook.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = getServiceClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs?.length) {
    return NextResponse.json({ sent: 0, message: "No subscriptions found for this user" });
  }

  const payload = JSON.stringify({
    title: "Master Setter test 🔔",
    body: "Push notifications are working!",
    url: "/",
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message);

  return NextResponse.json({ sent, failed });
}
