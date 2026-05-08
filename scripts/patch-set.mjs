import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TCG_KEY = process.env.POKEMON_TCG_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !TCG_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POKEMON_TCG_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const headers = { "X-Api-Key": TCG_KEY };

function parseCardNumber(numStr, fallbackIndex) {
  const m = String(numStr).match(/\d+/);
  if (m) return parseInt(m[0], 10);
  return fallbackIndex + 1;
}

function priceFromCard(card) {
  const tcg = card.tcgplayer?.prices;
  if (!tcg) return null;
  const candidates = [
    tcg.normal?.market,
    tcg.holofoil?.market,
    tcg.reverseHolofoil?.market,
    tcg.firstEditionHolofoil?.market,
    tcg["1stEditionNormal"]?.market,
    tcg.unlimitedHolofoil?.market,
  ];
  for (const p of candidates) {
    if (typeof p === "number" && p > 0) return p;
  }
  return null;
}

function printingsForRarity(rarity) {
  const r = (rarity || "").toLowerCase();
  if (r === "common" || r === "uncommon") {
    return [
      { type: "normal", label: "Non-Holo", order: 0, priceMultiplier: 1 },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.5 },
    ];
  }
  if (r === "rare") {
    return [
      { type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.3 },
    ];
  }
  return [{ type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 }];
}

function toRanges(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const ranges = [];
  let start = null, prev = null;
  for (const n of sorted) {
    if (start === null) { start = n; prev = n; }
    else if (n === prev + 1) { prev = n; }
    else { ranges.push(start === prev ? String(start) : `${start}-${prev}`); start = n; prev = n; }
  }
  if (start !== null) ranges.push(start === prev ? String(start) : `${start}-${prev}`);
  return ranges.join(", ");
}

async function fetchCardsFromApi(setId) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250&orderBy=number`,
      { headers }
    );
    if (!res.ok) throw new Error(`API fetch failed for ${setId} page ${page}: ${res.status}`);
    const data = await res.json();
    all.push(...data.data);
    if (page === 1 || data.data.length === 250) {
      console.log(`  Page ${page}: ${data.data.length} cards (${all.length} total so far)`);
    }
    if (data.data.length < 250) break;
    page++;
  }
  return all;
}

async function main() {
  const setId = process.argv[2];
  if (!setId) {
    console.error("Usage: node scripts/patch-set.mjs <set_id>");
    console.error("Example: node scripts/patch-set.mjs me2pt5");
    process.exit(1);
  }

  console.log(`\n=== Patching ${setId} ===`);

  console.log(`\nFetching all ${setId} cards from pokemontcg.io...`);
  const apiCards = await fetchCardsFromApi(setId);
  console.log(`API total: ${apiCards.length} cards`);

  if (apiCards.length === 0) {
    console.error(`No cards found for "${setId}" in the pokemontcg.io API. Verify the set ID.`);
    process.exit(1);
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("cards")
    .select("id, number")
    .eq("set_id", setId);
  if (fetchErr) throw fetchErr;

  const existingIds = new Set(existing.map((c) => c.id));
  const existingNumbers = new Set(existing.map((c) => c.number));
  console.log(`DB current: ${existing.length} cards`);

  // Deduplicate API response by ID (pokemontcg.io returns exact duplicate entries for some sets)
  const seenApiIds = new Set();
  const uniqueApiCards = apiCards.filter((c) => {
    if (seenApiIds.has(c.id)) return false;
    seenApiIds.add(c.id);
    return true;
  });
  if (uniqueApiCards.length < apiCards.length) {
    console.log(`  (deduplicated ${apiCards.length - uniqueApiCards.length} duplicate API entries → ${uniqueApiCards.length} unique)`);
  }

  const newApiCards = uniqueApiCards.filter((c) => !existingIds.has(c.id));
  console.log(`To insert: ${newApiCards.length} missing cards`);

  if (newApiCards.length === 0) {
    console.log("\nSet is already complete — nothing to patch.");
    return;
  }

  // Build rows
  const rows = newApiCards.map((c, i) => ({
    id: c.id,
    set_id: setId,
    number: parseCardNumber(c.number, i),
    name: c.name,
    rarity: c.rarity || null,
    supertype: c.supertype || null,
    subtypes: c.subtypes || null,
    image_small: c.images?.small || null,
    image_large: c.images?.large || null,
    price_usd: priceFromCard(c),
    updated_at: new Date().toISOString(),
  }));

  // Reassign any card numbers that conflict with existing rows
  let maxNum = existing.reduce((m, c) => Math.max(m, c.number), 0);
  const seenNumbers = new Set(existingNumbers);
  const reassigned = [];
  for (const row of rows) {
    if (seenNumbers.has(row.number)) {
      const orig = row.number;
      maxNum++;
      row.number = maxNum;
      reassigned.push(`  ${row.id}: ${orig} → ${maxNum}`);
    } else {
      seenNumbers.add(row.number);
    }
  }
  if (reassigned.length > 0) {
    console.log(`\nReassigned ${reassigned.length} conflicting number(s):`);
    reassigned.forEach((r) => console.log(r));
  }

  // Insert cards
  console.log(`\nInserting ${rows.length} cards...`);
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error: insErr } = await supabase.from("cards").insert(chunk);
    if (insErr) throw new Error(`Cards insert failed at chunk ${i}: ${insErr.message}`);
    console.log(`  ${Math.min(i + 100, rows.length)}/${rows.length} cards inserted`);
  }

  // Insert printings for new cards only
  const printingRows = [];
  for (const card of rows) {
    const basePrice = card.price_usd || null;
    for (const p of printingsForRarity(card.rarity)) {
      printingRows.push({
        id: `${card.id}-${p.type}`,
        card_id: card.id,
        set_id: setId,
        card_number: card.number,
        printing_type: p.type,
        printing_label: p.label,
        display_order: p.order,
        price_usd: basePrice ? Number((basePrice * p.priceMultiplier).toFixed(2)) : null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  console.log(`\nInserting ${printingRows.length} printings...`);
  for (let i = 0; i < printingRows.length; i += 100) {
    const chunk = printingRows.slice(i, i + 100);
    const { error: insErr } = await supabase.from("printings").insert(chunk);
    if (insErr) throw new Error(`Printings insert failed at chunk ${i}: ${insErr.message}`);
    console.log(`  ${Math.min(i + 100, printingRows.length)}/${printingRows.length} printings inserted`);
  }

  const finalCount = existing.length + rows.length;
  console.log(`\n✓ ${setId} patch complete`);
  console.log(`  Cards added:     ${rows.length}`);
  console.log(`  Printings added: ${printingRows.length}`);
  console.log(`  Total in DB now: ${finalCount}`);
  console.log(`  Patched numbers: ${toRanges(rows.map((r) => r.number))}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
