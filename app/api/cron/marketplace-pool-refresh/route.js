import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { refreshListingsForPrinting } from "@/lib/marketplace/refresh";

// GitHub Actions fires this every 10 minutes. Each invocation processes
// a small batch (25 cards) within the Vercel Hobby 60s timeout.
// 3,540 pool cards / (6 invocations/hr × 20 pool slots) ≈ 24h full cycle.

const MARKETPLACE_ID = "EBAY_AU";
const BATCH_SIZE = 25;
const FAVOURITE_RATIO = 0.20;  // 5 favourite slots, 20 pool slots per batch

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    console.error("[pool-refresh] CRON_SECRET env var is not set — rejecting all requests");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const startTime = Date.now();

  const favouriteSlots = Math.floor(BATCH_SIZE * FAVOURITE_RATIO);  // 5
  const poolSlots = BATCH_SIZE - favouriteSlots;                     // 20

  // Oldest unfulfilled pool_requests (favourite-priority slots)
  const { data: requests, error: reqErr } = await supabase
    .from("pool_requests")
    .select("printing_id")
    .is("fulfilled_at", null)
    .order("requested_at", { ascending: true })
    .limit(favouriteSlots);

  if (reqErr) {
    console.error("[pool-refresh] failed to load requests:", reqErr.message);
  }

  // Oldest-due pool printings (rotation slots)
  const { data: poolDue, error: poolErr } = await supabase
    .from("marketplace_pool")
    .select("printing_id")
    .lte("next_due_at", new Date().toISOString())
    .eq("enabled", true)
    .order("next_due_at", { ascending: true })
    .limit(poolSlots);

  if (poolErr) {
    console.error("[pool-refresh] failed to load pool:", poolErr.message);
  }

  // Dedupe — skip request items that are already covered by the pool batch
  const poolIds = new Set((poolDue || []).map((r) => r.printing_id));
  const uniqueRequests = (requests || [])
    .map((r) => r.printing_id)
    .filter((id) => !poolIds.has(id));

  const batch = [
    ...uniqueRequests.map((id) => ({ id, source: "request" })),
    ...(poolDue || []).map((r) => ({ id: r.printing_id, source: "pool" })),
  ];

  if (batch.length === 0) {
    console.log("[pool-refresh] no work to do");
    return NextResponse.json({ refreshed: 0, errors: 0, durationMs: 0 });
  }

  console.log(
    `[pool-refresh] batch: ${batch.length} cards ` +
    `(${uniqueRequests.length} requests + ${poolDue?.length || 0} pool)`
  );

  const refreshed = [];
  const errors = [];

  for (const item of batch) {
    try {
      await refreshListingsForPrinting(item.id, MARKETPLACE_ID);
      refreshed.push(item.id);

      const now = new Date().toISOString();
      const nextDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (item.source === "request") {
        // Add to pool (or update if already present) and mark request fulfilled
        await supabase
          .from("marketplace_pool")
          .upsert(
            { printing_id: item.id, last_refreshed_at: now, next_due_at: nextDue },
            { onConflict: "printing_id" }
          );
        await supabase
          .from("pool_requests")
          .update({ fulfilled_at: now })
          .eq("printing_id", item.id)
          .is("fulfilled_at", null);
      } else {
        await supabase
          .from("marketplace_pool")
          .update({ last_refreshed_at: now, next_due_at: nextDue })
          .eq("printing_id", item.id);
      }
    } catch (err) {
      errors.push({ printingId: item.id, message: err.message });
      console.error(`[pool-refresh] ${item.id} failed: ${err.message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[pool-refresh] complete — refreshed=${refreshed.length}, ` +
    `errors=${errors.length}, durationMs=${durationMs}`
  );

  await supabase.from("cron_runs").insert({
    route: "marketplace-pool-refresh",
    duration_ms: durationMs,
    batch_size: batch.length,
    refreshed: refreshed.length,
    errors: errors.length,
    metadata: {
      pool_count: poolDue?.length || 0,
      request_count: uniqueRequests.length,
    },
  });

  return NextResponse.json({ refreshed: refreshed.length, errors: errors.length, durationMs });
}

// Vercel Hobby plan max function timeout
export const maxDuration = 60;
