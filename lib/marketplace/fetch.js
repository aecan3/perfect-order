import { getServiceClient } from "@/lib/supabase/service";
import { refreshListingsForPrinting } from "@/lib/marketplace/refresh";

/**
 * Return fresh cached listings for a set of printings, and identify which
 * printings have no cached row or only stale rows.
 *
 * @param {string[]} printingIds
 * @param {{ marketplaceId?: string, maxAgeMinutes?: number }} options
 * @returns {{ fresh: object[], stalePrintingIds: string[] }}
 */
export async function getFreshListingsForPrintings(printingIds, {
  marketplaceId = "EBAY_AU",
  maxAgeMinutes = 480,
} = {}) {
  if (!printingIds.length) return { fresh: [], stalePrintingIds: [] };

  const supabase = getServiceClient();

  const { data: rows, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .in("printing_id", printingIds)
    .eq("marketplace_id", marketplaceId)
    .gte("fetched_at", new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString());

  if (error) throw new Error(`getFreshListingsForPrintings: query failed — ${error.message}`);

  const fresh = rows || [];
  const freshPrintingIds = new Set(fresh.map((r) => r.printing_id));
  const stalePrintingIds = printingIds.filter((id) => !freshPrintingIds.has(id));

  return { fresh, stalePrintingIds };
}

/**
 * Find and refresh stale marketplace listings for a user's favourites.
 * Falls back to a random-fill scaffold if the user has no favourites.
 * Runs at most maxConcurrent eBay calls in parallel.
 *
 * @param {string} userId
 * @param {{
 *   marketplaceId?: string,
 *   maxAgeMinutes?: number,
 *   maxConcurrent?: number,
 *   minPriceUsd?: number,
 *   randomFillCount?: number,
 *   randomFillMinUsd?: number,
 *   randomFillMaxUsd?: number,
 * }} options
 * @returns {{
 *   mode: 'favourites' | 'random',
 *   targetPrintingIds: string[],
 *   refreshed: string[],
 *   skipped: string[],
 *   errors: Array<{ printingId: string, message: string }>,
 * }}
 */
export async function refreshStaleForUser(userId, {
  marketplaceId    = "EBAY_AU",
  maxAgeMinutes    = 480,
  maxConcurrent    = 3,
  minPriceUsd      = 5,
  randomFillCount  = 20,
  randomFillMinUsd = 10,
  randomFillMaxUsd = 100,
} = {}) {
  const supabase = getServiceClient();

  // ── Step 1: fetch user's favourites (app-capped at 6) ───────────────────
  const { data: favRows, error: favErr } = await supabase
    .from("favourites")
    .select("printing_id")
    .eq("user_id", userId)
    .limit(6);

  if (favErr) throw new Error(`refreshStaleForUser: favourites lookup failed — ${favErr.message}`);

  let targetPrintingIds;
  let mode;

  const rawFavIds = (favRows || []).map((r) => r.printing_id).filter(Boolean);

  if (rawFavIds.length > 0) {
    // ── Step 2a: filter favourites by min price (two-query approach) ──────
    const { data: priceRows, error: priceErr } = await supabase
      .from("printings")
      .select("id, price_usd")
      .in("id", rawFavIds)
      .gte("price_usd", minPriceUsd);

    if (priceErr) throw new Error(`refreshStaleForUser: price lookup failed — ${priceErr.message}`);

    targetPrintingIds = (priceRows || []).map((r) => r.id);
    mode = "favourites";
  } else {
    // ── Step 2b: new user — random-fill scaffold ──────────────────────────
    // Fetch a bounded pool, shuffle in JS, take first randomFillCount.
    const { data: pool, error: poolErr } = await supabase
      .from("printings")
      .select("id, price_usd")
      .gte("price_usd", randomFillMinUsd)
      .lte("price_usd", randomFillMaxUsd)
      .eq("collection_tier", "master")
      .limit(200);

    if (poolErr) throw new Error(`refreshStaleForUser: random-fill lookup failed — ${poolErr.message}`);

    const shuffled = (pool || []).slice().sort(() => Math.random() - 0.5);
    targetPrintingIds = shuffled.slice(0, randomFillCount).map((r) => r.id);
    mode = "random";
  }

  if (!targetPrintingIds.length) {
    return { mode, targetPrintingIds: [], refreshed: [], skipped: [], errors: [] };
  }

  // ── Step 3: find which are stale ──────────────────────────────────────
  const { stalePrintingIds } = await getFreshListingsForPrintings(targetPrintingIds, {
    marketplaceId,
    maxAgeMinutes,
  });

  const skipped = targetPrintingIds.filter((id) => !stalePrintingIds.includes(id));

  if (!stalePrintingIds.length) {
    return { mode, targetPrintingIds, refreshed: [], skipped, errors: [] };
  }

  // ── Step 4: throttled Promise pool ───────────────────────────────────
  const refreshed = [];
  const errors = [];
  let idx = 0;

  async function runNext() {
    while (idx < stalePrintingIds.length) {
      const printingId = stalePrintingIds[idx++];
      try {
        await refreshListingsForPrinting(printingId, marketplaceId);
        refreshed.push(printingId);
      } catch (err) {
        console.error(`refreshStaleForUser: failed for printing ${printingId} —`, err.message);
        errors.push({ printingId, message: err.message });
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, stalePrintingIds.length) }, runNext);
  await Promise.all(workers);

  return { mode, targetPrintingIds, refreshed, skipped, errors };
}
