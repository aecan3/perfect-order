/**
 * Price unpriced first_edition and first_edition_holofoil rows in WOTC sets
 * (base3, gym2, neo2, neo3, neo4) using the standard ptcgio → PPT resolution path.
 *
 * Uses the same pptVariantPrice logic as refresh-prices/route.js (now patched for
 * first_edition / first_edition_holofoil variant keys).
 *
 * Dry-run with --dry to print updates without writing.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY = process.argv.includes("--dry");
const PTCG_BASE = "https://api.pokemontcg.io/v2/cards";
const PPT_BASE  = "https://www.pokemonpricetracker.com/api/v2";
const FETCH_MS  = 12_000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mirrors the patched pptVariantPrice in refresh-prices/route.js
function pptVariantPrice(printingId, setId, cardNumber, prices) {
  const prefix = `${setId}-${cardNumber}-`;
  const type = printingId.startsWith(prefix) ? printingId.slice(prefix.length) : "";
  const v = prices.variants ?? {};
  const firstConditionPrice = (key) => {
    const conditions = v[key];
    if (!conditions) return null;
    const first = Object.values(conditions)[0];
    return first?.price > 0 ? first.price : null;
  };
  switch (type) {
    case "normal":                 return v["Normal"]?.["Near Mint"]?.price                      ?? prices.market ?? null;
    case "holofoil":               return v["Holofoil"]?.["Near Mint Holofoil"]?.price            ?? prices.market ?? null;
    case "reverse_holofoil":       return v["Reverse Holofoil"]?.["Near Mint Reverse Holofoil"]?.price ?? prices.market ?? null;
    case "first_edition":          return firstConditionPrice("1st Edition")                     ?? prices.market ?? null;
    case "first_edition_holofoil": return firstConditionPrice("1st Edition Holofoil")            ?? prices.market ?? null;
    case "shadowless":             return firstConditionPrice("Unlimited")                        ?? prices.market ?? null;
    case "shadowless_holofoil":    return firstConditionPrice("Unlimited Holofoil")               ?? prices.market ?? null;
    default:                       return prices.market ?? null;
  }
}

async function main() {
  // 1. Load all unpriced first_edition / first_edition_holofoil rows in WOTC sets
  const TARGET_SETS = ["base3", "gym2", "neo2", "neo3", "neo4"];
  const { data: printings, error } = await supabase
    .from("printings")
    .select("id, set_id, card_number, printing_type")
    .in("set_id", TARGET_SETS)
    .in("printing_type", ["first_edition", "first_edition_holofoil"])
    .is("price_usd", null);

  if (error) throw new Error(error.message);
  console.log(`[gap pricing] ${printings.length} unpriced rows to target`);

  // Group by set_id → card_number → [printing rows]
  const bySet = new Map();
  for (const p of printings) {
    if (!bySet.has(p.set_id)) bySet.set(p.set_id, new Map());
    const byNum = bySet.get(p.set_id);
    if (!byNum.has(p.card_number)) byNum.set(p.card_number, []);
    byNum.get(p.card_number).push(p);
  }

  const allUpdates = [];
  const statsBySet = {};

  for (const [setId, byNum] of bySet) {
    const cardNumbers = [...byNum.keys()];
    statsBySet[setId] = { hit: 0, miss: 0 };
    console.log(`\n[${setId}] Resolving ${cardNumbers.length} card(s) via ptcgio → PPT...`);

    // 2. Fetch ptcgio cards for this set to get tcgplayer.url
    const tcgCards = [];
    let page = 1, fetched = 0, totalCount = Infinity;
    while (fetched < totalCount) {
      const res = await fetch(
        `${PTCG_BASE}?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}&select=id,number,tcgplayer`,
        {
          headers: { "X-Api-Key": process.env.POKEMON_TCG_API_KEY, Accept: "application/json" },
          signal: AbortSignal.timeout(FETCH_MS),
        }
      );
      if (!res.ok) { console.warn(`  ptcgio ${res.status} for ${setId}`); break; }
      const json = await res.json();
      totalCount = json.totalCount ?? json.count ?? 0;
      tcgCards.push(...(json.data ?? []));
      fetched += json.data?.length ?? 0;
      if (!json.data?.length || fetched >= totalCount) break;
      page++;
    }

    // Filter to only cards we need
    const needed = new Set(cardNumbers.map(String));
    const cardsWithUrl = tcgCards.filter((c) => {
      const num = String(c.number).split("/")[0];
      return needed.has(num) && c.tcgplayer?.url;
    });
    console.log(`  ${cardsWithUrl.length}/${cardNumbers.length} cards have tcgplayer.url`);

    // 3. Resolve numeric product IDs via prices.pokemontcg.io redirect
    const productIdByNumber = new Map();
    await Promise.all(
      cardsWithUrl.map(async (card) => {
        try {
          const res = await fetch(
            `https://prices.pokemontcg.io/tcgplayer/${card.id}`,
            { redirect: "manual", signal: AbortSignal.timeout(FETCH_MS) }
          );
          const location = res.headers.get("location") ?? "";
          const match = location.match(/product\/(\d+)/);
          const num = parseInt(String(card.number).split("/")[0], 10);
          if (match && !isNaN(num)) productIdByNumber.set(num, match[1]);
        } catch {}
      })
    );
    console.log(`  ${productIdByNumber.size} product IDs resolved`);

    // 4. Fetch PPT prices per card
    const updates = [];
    await Promise.all(
      [...productIdByNumber.entries()].map(async ([cardNumber, productId]) => {
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
          if (!res.ok) return;
          const json = await res.json();
          const prices = (Array.isArray(json.data) ? null : json.data)?.prices;
          if (!prices) return;

          for (const p of byNum.get(cardNumber) ?? []) {
            const price = pptVariantPrice(p.id, setId, cardNumber, prices);
            if (price != null && price > 0) {
              updates.push({ id: p.id, price_usd: price, updated_at: new Date().toISOString() });
              statsBySet[setId].hit++;
              console.log(`  ${p.id}: $${price}`);
            } else {
              statsBySet[setId].miss++;
              console.log(`  ${p.id}: no price (variants=${Object.keys(prices.variants ?? {}).join(", ")})`);
            }
          }
        } catch (err) {
          console.warn(`  PPT error for ${setId}-${cardNumber}: ${err.message}`);
          statsBySet[setId].miss += byNum.get(cardNumber)?.length ?? 0;
        }
      })
    );
    allUpdates.push(...updates);
  }

  console.log("\n[gap pricing] Summary:");
  for (const [setId, s] of Object.entries(statsBySet)) {
    console.log(`  ${setId}: ${s.hit} priced, ${s.miss} missed`);
  }
  console.log(`  Total: ${allUpdates.length} updates`);

  if (DRY) {
    console.log("\n[DRY RUN] No writes. Exiting.");
    return;
  }
  if (allUpdates.length === 0) {
    console.log("\n[gap pricing] Nothing to write.");
    return;
  }

  console.log(`\n[gap pricing] Writing ${allUpdates.length} prices...`);
  const BATCH = 20;
  for (let i = 0; i < allUpdates.length; i += BATCH) {
    const batch = allUpdates.slice(i, i + BATCH);
    await Promise.all(
      batch.map(({ id, ...fields }) =>
        supabase.from("printings").update(fields).eq("id", id)
      )
    );
  }
  console.log("[gap pricing] Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
