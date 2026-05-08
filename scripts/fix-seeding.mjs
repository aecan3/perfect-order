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
const tcgHeaders = { "X-Api-Key": TCG_KEY };

// ── helpers (shared with patch-set.mjs) ──────────────────────────────────────

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
      { type: "normal",          label: "Non-Holo",    order: 0, priceMultiplier: 1   },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.5 },
    ];
  }
  if (r === "rare") {
    return [
      { type: "holofoil",        label: "Holo",        order: 1, priceMultiplier: 1   },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.3 },
    ];
  }
  return [{ type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 }];
}

// ── data fetchers ─────────────────────────────────────────────────────────────

async function getAllSets() {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("sets")
      .select("id, name, total, total_with_secrets")
      .range(from, from + 999)
      .order("id");
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function getCardCountsPerSet() {
  const counts = {};
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("set_id")
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data) counts[row.set_id] = (counts[row.set_id] || 0) + 1;
    if (data.length < 1000) break;
    from += 1000;
  }
  return counts;
}

async function getExistingCards(setId) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, number")
      .eq("set_id", setId)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function fetchCardsFromApi(setId) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250&orderBy=number`,
      { headers: tcgHeaders }
    );
    if (!res.ok) throw new Error(`API ${res.status} for ${setId} page ${page}`);
    const data = await res.json();
    all.push(...data.data);
    if (data.data.length < 250) break;
    page++;
  }
  return all;
}

// ── patch one set ─────────────────────────────────────────────────────────────

async function patchSet(setId, beforeCount) {
  // Fetch from API
  let apiCards;
  try {
    apiCards = await fetchCardsFromApi(setId);
  } catch (e) {
    return { added: 0, printingsAdded: 0, error: e.message };
  }

  if (apiCards.length === 0) {
    return { added: 0, printingsAdded: 0, apiEmpty: true };
  }

  // Deduplicate API response by ID
  const seenApiIds = new Set();
  const uniqueApiCards = apiCards.filter((c) => {
    if (seenApiIds.has(c.id)) return false;
    seenApiIds.add(c.id);
    return true;
  });

  const existing = await getExistingCards(setId);
  const existingIds = new Set(existing.map((c) => c.id));
  const existingNumbers = new Set(existing.map((c) => c.number));

  // Skip cards already present by ID *or* by card number — existing rows may
  // have been seeded from a different source with different IDs but same numbers.
  const newCards = uniqueApiCards.filter((c) => {
    if (existingIds.has(c.id)) return false;
    const num = parseCardNumber(c.number, 0);
    if (existingNumbers.has(num)) return false;
    return true;
  });
  if (newCards.length === 0) {
    return { added: 0, printingsAdded: 0, apiHasNoNew: true };
  }

  // Build card rows
  const rows = newCards.map((c, i) => ({
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

  // Resolve number conflicts — seed maxNum above ALL numbers (existing + new batch)
  // so reassigned slots never collide with legitimate numbers in the same insert.
  let maxNum = Math.max(
    existing.reduce((m, c) => Math.max(m, c.number), 0),
    rows.reduce((m, r) => Math.max(m, r.number), 0)
  );
  const seenNumbers = new Set(existingNumbers);
  for (const row of rows) {
    if (seenNumbers.has(row.number)) {
      maxNum++;
      row.number = maxNum;
    } else {
      seenNumbers.add(row.number);
    }
  }

  // Insert cards in chunks
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("cards").insert(rows.slice(i, i + 100));
    if (error) return { added: 0, printingsAdded: 0, error: error.message };
  }

  // Build and insert printings
  const printingRows = [];
  for (const card of rows) {
    for (const p of printingsForRarity(card.rarity)) {
      printingRows.push({
        id: `${card.id}-${p.type}`,
        card_id: card.id,
        set_id: setId,
        card_number: card.number,
        printing_type: p.type,
        printing_label: p.label,
        display_order: p.order,
        price_usd: card.price_usd ? Number((card.price_usd * p.priceMultiplier).toFixed(2)) : null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  for (let i = 0; i < printingRows.length; i += 100) {
    const { error } = await supabase.from("printings").insert(printingRows.slice(i, i + 100));
    if (error) return { added: rows.length, printingsAdded: 0, error: `printings: ${error.message}` };
  }

  return { added: rows.length, printingsAdded: printingRows.length };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching sets and card counts...");
  const [sets, counts] = await Promise.all([getAllSets(), getCardCountsPerSet()]);

  // Only sets where actual < total_with_secrets (genuine gaps)
  const gapped = sets
    .map((s) => ({
      ...s,
      actual: counts[s.id] || 0,
      target: s.total_with_secrets || s.total || 0,
    }))
    .filter((s) => s.actual < s.target)
    .sort((a, b) => (b.target - b.actual) - (a.target - a.actual));

  if (gapped.length === 0) {
    console.log("No gaps found — all sets complete.");
    return;
  }

  const idW = Math.max(...gapped.map((s) => s.id.length), 6);
  console.log(`\nFound ${gapped.length} sets with gaps (actual < total_with_secrets). Processing largest first.\n`);
  console.log(` ${"set_id".padEnd(idW)} │ before │ target │    gap │ after  │ added  │ note`);
  console.log(`─${"─".repeat(idW)}─┼────────┼────────┼────────┼────────┼────────┼──────`);

  const needsLimitless = [];
  const errors = [];
  let totalAdded = 0;
  let totalPrintingsAdded = 0;

  for (const s of gapped) {
    process.stdout.write(` ${s.id.padEnd(idW)} │ ${String(s.actual).padStart(6)} │ ${String(s.target).padStart(6)} │ ${String(s.target - s.actual).padStart(6)} │`);

    const result = await patchSet(s.id, s.actual);

    const after = s.actual + (result.added || 0);
    const addedStr = result.added > 0 ? `+${result.added}` : "  0";
    process.stdout.write(` ${String(after).padStart(6)} │ ${addedStr.padStart(6)} │`);

    if (result.error) {
      console.log(` ERROR: ${result.error}`);
      errors.push({ id: s.id, error: result.error });
    } else if (result.apiEmpty) {
      console.log(` ⚠ API returned 0 cards — needs Limitless fallback`);
      needsLimitless.push(s.id);
    } else if (result.apiHasNoNew) {
      console.log(` ⚠ API has cards but none are new — needs Limitless fallback`);
      needsLimitless.push(s.id);
    } else {
      const remaining = s.target - after;
      const note = remaining > 0 ? `still missing ${remaining}` : "✅";
      console.log(` ${note}`);
      totalAdded += result.added;
      totalPrintingsAdded += result.printingsAdded;
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Total cards added:     ${totalAdded}`);
  console.log(`  Total printings added: ${totalPrintingsAdded}`);
  console.log(`  Sets processed:        ${gapped.length}`);

  if (needsLimitless.length > 0) {
    console.log(`\n  ⚠ Needs Limitless fallback (pokemontcg.io has no data):`);
    needsLimitless.forEach((id) => console.log(`    ${id}`));
  }

  if (errors.length > 0) {
    console.log(`\n  ✗ Errors:`);
    errors.forEach(({ id, error }) => console.log(`    ${id}: ${error}`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
