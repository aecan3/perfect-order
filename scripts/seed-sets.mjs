import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TCG_KEY = process.env.POKEMON_TCG_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !TCG_KEY) {
  console.error("Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POKEMON_TCG_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const headers = { "X-Api-Key": TCG_KEY };

async function fetchAllSets() {
  const res = await fetch("https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250", { headers });
  if (!res.ok) throw new Error(`Sets fetch failed: ${res.status}`);
  const data = await res.json();
  return data.data;
}

async function fetchCardsForSet(setId) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250&orderBy=number`,
      { headers }
    );
    if (!res.ok) throw new Error(`Cards fetch failed for ${setId}: ${res.status}`);
    const data = await res.json();
    all.push(...data.data);
    if (data.data.length < 250) break;
    page++;
  }
  return all;
}

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

async function upsertSet(set) {
  const preferredCode = (set.ptcgoCode || set.id).toUpperCase().slice(0, 8);
  const row = {
    id: set.id,
    code: preferredCode,
    name: set.name,
    series: set.series,
    total: set.printedTotal || set.total || 0,
    total_with_secrets: set.total || set.printedTotal || 0,
    release_date: set.releaseDate ? set.releaseDate.replaceAll("/", "-") : null,
    logo_url: set.images?.logo || null,
    symbol_url: set.images?.symbol || null,
  };
  const { error } = await supabase.from("sets").upsert(row, { onConflict: "id" });
  if (!error) return;

  // Detect a ptcgoCode collision on sets_code_key (two sets sharing the same ptcgoCode,
  // e.g. swsh12pt5 and swsh12pt5gg both use "CRZ"). Auto-disambiguate by falling back to
  // the set's own ID as the code — set IDs are always unique, so this never collides.
  //
  // SCHEMA NOTE (not changed here): sets_code_key may be too strict. pokemontcg.io
  // legitimately assigns the same ptcgoCode to companion sub-sets. If "code" is meant
  // as a human-readable display label (not a lookup key), uniqueness prevents showing
  // the real code for companion sets. Worth a deliberate schema decision.
  if (error.message.includes("sets_code_key")) {
    const fallbackCode = set.id.toUpperCase().slice(0, 8);
    console.warn(`    ⚠ Code collision: ${set.id} wanted code "${preferredCode}" (already taken by another set). Retrying with "${fallbackCode}".`);
    row.code = fallbackCode;
    const { error: retryError } = await supabase.from("sets").upsert(row, { onConflict: "id" });
    if (retryError) throw new Error(`Failed to upsert set ${set.id} even with fallback code "${fallbackCode}": ${retryError.message}`);
    return;
  }

  throw new Error(`Failed to upsert set ${set.id}: ${error.message}`);
}

async function upsertCards(setId, cards) {
  // Filter out cards that belong to a different set — pokemontcg.io bundles sub-set cards
  // (trainer galleries, companion sub-sets) into the parent set's response. Each card carries
  // its true set identity in c.set.id. Seeding them here under setId would mis-file them;
  // seed those sub-sets explicitly instead.
  const foreignCards = cards.filter((c) => c.set?.id && c.set.id !== setId);
  if (foreignCards.length > 0) {
    const foreignSetIds = [...new Set(foreignCards.map((c) => c.set?.id))].sort().join(", ");
    console.warn(`    ⚠ Skipping ${foreignCards.length} card(s) belonging to sub-set(s) [${foreignSetIds}] bundled in the ${setId} response — seed those sets separately.`);
  }
  const ownCards = cards.filter((c) => !c.set?.id || c.set.id === setId);

  const rows = ownCards.map((c, i) => ({
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

  // Deduplicate by number — some sets have promos/trainer-gallery cards whose
  // raw numbers (e.g. "TG1") parse to the same integer as a base card ("1").
  // Keep the first occurrence and renumber extras sequentially after the max.
  const seenNumbers = new Map();
  let maxNum = rows.reduce((m, r) => Math.max(m, r.number), 0);
  for (const row of rows) {
    if (seenNumbers.has(row.number)) {
      maxNum += 1;
      row.number = maxNum;
    } else {
      seenNumbers.set(row.number, true);
    }
  }

  // Delete existing rows first to avoid (set_id, number) unique constraint conflicts
  // when re-seeding a set whose card IDs may have changed.
  await supabase.from("cards").delete().eq("set_id", setId);

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from("cards").insert(chunk);
    if (error) throw new Error(`Failed to insert cards for ${setId} chunk ${i}: ${error.message}`);
  }
}

async function main() {
  console.log("Fetching all sets...");
  const sets = await fetchAllSets();
  console.log(`Found ${sets.length} sets.`);

  const onlySet = process.argv[2];
  const targets = onlySet ? sets.filter((s) => s.id === onlySet) : sets;

  if (onlySet && targets.length === 0) {
    console.error(`No set found with id "${onlySet}".`);
    process.exit(1);
  }

  const failed = [];
  for (let i = 0; i < targets.length; i++) {
    const set = targets[i];
    try {
      await upsertSet(set);
      console.log(`[${i + 1}/${targets.length}] ${set.name} (${set.id}) — set row done, fetching cards...`);
      const cards = await fetchCardsForSet(set.id);
      await upsertCards(set.id, cards);
      console.log(`    ✓ ${cards.length} card(s) from API (own-set only) inserted/updated`);
    } catch (err) {
      console.error(`    ✗ ${set.id} failed: ${err.message}`);
      failed.push(set.id);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} set(s) failed: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
