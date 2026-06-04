/**
 * Price base1 first_edition, first_edition_holofoil, shadowless, and shadowless_holofoil
 * printings from PPT setId=1663 (the "Shadowless" TCGPlayer set, which carries both
 * 1st Edition and Unlimited/Shadowless variant families for Base Set cards).
 *
 * Single-path design:
 *   GET /api/v2/cards?setId=1663  (paginated)
 *   first_edition        ← variants["1st Edition"]         — first condition entry .price
 *   first_edition_holofoil← variants["1st Edition Holofoil"]— first condition entry .price
 *   shadowless           ← variants["Unlimited"]           — first condition entry .price
 *   shadowless_holofoil  ← variants["Unlimited Holofoil"]  — first condition entry .price
 *
 * No pokemontcg.io resolution needed — PPT setId=1663 is fetched directly.
 * Dry-run with --dry to print updates without writing.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY = process.argv.includes("--dry");
const PPT_BASE = "https://www.pokemonpricetracker.com/api/v2";
const PPT_SET_ID = 1663;
const SET_ID = "base1";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Returns the Near Mint price from a PPT variant family (first condition entry).
function firstConditionPrice(variants, key) {
  const family = variants?.[key];
  if (!family) return null;
  const first = Object.values(family)[0];
  return (first?.price > 0) ? first.price : null;
}

async function fetchPptSet() {
  const allProducts = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${PPT_BASE}/cards?setId=${PPT_SET_ID}&limit=50&offset=${offset}&includeHistory=false`,
      {
        headers: {
          Authorization: `Bearer ${process.env.POKEMON_PRICE_TRACKER_KEY}`,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) throw new Error(`PPT ${res.status} at offset ${offset}`);
    const json = await res.json();
    const products = json.data ?? [];
    allProducts.push(...products);
    if (!json.metadata?.hasMore) break;
    offset += 50;
  }
  return allProducts;
}

async function main() {
  console.log(`[base1 pricing] Fetching PPT setId=${PPT_SET_ID}...`);
  const products = await fetchPptSet();
  console.log(`[base1 pricing] ${products.length} products fetched from PPT`);

  // Build cardNumber → prices map from PPT response
  const pptByNumber = new Map();
  for (const product of products) {
    const raw = String(product.cardNumber ?? "").split("/")[0];
    const num = parseInt(raw, 10);
    if (isNaN(num)) continue;
    // Keep first product seen per card number (there should be one per card)
    if (!pptByNumber.has(num)) pptByNumber.set(num, product.prices);
  }
  console.log(`[base1 pricing] ${pptByNumber.size} unique card numbers mapped`);

  // Load base1 edition printings from DB
  const { data: printings, error } = await supabase
    .from("printings")
    .select("id, card_number, printing_type")
    .eq("set_id", SET_ID)
    .in("printing_type", ["first_edition", "first_edition_holofoil", "shadowless", "shadowless_holofoil"]);

  if (error) throw new Error(error.message);
  console.log(`[base1 pricing] ${printings.length} edition printings loaded from DB`);

  // Map printing_type to PPT variant family key
  const VARIANT_KEY = {
    first_edition:          "1st Edition",
    first_edition_holofoil: "1st Edition Holofoil",
    shadowless:             "Unlimited",
    shadowless_holofoil:    "Unlimited Holofoil",
  };

  const updates = [];
  const stats = { first_edition: 0, first_edition_holofoil: 0, shadowless: 0, shadowless_holofoil: 0 };
  const misses = { first_edition: 0, first_edition_holofoil: 0, shadowless: 0, shadowless_holofoil: 0 };

  for (const p of printings) {
    const prices = pptByNumber.get(p.card_number);
    if (!prices) { misses[p.printing_type]++; continue; }
    const variantKey = VARIANT_KEY[p.printing_type];
    const price = firstConditionPrice(prices.variants, variantKey);
    if (price == null) { misses[p.printing_type]++; continue; }
    updates.push({ id: p.id, price_usd: price, updated_at: new Date().toISOString() });
    stats[p.printing_type]++;
  }

  console.log("\n[base1 pricing] Hit rates:");
  for (const type of Object.keys(stats)) {
    const total = stats[type] + misses[type];
    console.log(`  ${type}: ${stats[type]}/${total} priced`);
  }

  // Spot-check Charizard (card 4)
  const charizardPrices = pptByNumber.get(4);
  if (charizardPrices) {
    console.log("\n[spot-check] Charizard #4:");
    for (const [key, label] of [
      ["1st Edition Holofoil", "first_edition_holofoil"],
      ["Unlimited Holofoil",   "shadowless_holofoil (shadowless)"],
    ]) {
      const price = firstConditionPrice(charizardPrices.variants, key);
      console.log(`  ${label}: $${price ?? "null"}`);
    }
    // Also show unlimited_holofoil (existing) market price for comparison
    console.log(`  PPT market (unlimited_holofoil baseline): $${charizardPrices.market ?? "null"}`);
  }

  if (DRY) {
    console.log(`\n[DRY RUN] Would write ${updates.length} price updates. Exiting.`);
    return;
  }

  if (updates.length === 0) {
    console.log("\n[base1 pricing] No prices to write.");
    return;
  }

  // Write prices in batches of 20
  console.log(`\n[base1 pricing] Writing ${updates.length} prices...`);
  const BATCH = 20;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await Promise.all(
      batch.map(({ id, ...fields }) =>
        supabase.from("printings").update(fields).eq("id", id)
      )
    );
  }
  console.log("[base1 pricing] Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
