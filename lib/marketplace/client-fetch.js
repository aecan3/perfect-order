"use client";

/**
 * Client-side dedup for /api/marketplace/listings fetches.
 *
 * Why: MSShell's prefetch and Discover's load both want the same data,
 * fire ~milliseconds apart, and used to result in two parallel server
 * calls that each ran refreshStaleForUser, doubled eBay API consumption,
 * and caused a tile-flicker as the second response overwrote the first.
 *
 * This module ensures both callers share a single in-flight Promise per
 * marketplaceId. Once settled, the result is memoised for a short TTL so
 * a third call within the freshness window also gets the cached result.
 *
 * Lives client-side only — uses module scope, which is per-tab in a
 * browser. No SSR concerns; the wrapper is only called from client
 * components.
 */

const RESULT_TTL_MS = 60 * 1000; // 60 seconds — long enough to dedupe
                                  // bursty mounts, short enough to refresh
                                  // on real navigation back to Discover

// In-flight Promises keyed by marketplaceId. Cleared after the Promise
// settles (either resolves or rejects).
const inFlight = new Map();

// Recent results keyed by marketplaceId. Each entry: { value, ts }.
// Read if ts is within RESULT_TTL_MS.
const recentResults = new Map();

/**
 * Fetch marketplace listings, deduplicated.
 *
 * @param {string} marketplaceId — e.g. "EBAY_AU"
 * @returns {Promise<{ mode: string, listings: object[] }>}
 */
export function fetchMarketplaceListings(marketplaceId) {
  // 1. Recent result still fresh? Return immediately.
  const recent = recentResults.get(marketplaceId);
  if (recent && Date.now() - recent.ts < RESULT_TTL_MS) {
    return Promise.resolve(recent.value);
  }

  // 2. In-flight Promise? Join it.
  const existing = inFlight.get(marketplaceId);
  if (existing) return existing;

  // 3. No active request — start one.
  const promise = fetch(`/api/marketplace/listings?marketplaceId=${marketplaceId}`)
    .then(async (r) => {
      if (!r.ok) throw new Error(`marketplace fetch failed: ${r.status}`);
      const data = await r.json();
      const value = { mode: data.mode, listings: data.listings || [] };
      recentResults.set(marketplaceId, { value, ts: Date.now() });
      return value;
    })
    .finally(() => {
      inFlight.delete(marketplaceId);
    });

  inFlight.set(marketplaceId, promise);
  return promise;
}
