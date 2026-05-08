import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const POKETRACE_BASE = "https://api.poketrace.com/v1";

// Module-level slug cache: set_name.toLowerCase() → poketrace slug
// Built once per serverless instance lifetime by paginating GET /sets.
// 27 pages × 1 req each = 27 of 250 daily requests on first call only.
let _slugCache = null;
let _slugCachePromise = null;

async function getSlugCache() {
  if (_slugCache) return _slugCache;
  if (_slugCachePromise) return _slugCachePromise;

  _slugCachePromise = (async () => {
    const map = {};
    let cursor = null;
    do {
      const url =
        POKETRACE_BASE +
        "/sets" +
        (cursor ? "?cursor=" + encodeURIComponent(cursor) : "");
      const res = await fetch(url, {
        headers: { "X-API-Key": process.env.POKETRACE_API_KEY },
      });
      if (!res.ok) break;
      const json = await res.json();
      for (const s of json.data ?? []) {
        map[s.name.toLowerCase()] = s.slug;
      }
      cursor = json.pagination?.hasMore ? json.pagination.nextCursor : null;
      // Respect burst rate limit
      if (cursor) await new Promise((r) => setTimeout(r, 500));
    } while (cursor);
    _slugCache = map;
    return map;
  })();

  return _slugCachePromise;
}

export async function POST(request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse body ──────────────────────────────────────────────────────────
  let setIds;
  try {
    ({ setIds } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(setIds) || setIds.length === 0) {
    return Response.json({ error: "setIds required" }, { status: 400 });
  }

  // ── Admin client (bypasses RLS for printings writes) ────────────────────
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Build slug cache (cheap after first call) ───────────────────────────
  const slugMap = await getSlugCache();

  // ── Process sets sequentially ───────────────────────────────────────────
  const results = [];
  let totalRequests = 0;

  for (const setId of setIds) {
    try {
      const r = await processSet(admin, user.id, setId, slugMap);
      totalRequests += r.requestsUsed ?? 0;
      results.push(r);
    } catch (err) {
      results.push({ setId, error: err.message });
    }
  }

  console.log(`[PokeTrace] Session total requests used: ${totalRequests}`);
  return Response.json({ results, totalRequests });
}

async function processSet(admin, userId, setId, slugMap) {
  // 1. Load printings + owned entries + set name in parallel
  const [
    { data: allPrintings, error: pErr },
    { data: owned, error: oErr },
    { data: setRow },
  ] = await Promise.all([
    admin
      .from("printings")
      .select("id, card_number, printing_label, price_usd")
      .eq("set_id", setId),
    admin
      .from("collection_entries")
      .select("printing_id")
      .eq("user_id", userId)
      .eq("set_id", setId)
      .eq("checked", true),
    admin.from("sets").select("name").eq("id", setId).maybeSingle(),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (oErr) throw new Error(oErr.message);

  const ownedIds = new Set((owned ?? []).map((e) => e.printing_id));
  const previousValue = (allPrintings ?? [])
    .filter((p) => ownedIds.has(p.id))
    .reduce((s, p) => s + (Number(p.price_usd) || 0), 0);

  // 2. Resolve PokeTrace slug by set name
  const setName = setRow?.name ?? "";
  const slug = slugMap[setName.toLowerCase()];

  if (!slug) {
    console.log(
      `[PokeTrace] No slug for "${setName}" (${setId}) — skipping price refresh`
    );
    return {
      setId,
      cardsUpdated: 0,
      previousValue,
      newValue: previousValue,
      requestsUsed: 0,
      note: "No PokeTrace slug found for this set",
    };
  }

  // 3. Fetch cards from PokeTrace (paginated by cursor)
  // Builds: card_number (int) → { usd: number|null, eur: number|null }
  const priceByNumber = new Map();
  let cursor = null;
  let requestsUsed = 0;
  let totalItems = 0;
  let singlesFound = 0;

  do {
    const url =
      POKETRACE_BASE +
      "/cards?set=" +
      encodeURIComponent(slug) +
      "&limit=100" +
      (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");

    const res = await fetch(url, {
      headers: { "X-API-Key": process.env.POKETRACE_API_KEY },
    });
    requestsUsed++;

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[PokeTrace] ${res.status} for ${slug}: ${body.slice(0, 120)}`);
      break;
    }

    const json = await res.json();
    const cards = json.data ?? [];
    totalItems += cards.length;

    for (const card of cards) {
      // Skip sealed products (boosters, boxes, blisters)
      if (card.productType === "sealed" || card.cardNumber == null) continue;
      singlesFound++;

      // Parse "037/186" → 37
      const num = parseInt(String(card.cardNumber).split("/")[0], 10);
      if (isNaN(num)) continue;

      const usd = card.prices?.tcgplayer?.NEAR_MINT?.avg ?? null;
      const eur = card.prices?.cardmarket?.AGGREGATED?.avg ?? null;

      // First-seen wins per card number (multiple variants may share a number)
      if (!priceByNumber.has(num)) {
        priceByNumber.set(num, { usd, eur });
      }
    }

    cursor = json.pagination?.hasMore ? json.pagination.nextCursor : null;
    if (cursor) await new Promise((r) => setTimeout(r, 400));
  } while (cursor);

  console.log(
    `[PokeTrace] ${setId} (${slug}): ${requestsUsed} req, ` +
      `${totalItems} items fetched, ${singlesFound} singles, ` +
      `${priceByNumber.size} unique card numbers with prices`
  );

  if (priceByNumber.size === 0) {
    // Log a few of the items so we can diagnose (sealed-only sets, tier limits, etc.)
    console.log(
      `[PokeTrace] No individual card pricing for ${setId} — ` +
        `${totalItems} total items were all sealed products or missing card numbers`
    );
    return {
      setId,
      cardsUpdated: 0,
      previousValue,
      newValue: previousValue,
      requestsUsed,
      note: "No individual card pricing data available for this set",
    };
  }

  // 4. Build upsert rows for printings that matched a card number
  const updates = [];
  for (const p of allPrintings ?? []) {
    const prices = priceByNumber.get(p.card_number);
    if (!prices || (prices.usd == null && prices.eur == null)) continue;

    const row = { id: p.id, updated_at: new Date().toISOString() };
    if (prices.usd != null) row.price_usd = prices.usd;
    if (prices.eur != null) row.price_eur = prices.eur;
    updates.push(row);
  }

  // Log first 5 for visibility
  if (updates.length > 0) {
    console.log(`[PokeTrace] ${setId} first 5 price updates:`);
    updates.slice(0, 5).forEach((u) =>
      console.log(`  ${u.id}: USD ${u.price_usd ?? "—"} / EUR ${u.price_eur ?? "—"}`)
    );
  }

  // 5. Bulk-upsert in batches of 200
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: uErr } = await admin
      .from("printings")
      .upsert(updates.slice(i, i + BATCH), { onConflict: "id" });
    if (uErr) throw new Error(uErr.message);
  }

  // 6. New collection value
  const updatedMap = new Map(updates.map((u) => [u.id, u]));
  const newValue = (allPrintings ?? [])
    .filter((p) => ownedIds.has(p.id))
    .reduce((s, p) => {
      const upd = updatedMap.get(p.id);
      return s + (upd?.price_usd ?? Number(p.price_usd) ?? 0);
    }, 0);

  // 7. Stamp user_sets
  await admin
    .from("user_sets")
    .update({
      previous_value: previousValue,
      prices_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("set_id", setId);

  return { setId, cardsUpdated: updates.length, previousValue, newValue, requestsUsed };
}
