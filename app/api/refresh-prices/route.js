import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ── API bases ────────────────────────────────────────────────────────────────
const POKETRACE_BASE = "https://api.poketrace.com/v1";
const PTCG_BASE      = "https://api.pokemontcg.io/v2/cards";
const PPT_BASE       = "https://www.pokemonpricetracker.com/api/v2";

// ME sets have no PokeTrace individual card data — skip source 1 for these
const ME_SETS = new Set(["me1", "me2", "me2pt5", "me3"]);

// pokemontcg.io price key camelCase → snake_case (builds printing ID suffix)
const toSnake = (s) => s.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── PokeTrace slug cache ─────────────────────────────────────────────────────
// setName.toLowerCase() → slug; built once, survives instance lifetime (~27 API calls)
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
        POKETRACE_BASE + "/sets" +
        (cursor ? "?cursor=" + encodeURIComponent(cursor) : "");
      const res = await fetch(url, {
        headers: { "X-API-Key": process.env.POKETRACE_API_KEY },
      });
      if (!res.ok) break;
      const json = await res.json();
      for (const s of json.data ?? []) map[s.name.toLowerCase()] = s.slug;
      cursor = json.pagination?.hasMore ? json.pagination.nextCursor : null;
      if (cursor) await sleep(500);
    } while (cursor);
    _slugCache = map;
    return map;
  })();
  return _slugCachePromise;
}

// ── Source 1: PokeTrace ──────────────────────────────────────────────────────
// Returns { map: Map<printingId, {price_usd?, price_eur?}>, requestsUsed } | null
// Null when 0 singles found (only sealed products or no data for this tier).
async function tryPokeTrace(slug, allPrintings) {
  // cardNumber(int) → [printingId]  (same price applied to all variants of a card)
  const byNumber = new Map();
  for (const p of allPrintings) {
    if (!byNumber.has(p.card_number)) byNumber.set(p.card_number, []);
    byNumber.get(p.card_number).push(p.id);
  }

  const priceByNumber = new Map();
  let cursor = null, requestsUsed = 0, singlesFound = 0;

  do {
    const url =
      POKETRACE_BASE + "/cards?set=" + encodeURIComponent(slug) +
      "&limit=100" +
      (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");

    const res = await fetch(url, {
      headers: { "X-API-Key": process.env.POKETRACE_API_KEY },
    });
    requestsUsed++;
    if (!res.ok) {
      console.warn(`[PokeTrace] ${res.status} for ${slug}`);
      break;
    }

    const json = await res.json();
    for (const card of json.data ?? []) {
      if (card.productType === "sealed" || card.cardNumber == null) continue;
      singlesFound++;
      const num = parseInt(String(card.cardNumber).split("/")[0], 10);
      if (isNaN(num) || priceByNumber.has(num)) continue;
      priceByNumber.set(num, {
        usd: card.prices?.tcgplayer?.NEAR_MINT?.avg ?? null,
        eur: card.prices?.cardmarket?.AGGREGATED?.avg ?? null,
      });
    }

    cursor = json.pagination?.hasMore ? json.pagination.nextCursor : null;
    if (cursor) await sleep(400);
  } while (cursor);

  if (singlesFound === 0) return null;

  const priceMap = new Map();
  for (const [num, prices] of priceByNumber) {
    for (const pid of byNumber.get(num) ?? []) {
      const row = {};
      if (prices.usd != null) row.price_usd = prices.usd;
      if (prices.eur != null) row.price_eur = prices.eur;
      if (Object.keys(row).length) priceMap.set(pid, row);
    }
  }

  return priceMap.size > 0 ? { map: priceMap, requestsUsed } : null;
}

// ── Source 2: pokemontcg.io ──────────────────────────────────────────────────
// Returns { map: Map<printingId, {price_usd}>, requestsUsed } | null
// Matches by printing ID directly (printing type encoded in the ID suffix).
async function tryPtcgio(setId, allPrintings) {
  const existingIds = new Set(allPrintings.map((p) => p.id));
  const priceMap = new Map();
  let page = 1, fetched = 0, totalCount = Infinity, requestsUsed = 0;

  while (fetched < totalCount) {
    const res = await fetch(
      `${PTCG_BASE}?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}&select=id,tcgplayer`,
      {
        headers: {
          "X-Api-Key": process.env.POKEMON_TCG_API_KEY,
          Accept: "application/json",
        },
      }
    );
    requestsUsed++;
    if (!res.ok) break;

    const json = await res.json();
    totalCount = json.totalCount ?? json.count ?? 0;
    const cards = json.data ?? [];
    fetched += cards.length;

    for (const card of cards) {
      for (const [tcgType, data] of Object.entries(card.tcgplayer?.prices ?? {})) {
        const market = data?.market;
        if (market == null || market <= 0) continue;
        const pid = `${card.id}-${toSnake(tcgType)}`;
        if (existingIds.has(pid)) priceMap.set(pid, { price_usd: market });
      }
    }

    if (!cards.length || fetched >= totalCount) break;
    page++;
  }

  return priceMap.size > 0 ? { map: priceMap, requestsUsed } : null;
}

// ── Source 3: PokemonPriceTracker ────────────────────────────────────────────
// Returns { map: Map<printingId, {price_usd}>, requestsUsed } | null
// One request per unique card ID (set_id-cardNumber), batched 20 in parallel.
async function tryPpt(setId, allPrintings) {
  if (!process.env.POKEMON_PRICE_TRACKER_KEY) return null;

  // Group printings by TCG card ID so we can map prices back to all variants
  const byCardId = new Map(); // "${setId}-${cardNumber}" → [printingId, ...]
  for (const p of allPrintings) {
    const cardId = `${setId}-${p.card_number}`;
    if (!byCardId.has(cardId)) byCardId.set(cardId, []);
    byCardId.get(cardId).push(p.id);
  }

  const priceMap = new Map();
  let requestsUsed = 0;
  const cardIds = [...byCardId.keys()];
  const PARALLEL = 20;

  for (let i = 0; i < cardIds.length; i += PARALLEL) {
    const batch = cardIds.slice(i, i + PARALLEL);
    await Promise.all(
      batch.map(async (cardId) => {
        try {
          const res = await fetch(
            `${PPT_BASE}/cards?tcgPlayerId=${encodeURIComponent(cardId)}&includeHistory=false`,
            {
              headers: {
                Authorization: `Bearer ${process.env.POKEMON_PRICE_TRACKER_KEY}`,
                Accept: "application/json",
              },
            }
          );
          requestsUsed++;
          if (!res.ok) return;
          const json = await res.json();
          // PPT returns data as object (valid ID) or empty array (unknown ID)
          const cardData = Array.isArray(json.data) ? json.data[0] : json.data;
          const market = cardData?.prices?.tcgplayer?.market_price ?? null;
          if (market == null || market <= 0) return;
          for (const pid of byCardId.get(cardId)) {
            priceMap.set(pid, { price_usd: market });
          }
        } catch {
          // silent per-card failure — continue
        }
      })
    );
    if (i + PARALLEL < cardIds.length) await sleep(200);
  }

  return priceMap.size > 0 ? { map: priceMap, requestsUsed } : null;
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
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

  let setIds;
  try {
    ({ setIds } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(setIds) || setIds.length === 0) {
    return Response.json({ error: "setIds required" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const slugMap = await getSlugCache();
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

  console.log(`[Pricing] Session total API requests: ${totalRequests}`);
  return Response.json({ results, totalRequests });
}

// ── processSet ───────────────────────────────────────────────────────────────
async function processSet(admin, userId, setId, slugMap) {
  // 1. Load printings + owned entries + set name
  const [
    { data: allPrintings, error: pErr },
    { data: owned,        error: oErr },
    { data: setRow },
  ] = await Promise.all([
    admin.from("printings")
      .select("id, card_number, printing_label, price_usd")
      .eq("set_id", setId),
    admin.from("collection_entries")
      .select("printing_id")
      .eq("user_id", userId)
      .eq("set_id", setId)
      .eq("checked", true),
    admin.from("sets").select("name").eq("id", setId).maybeSingle(),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (oErr) throw new Error(oErr.message);

  const printings = allPrintings ?? [];
  const ownedIds = new Set((owned ?? []).map((e) => e.printing_id));
  const previousValue = printings
    .filter((p) => ownedIds.has(p.id))
    .reduce((s, p) => s + (Number(p.price_usd) || 0), 0);

  // 2. Waterfall — PokeTrace → pokemontcg.io → PokemonPriceTracker
  const setName = setRow?.name ?? "";
  // ME sets: no PokeTrace singles data — start at source 2
  const slug = ME_SETS.has(setId) ? null : (slugMap[setName.toLowerCase()] ?? null);

  let result = null;
  let priceSource = "none";
  let requestsUsed = 0;

  if (slug) {
    result = await tryPokeTrace(slug, printings);
    if (result) {
      priceSource = "poketrace";
      requestsUsed += result.requestsUsed;
    }
  }

  if (!result) {
    result = await tryPtcgio(setId, printings);
    if (result) {
      priceSource = "ptcgio";
      requestsUsed += result.requestsUsed;
    }
  }

  if (!result) {
    result = await tryPpt(setId, printings);
    if (result) {
      priceSource = "ppt";
      requestsUsed += result.requestsUsed;
    }
  }

  console.log(
    `[Pricing] ${setId}: source=${priceSource}, ` +
    `priced=${result?.map.size ?? 0}/${printings.length} printings, ` +
    `${requestsUsed} API requests`
  );

  if (!result) {
    return {
      setId, cardsUpdated: 0, previousValue,
      newValue: previousValue, requestsUsed, priceSource,
    };
  }

  // 3. Build upsert rows from the winning source's price map
  const updates = [];
  for (const [pid, prices] of result.map) {
    updates.push({ id: pid, ...prices, updated_at: new Date().toISOString() });
  }

  // Log first 5 for monitoring
  console.log(`[Pricing] ${setId} (${priceSource}) first 5 updates:`);
  updates.slice(0, 5).forEach((u) =>
    console.log(`  ${u.id}: USD ${u.price_usd ?? "—"} / EUR ${u.price_eur ?? "—"}`)
  );

  // 4. Bulk-upsert in batches of 200
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: uErr } = await admin
      .from("printings")
      .upsert(updates.slice(i, i + BATCH), { onConflict: "id" });
    if (uErr) throw new Error(uErr.message);
  }

  // 5. Compute new collection value with updated prices
  const updatedMap = new Map(updates.map((u) => [u.id, u]));
  const newValue = printings
    .filter((p) => ownedIds.has(p.id))
    .reduce((s, p) => {
      const upd = updatedMap.get(p.id);
      return s + (upd?.price_usd ?? Number(p.price_usd) ?? 0);
    }, 0);

  // 6. Stamp user_sets with previous_value + refresh timestamp
  await admin
    .from("user_sets")
    .update({
      previous_value: previousValue,
      prices_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("set_id", setId);

  return { setId, cardsUpdated: updates.length, previousValue, newValue, requestsUsed, priceSource };
}
