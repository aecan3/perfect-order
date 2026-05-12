import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// -- API bases ----------------------------------------------------------------
const POKETRACE_BASE  = "https://api.poketrace.com/v1";
const PTCG_BASE       = "https://api.pokemontcg.io/v2/cards";
const PPT_BASE        = "https://www.pokemonpricetracker.com/api/v2";
const POKESCOPE_BASE  = "https://pokescope.app/card";

// ME sets have no PokeTrace individual card data - skip source 1 for these
const ME_SETS = new Set(["me1", "me2", "me2pt5", "me3"]);

// Skip external API fetch if prices were refreshed within this window
const PRICE_STALENESS_MS = 6 * 60 * 60 * 1000; // 6 hours

// pokemontcg.io price key camelCase -> snake_case (builds printing ID suffix)
const toSnake = (s) => s.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);

// Per-request network timeout - any single fetch that takes longer than this
// is aborted and treated as a failure so it can't block the whole pipeline.
const FETCH_MS = 12_000;

// Per-set outer timeout - if an entire set's waterfall hasn't resolved in this
// window (e.g. a source stalls before we can even get to a fetch call), we
// treat that set as failed rather than hanging the Promise.allSettled forever.
const SET_TIMEOUT_MS = 45_000;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);

// -- Per-source health tracking -----------------------------------------------
// In-memory cache that records whether a source returned prices for a given set.
// Survives for the lifetime of the Function instance (Fluid Compute reuses them).
// After 24h the record expires and the source is retried from scratch.
//
// Keys:  "${setId}:${source}"   (source = poketrace | ptcgio | ppt | pokescope)
// Value: { ok: boolean, at: number (timestamp) }
//
// "skip" means: this source returned null for this set on the last attempt.
// "unknown" means: never tried, or the record expired.
const _health = new Map();
const HEALTH_TTL_MS = 24 * 60 * 60 * 1000;

function sourceStatus(setId, source) {
  const entry = _health.get(`${setId}:${source}`);
  if (!entry) return "unknown";
  if (Date.now() - entry.at > HEALTH_TTL_MS) {
    _health.delete(`${setId}:${source}`);
    return "unknown";
  }
  return entry.ok ? "ok" : "skip";
}

function recordSource(setId, source, ok) {
  _health.set(`${setId}:${source}`, { ok, at: Date.now() });
}

// -- PokeTrace slug cache -----------------------------------------------------
// setName.toLowerCase() -> slug; built once, survives instance lifetime (~27 API calls)
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
    } while (cursor);
    _slugCache = map;
    return map;
  })();
  return _slugCachePromise;
}

// -- Source 1: PokeTrace ------------------------------------------------------
// Returns { map: Map<printingId, {price_usd?, price_eur?}>, requestsUsed } | null
// Null when 0 singles found (only sealed products or no data for this tier).
//
// Strategy: probe first with limit=1 and a short timeout (4s). If the probe
// returns no singles or times out, we skip the slug immediately rather than
// waiting up to FETCH_MS for every pagination page to timeout. This turns a
// potential 12s+ hang into a <4s fast-fail for slugs that map to the wrong set
// or to sealed-product-only listings.
async function tryPokeTrace(slug, allPrintings) {
  // -- Probe: verify slug has singles before committing to paginated fetch -----
  const PROBE_MS = 4_000;
  try {
    const probe = await fetch(
      `${POKETRACE_BASE}/cards?set=${encodeURIComponent(slug)}&limit=1`,
      {
        headers: { "X-API-Key": process.env.POKETRACE_API_KEY },
        signal: AbortSignal.timeout(PROBE_MS),
      }
    );
    if (!probe.ok) {
      console.warn(`[PokeTrace] probe ${probe.status} for slug "${slug}" - skipping`);
      return null;
    }
    const probeJson = await probe.json();
    const singles = (probeJson.data ?? []).filter(
      (c) => c.productType !== "sealed" && c.cardNumber != null
    );
    if (singles.length === 0) {
      console.warn(`[PokeTrace] probe: no singles for slug "${slug}" - skipping (sealed-only or wrong slug)`);
      return null;
    }
  } catch (err) {
    console.warn(`[PokeTrace] probe failed for slug "${slug}": ${err.message} - skipping`);
    return null;
  }

  // -- Full paginated fetch (slug verified) ------------------------------------
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

    let res;
    try {
      res = await fetch(url, {
        headers: { "X-API-Key": process.env.POKETRACE_API_KEY },
        signal: AbortSignal.timeout(FETCH_MS),
      });
      requestsUsed++;
    } catch (err) {
      console.warn(`[PokeTrace] fetch error for ${slug} (cursor=${cursor ?? "start"}): ${err.message}`);
      break;
    }
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

// -- Source 2: pokemontcg.io --------------------------------------------------
// Returns { map: Map<printingId, {price_usd}>, requestsUsed } | null
// Matches by printing ID directly (printing type encoded in the ID suffix).
async function tryPtcgio(setId, allPrintings) {
  const existingIds = new Set(allPrintings.map((p) => p.id));
  const priceMap = new Map();
  let page = 1, fetched = 0, totalCount = Infinity, requestsUsed = 0;

  while (fetched < totalCount) {
    let res;
    try {
      res = await fetch(
        `${PTCG_BASE}?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}&select=id,tcgplayer`,
        {
          headers: {
            "X-Api-Key": process.env.POKEMON_TCG_API_KEY,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(FETCH_MS),
        }
      );
      requestsUsed++;
    } catch (err) {
      console.warn(`[ptcgio] fetch error for ${setId} page ${page}: ${err.message}`);
      break;
    }
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

// -- Source 3: PokemonPriceTracker --------------------------------------------
// Returns { map: Map<printingId, {price_usd}>, requestsUsed } | null
// PPT requires numeric TCGPlayer product IDs. Resolution flow per card:
//   pokemontcg.io tcgplayer.url -> prices.pokemontcg.io proxy 302 -> product/{numericId}
// One PPT call per card covers all printing variants via prices.variants map.
async function tryPpt(setId, allPrintings) {
  if (!process.env.POKEMON_PRICE_TRACKER_KEY) return null;

  // Step 1: fetch pokemontcg.io cards to get tcgplayer.url per card
  const tcgCards = [];
  let page = 1, fetched = 0, totalCount = Infinity, requestsUsed = 0;

  while (fetched < totalCount) {
    let res;
    try {
      res = await fetch(
        `${PTCG_BASE}?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}&select=id,number,tcgplayer`,
        {
          headers: { "X-Api-Key": process.env.POKEMON_TCG_API_KEY, Accept: "application/json" },
          signal: AbortSignal.timeout(FETCH_MS),
        }
      );
      requestsUsed++;
    } catch (err) {
      console.warn(`[ppt/ptcgio] fetch error for ${setId} page ${page}: ${err.message}`);
      break;
    }
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
  const productIdByNumber = new Map(); // cardNumber(str) -> numericId(str)
  const cardsWithUrl = tcgCards.filter((c) => c.tcgplayer?.url);

  await Promise.all(
    cardsWithUrl.map(async (card) => {
      try {
        const res = await fetch(
          `https://prices.pokemontcg.io/tcgplayer/${card.id}`,
          { redirect: "manual", signal: AbortSignal.timeout(FETCH_MS) }
        );
        requestsUsed++;
        const location = res.headers.get("location") ?? "";
        const match = location.match(/product\/(\d+)/);
        if (match) productIdByNumber.set(card.number, match[1]);
      } catch {}
    })
  );

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

  await Promise.all(
    entries.map(async ([cardNumber, productId]) => {
      try {
        const res = await fetch(
          `${PPT_BASE}/cards?tcgPlayerId=${encodeURIComponent(productId)}&includeHistory=false`,
          {
            headers: {
              Authorization: `Bearer ${process.env.POKEMON_PRICE_TRACKER_KEY}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(FETCH_MS),
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

// -- DB write helper ----------------------------------------------------------
// UPDATE only - never INSERT. Printing rows are seeded separately; this route
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

// -- Source 4: PokeScope (ME sets only) ---------------------------------------
// Scrapes https://pokescope.app/card/{setId}-{cardNumber} for market price.
// Page contains text like "Market Price (TCG holofoil) $1.11".
// All cards are fetched in parallel.
async function tryPokeScope(setId, allPrintings) {
  const printingsByNumber = new Map();
  for (const p of allPrintings) {
    const num = String(p.card_number);
    if (!printingsByNumber.has(num)) printingsByNumber.set(num, []);
    printingsByNumber.get(num).push(p);
  }

  const numbers = [...printingsByNumber.keys()];
  const priceMap = new Map();
  let requestsUsed = 0;

  await Promise.all(
    numbers.map(async (cardNumber) => {
      try {
        const url = `${POKESCOPE_BASE}/${setId}-${cardNumber}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          signal: AbortSignal.timeout(FETCH_MS),
        });
        requestsUsed++;

        if (!res.ok) {
          console.warn(`[PokeScope] ${res.status} for ${setId}-${cardNumber}`);
          return;
        }

        const html = await res.text();
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
          return;
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
    })
  );

  return priceMap.size > 0 ? { map: priceMap, requestsUsed } : null;
}

// -- POST handler -------------------------------------------------------------
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
  let totalRequests = 0;

  const settled = await Promise.allSettled(
    setIds.map((setId) =>
      withTimeout(
        processSet(admin, user.id, setId, slugMap),
        SET_TIMEOUT_MS,
        setId
      )
    )
  );
  const results = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") {
      totalRequests += outcome.value.requestsUsed ?? 0;
      return outcome.value;
    }
    return { setId: setIds[i], error: outcome.reason?.message ?? "unknown" };
  });

  console.log(`[Pricing] Session total API requests: ${totalRequests}`);
  return Response.json({ results, totalRequests });
}

// -- processSet ---------------------------------------------------------------
async function processSet(admin, userId, setId, slugMap) {
  // 1. Load printings + owned entries + set name
  const [
    { data: allPrintings, error: pErr },
    { data: owned,        error: oErr },
    { data: setRow },
    { data: userSetRow },
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
    admin.from("user_sets").select("prices_updated_at").eq("user_id", userId).eq("set_id", setId).maybeSingle(),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (oErr) throw new Error(oErr.message);

  const printings = allPrintings ?? [];
  const ownedIds = new Set((owned ?? []).map((e) => e.printing_id));
  const previousValue = printings
    .filter((p) => ownedIds.has(p.id))
    .reduce((s, p) => s + (Number(p.price_usd) || 0), 0);
  // 1a. Staleness gate - skip external fetch if prices are recent enough
  const lastUpdated = userSetRow?.prices_updated_at;
  if (lastUpdated && Date.now() - new Date(lastUpdated).getTime() < PRICE_STALENESS_MS) {
    const ageMin = Math.round((Date.now() - new Date(lastUpdated).getTime()) / 60000);
    console.log(`[Pricing] ${setId}: cached (updated ${ageMin}m ago)`);
    return { setId, cardsUpdated: 0, previousValue, newValue: previousValue, requestsUsed: 0, priceSource: "cached" };
  }

  // 2. Waterfall - PokeTrace -> ptcgio -> PPT -> PokeScope (ME only)
  //
  // Source selection is data-driven via health tracking:
  //   - "unknown": never tried, or 24h TTL expired -> attempt
  //   - "ok":      succeeded last time -> attempt (prices may have changed)
  //   - "skip":    returned null last time -> skip until TTL expires
  //
  // PPT is coupled to ptcgio: PPT resolves card prices by numeric TCGPlayer ID
  // which it derives from ptcgio card data. If ptcgio has no data for a set
  // (e.g. custom internal IDs like rsv10pt5 that aren't in ptcgio's DB), PPT
  // will also return nothing. We record both as skip simultaneously.
  const setName = setRow?.name ?? "";
  const slug = ME_SETS.has(setId) ? null : (slugMap[setName.toLowerCase()] ?? null);
  const L = `[${setId}/${setName || "?"}]`;

  console.log(`${L} start: ${printings.length} printings, slug=${slug ?? "none"}, isME=${ME_SETS.has(setId)}`);

  let result = null;
  let priceSource = "none";
  let requestsUsed = 0;

  // -- PokeTrace ---------------------------------------------------------------
  if (slug) {
    const status = sourceStatus(setId, "poketrace");
    if (status === "skip") {
      console.log(`${L} PokeTrace: skipped (returned null within last 24h)`);
    } else {
      const t = Date.now();
      console.log(`${L} PokeTrace: trying slug="${slug}"`);
      try { result = await tryPokeTrace(slug, printings); }
      catch (err) { console.warn(`${L} PokeTrace threw: ${err.message}`); }
      recordSource(setId, "poketrace", result !== null);
      console.log(`${L} PokeTrace: ${result ? `${result.map.size} prices` : "null"} in ${Date.now() - t}ms`);
      if (result) { priceSource = "poketrace"; requestsUsed += result.requestsUsed; }
    }
  }

  // -- pokemontcg.io -----------------------------------------------------------
  if (!result) {
    const status = sourceStatus(setId, "ptcgio");
    if (status === "skip") {
      console.log(`${L} ptcgio: skipped (returned null within last 24h)`);
    } else {
      const t = Date.now();
      console.log(`${L} ptcgio: trying setId="${setId}"`);
      try { result = await tryPtcgio(setId, printings); }
      catch (err) { console.warn(`${L} ptcgio threw: ${err.message}`); }
      const ptcgioOk = result !== null;
      recordSource(setId, "ptcgio", ptcgioOk);
      if (!ptcgioOk) {
        // PPT resolves prices via ptcgio card IDs - no point trying if ptcgio has no data
        recordSource(setId, "ppt", false);
        console.warn(`${L} ptcgio: null in ${Date.now() - t}ms - marking ppt as skip too`);
      } else {
        console.log(`${L} ptcgio: ${result.map.size} prices in ${Date.now() - t}ms`);
        priceSource = "ptcgio";
        requestsUsed += result.requestsUsed;
      }
    }
  }

  // -- PokemonPriceTracker -----------------------------------------------------
  if (!result) {
    const status = sourceStatus(setId, "ppt");
    if (status === "skip") {
      console.log(`${L} PPT: skipped (ptcgio had no data for this set in last 24h)`);
    } else {
      const t = Date.now();
      console.log(`${L} PPT: trying setId="${setId}"`);
      try { result = await tryPpt(setId, printings); }
      catch (err) { console.warn(`${L} PPT threw: ${err.message}`); }
      recordSource(setId, "ppt", result !== null);
      console.log(`${L} PPT: ${result ? `${result.map.size} prices` : "null"} in ${Date.now() - t}ms`);
      if (result) { priceSource = "ppt"; requestsUsed += result.requestsUsed; }
    }
  }

  // -- PokeScope (ME sets only) ------------------------------------------------
  if (!result && ME_SETS.has(setId)) {
    const status = sourceStatus(setId, "pokescope");
    if (status === "skip") {
      console.log(`${L} PokeScope: skipped (returned null within last 24h)`);
    } else {
      const t = Date.now();
      console.log(`${L} PokeScope: trying`);
      try { result = await tryPokeScope(setId, printings); }
      catch (err) { console.warn(`${L} PokeScope threw: ${err.message}`); }
      recordSource(setId, "pokescope", result !== null);
      console.log(`${L} PokeScope: ${result ? `${result.map.size} prices` : "null"} in ${Date.now() - t}ms`);
      if (result) { priceSource = "pokescope"; requestsUsed += result.requestsUsed; }
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
    console.log(`  ${u.id}: USD ${u.price_usd ?? "-"} / EUR ${u.price_eur ?? "-"}`)
  );

  // 4. Update prices on existing printing rows (never insert - rows are seeded separately)
  console.log(`[DB Write] ${setId} (${priceSource}): updating ${updates.length} rows`);
  updates.slice(0, 3).forEach((u) => console.log(`  -> ${u.id}: $${u.price_usd ?? "-"}`));
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

