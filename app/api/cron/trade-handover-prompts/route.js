import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    console.error("cron: CRON_SECRET env var is not set — rejecting all requests");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: "trade-handover-prompts", status: "in_progress" },
    { schedule: { type: "crontab", value: "0 8 * * *" }, timezone: "UTC" }
  );

  const supabase = getSupabase();

  const { data: trades, error: tradesErr } = await supabase
    .from("trades")
    .select("id, proposer_id, recipient_id, updated_at")
    .eq("status", "agreed_pending_handover")
    .is("physical_handover_confirmed_at", null);

  if (tradesErr) {
    Sentry.captureException(tradesErr, { tags: { cron: "trade-handover-prompts" } });
    Sentry.captureCheckIn({ monitorSlug: "trade-handover-prompts", checkInId, status: "error" });
    console.error("cron: failed to fetch trades", tradesErr.message);
    return NextResponse.json({ error: tradesErr.message }, { status: 500 });
  }

  if (!trades?.length) {
    Sentry.captureCheckIn({ monitorSlug: "trade-handover-prompts", checkInId, status: "ok" });
    return NextResponse.json({ processed: 0 });
  }

  // Batch-fetch profiles for all parties in one query
  const allUserIds = [...new Set(trades.flatMap((t) => [t.proposer_id, t.recipient_id]))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle")
    .in("id", allUserIds);
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  // Batch-fetch existing prompt/auto-complete events for all trades
  const tradeIds = trades.map((t) => t.id);
  const { data: existingEvents } = await supabase
    .from("trade_events")
    .select("trade_id, event_type")
    .in("trade_id", tradeIds)
    .in("event_type", ["handover_prompt_d7", "handover_prompt_d14", "handover_auto_completed"]);

  const sentByTrade = {};
  for (const ev of existingEvents || []) {
    if (!sentByTrade[ev.trade_id]) sentByTrade[ev.trade_id] = new Set();
    sentByTrade[ev.trade_id].add(ev.event_type);
  }

  let processed = 0;
  const errors = [];

  for (const trade of trades) {
    try {
      const daysSince = (Date.now() - new Date(trade.updated_at)) / DAY_MS;
      const sent = sentByTrade[trade.id] || new Set();
      const proposerHandle = profileMap[trade.proposer_id]?.handle || "them";
      const recipientHandle = profileMap[trade.recipient_id]?.handle || "them";

      if (daysSince >= 21 && !sent.has("handover_auto_completed")) {
        // Record event FIRST before any mutations (idempotency guard)
        const { error: evErr } = await supabase.from("trade_events").insert({
          trade_id: trade.id,
          user_id: null,
          event_type: "handover_auto_completed",
          detail: { days_elapsed: Math.floor(daysSince) },
        });
        if (evErr) throw new Error("event insert failed: " + evErr.message);

        const { error: updateErr } = await supabase
          .from("trades")
          .update({
            status: "physically_completed",
            physical_handover_auto_completed: true,
            physical_handover_confirmed_at: new Date().toISOString(),
          })
          .eq("id", trade.id);
        if (updateErr) throw new Error("trade update failed: " + updateErr.message);

        await supabase.from("notifications").insert([
          {
            user_id: trade.proposer_id,
            type: "trade_auto_completed",
            title: "Trade auto-completed",
            body: `Your trade with @${recipientHandle} was automatically marked as completed after 21 days.`,
            link: `/messages/${recipientHandle}`,
          },
          {
            user_id: trade.recipient_id,
            type: "trade_auto_completed",
            title: "Trade auto-completed",
            body: `Your trade with @${proposerHandle} was automatically marked as completed after 21 days.`,
            link: `/messages/${proposerHandle}`,
          },
        ]);

        processed++;
        continue;
      }

      if (daysSince >= 14 && !sent.has("handover_prompt_d14")) {
        const { error: evErr } = await supabase.from("trade_events").insert({
          trade_id: trade.id,
          user_id: null,
          event_type: "handover_prompt_d14",
          detail: { days_elapsed: Math.floor(daysSince) },
        });
        if (evErr) throw new Error("event insert failed: " + evErr.message);

        await supabase.from("notifications").insert([
          {
            user_id: trade.proposer_id,
            type: "trade_handover_prompt",
            title: "Still pending?",
            body: `Your trade with @${recipientHandle} is still awaiting confirmation. Tap to update.`,
            link: `/messages/${recipientHandle}`,
          },
          {
            user_id: trade.recipient_id,
            type: "trade_handover_prompt",
            title: "Still pending?",
            body: `Your trade with @${proposerHandle} is still awaiting confirmation. Tap to update.`,
            link: `/messages/${proposerHandle}`,
          },
        ]);

        processed++;
      }

      if (daysSince >= 7 && !sent.has("handover_prompt_d7")) {
        const { error: evErr } = await supabase.from("trade_events").insert({
          trade_id: trade.id,
          user_id: null,
          event_type: "handover_prompt_d7",
          detail: { days_elapsed: Math.floor(daysSince) },
        });
        if (evErr) throw new Error("event insert failed: " + evErr.message);

        await supabase.from("notifications").insert([
          {
            user_id: trade.proposer_id,
            type: "trade_handover_prompt",
            title: "Confirm your trade",
            body: `Has your trade with @${recipientHandle} happened? Tap to confirm.`,
            link: `/messages/${recipientHandle}`,
          },
          {
            user_id: trade.recipient_id,
            type: "trade_handover_prompt",
            title: "Confirm your trade",
            body: `Has your trade with @${proposerHandle} happened? Tap to confirm.`,
            link: `/messages/${proposerHandle}`,
          },
        ]);

        processed++;
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { cron: "trade-handover-prompts" },
        extra: { tradeId: trade.id },
      });
      console.error(`cron: trade ${trade.id} failed —`, err.message);
      errors.push({ tradeId: trade.id, error: err.message });
    }
  }

  Sentry.captureCheckIn({ monitorSlug: "trade-handover-prompts", checkInId, status: errors.length ? "error" : "ok" });
  return NextResponse.json({ processed, errors: errors.length ? errors : undefined });
}
