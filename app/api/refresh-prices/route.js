import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ── API bases ────────────────────────────────────────────────────────────────
const POKETRACE_BASE  = "https://api.poketrace.com/v1";
const PTCG_BASE       = "https://api.pokemontcg.io/v2/cards";
const PPT_BASE        = "https://www.pokemonpricetracker.com/api/v2";
const POKESCOPE_BASE  = "https://pokescope.app/card";

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
// PPT requires numeric TCGPlayer product IDs. Resolution flow per card:
//   pokemontcg.io tcgplayer.url → prices.pokemontcg.io proxy 302 → product/{numericId}
// One PPT call per card covers all printing variants via prices.variants map.
async function tryPpt(setId, allPrintings) {
  if (!process.env.POKEMON_PRICE_TRACKER_KEY) return null;

  // Step 1: fetch pokemontcg.io cards to get tcgplayer.url per card
  const tcgCards = [];
  let page = 1, fetched = 0, totalCount = Infinity, requestsUsed = 0;

  while (fetched < totalCount) {
    const res = await fetch(
      `${PTCG_BASE}?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}&select=id,number,tcgplayer`,
      {
        headers: { "X-Api-Key": process.env.POKEMON_TCG_API_KEY, Accept: "application/json" },
      }
    );
    requestsUsed++;
    if (!res.ok) break;
    const json = await res.json();
    totalCount = json.totalCount ?? json.count ?? 0;
    const cards = json.data ?? [];
    fetched += cards.length;
    tcgCards.push(...cards);
    if (!cards.length || fetched >= totalCount) break;
    page++;
  }

  if (!tcgCards.length) return null;

  // Step 2: follow pokemontcg.io proxy redirects to resolve numeric product IDs
  const productIdByNumber = new Map(); // cardNumber(str) → numericId(str)
  const PARALLEL = 20;
  const cardsWithUrl = tcgCards.filter((c) => c.tcgplayer?.url);

  for (let i = 0; i < cardsWithUrl.length; i += PARALLEL) {
    const batch = cardsWithUrl.slice(i, i + PARALLEL);
    await Promise.all(
      batch.map(async (card) => {
        try {
          const res = await fetch(
            `https://prices.pokemontcg.io/tcgplayer/${card.id}`,
            { redirect: "manual" }
          );
          requestsUsed++;
          const location = res.headers.get("location") ?? "";
          const match = location.match(/product\/(\d+)/);
          if (match) productIdByNumber.set(card.number, match[1]);
        } catch {}
      })
    );
    if (i + PARALLEL < cardsWithUrl.length) await sleep(200);
  }

  if (!productIdByNumber.size) return null;

  // Step 3: group printings by card_number for price mapping
  const printingsByNumber = new Map();
  for (const p of allPrintings) {
    const num = String(p.card_number);
    if (!printingsByNumber.has(num)) printingsByNumber.set(num, []);
    printingsByNumber.get(num).push(p);
  }

  // Step 4: call PPT per card, apply per-variant prices to each printing
  const priceMap = new Map();
  const entries = [...productIdByNumber.entries()];

  for (let i = 0; i < entries.length; i += PARALLEL) {
    const batch = entries.slice(i, i + PARALLEL);
    await Promise.all(
      batch.map(async ([cardNumber, productId]) => {
        try {
          const res = await fetch(
            `${PPT_BASE}/cards?tcgPlayerId=${encodeURIComponent(productId)}&includeHistory=false`,
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
          const prices = (Array.isArray(json.data) ? null : json.data)?.prices;
          if (!prices) return;

          for (const p of printingsByNumber.get(cardNumber) ?? []) {
            const price = pptVariantPrice(p.id, setId, cardNumber, prices);
            if (price != null && price > 0) priceMap.set(p.id, { price_usd: price });
          }
        } catch {}
      })
    );
    if (i + PARALLEL < entries.length) await sleep(200);
  }

  return priceMap.size > 0 ? { map: priceMap, requestsUsed } : null;
}

// Extract per-printing price from a PPT prices object.
// Printing type is derived from the printing ID suffix (after setId-cardNumber-).
function pptVariantPrice(printingId, setId, cardNumber, prices) {
  const prefix = `${setId}-${cardNumber}-`;
  const type = printingId.startsWith(prefix) ? printingId.slice(prefix.length) : "";
  const v = prices.variants ?? {};
  switch (type) {
    case "normal":           return v["Normal"]?.["Near Mint"]?.price           ?? prices.market ?? null;
    case "holofoil":         return v["Holofoil"]?.["Near Mint Holofoil"]?.price ?? prices.market ?? null;
    case "reverse_holofoil": return v["Reverse Holofoil"]?.["Near Mint Reverse Holofoil"]?.price ?? prices.market ?? null;
    default:                 return prices.market ?? null;
  }
}

// ── DB write helper ──────────────────────────────────────────────────────────
// UPDATE only — never INSERT. Printing rows are seeded separately; this route
// only writes price columns on existing rows. Upsert would fail with NOT NULL
// violations on card_id and other required columns.
async function batchUpdate(admin, updates) {
  const PARALLEL = 20;
  for (let i = 0; i < updates.length; i += PARALLEL) {
    const results = await Promise.all(
      updates.slice(i, i + PARALLEL).map(({ id, ...fields }) =>
        admin.from("printings").update(fields).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed) throw new Error(failed.error.message);
  }
}

// ── Source 4: PokeScope (ME sets only) ───────────────────────────────────────
// Scrapes https://pokescope.app/card/{setId}-{cardNumber} for market price.
// Page contains text like "Market Price (TCG holofoil) $1.11".
// Rate limit: 800ms between requests. me2pt5 has 295 cards → ~240s.
// Skips cards that already have a price so partial scrapes resume efficiently.
// flushCallback is called every 25 cards to survive Vercel's 300s function limit.
async function tryPokeScope(setId, allPrintings, flushCallback = null) {
  const printingsByNumber = new Map();
  for (const p of allPrintings) {
    const num = String(p.card_number);
    if (!printingsByNumber.has(num)) printingsByNumber.set(num, []);
    printingsByNumber.get(num).push(p);
  }

  // Skip cards where all printings already have a price — resume from unpriced only
  const numbers = [...printingsByNumber.keys()].filter(
    (num) => !printingsByNumber.get(num).some((p) => p.price_usd > 0)
  );
  const priceMap = new Map();
  let requestsUsed = 0;
  let cardCount = 0;

  for (const cardNumber of numbers) {
    try {
      const url = `${POKESCOPE_BASE}/${setId}-${cardNumber}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
      requestsUsed++;

      if (!res.ok) {
        console.warn(`[PokeScope] ${res.status} for ${setId}-${cardNumber}`);
        await sleep(1000);
        continue;
      }

      const html = await res.text();
      // Scan all "market price" occurrences — the first few are in meta tags (no $).
      // React also injects <!-- --> comment nodes around text, so strip those first.
      // Stop at the first occurrence whose 500-char window contains a dollar amount.
      const lowerHtml = html.toLowerCase();
      let amtMatch = null;
      let searchFrom = 0;
      while (!amtMatch) {
        const mpIdx = lowerHtml.indexOf("market price", searchFrom);
        if (mpIdx === -1) break;
        const segment = html.slice(mpIdx, mpIdx + 500).replace(/<!--.*?-->/g, "");
        amtMatch = segment.match(/\$([\d,]+(?:\.\d{1,2})?)/);
        searchFrom = mpIdx + 1;
      }
      if (!amtMatch) {
        console.warn(`[PokeScope] No price found for ${setId}-${cardNumber}`);
        await sleep(1000);
        continue;
      }

      const marketPrice = parseFloat(amtMatch[1].replace(/,/g, ""));
      console.log(`[PokeScope] ${setId}-${cardNumber}: market=$${marketPrice}`);

      for (const printing of printingsByNumber.get(cardNumber) ?? []) {
        const prefix = `${setId}-${cardNumber}-`;
        const type = printing.id.startsWith(prefix) ? printing.id.slice(prefix.length) : "";
        let price;
        switch (type) {
          case "holofoil":         price = marketPrice;           break;
          case "reverse_holofoil": price = marketPrice * 0.85;    break;
          case "normal":           price = marketPrice * 0.5;     break;
          default:                 price = marketPrice;           break;
        }
        if (price > 0) priceMap.set(printing.id, { price_usd: parseFloat(price.toFixed(2)) });
      }
    } catch (err) {
      console.warn(`[PokeScope] Error for ${setId}-${cardNumber}:`, err.message);
    }

    cardCount++;
    // Flush accumulated prices to DB every 25 cards so progress survives a timeout
    if (flushCallback && cardCount % 25 === 0 && priceMap.size > 0) {
      await flushCallback(new Map(priceMap));
    }

    await sleep(800); // ~1.25 req/second — respectful to a small site
  }

  return priceMap.size > 0 ? { map: priceMap, requestsUsed } : null;
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  const missingVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "POKEMON_TCG_API_KEY",
    "POKETRACE_API_KEY",
  ].filter((k) => !process.env[k]);
  if (missingVars.length > 0) {
    console.error("[Config] Missing env vars:", missingVars.join(", "));
    return Response.json(
      { error: `Missing environment variables: ${missingVars.join(", ")}` },
      { status: 500 }
    );
  }

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

  // 2. Waterfall — PokeTrace → pokemontcg.io → PPT → PokeScope (ME only)
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

  if (!result && ME_SETS.has(setId)) {
    // Flush every 25 cards so prices are persisted even if function times out
    // (me2pt5 has 295 cards × 1s/card ≈ 295s, close to Vercel's 300s limit)
    const pokeFlush = async (partialMap) => {
      const rows = [...partialMap.entries()].map(([id, prices]) => ({
        id, ...prices, updated_at: new Date().toISOString(),
      }));
      console.log(`[PokeScope] Mid-scrape flush: writing ${rows.length} prices to DB`);
      try {
        await batchUpdate(admin, rows);
        console.log(`[PokeScope] Flush OK`);
      } catch (err) {
        console.error(`[PokeScope] Flush error:`, err.message);
      }
    };

    result = await tryPokeScope(setId, printings, pokeFlush);
    if (result) {
      priceSource = "pokescope";
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

  // 4. Update prices on existing printing rows (never insert — rows are seeded separately)
  console.log(`[DB Write] ${setId} (${priceSource}): updating ${updates.length} rows`);
  updates.slice(0, 3).forEach((u) => console.log(`  → ${u.id}: $${u.price_usd ?? "—"}`));
  await batchUpdate(admin, updates);
  console.log(`[DB Write] ${setId}: update complete`);

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
