import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TCG_KEY = process.env.POKEMON_TCG_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !TCG_KEY) {
  console.error("Missing env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const PRINTING_MAP = [
  { key: "normal", type: "normal", label: "Normal", order: 0 },
  { key: "holofoil", type: "holofoil", label: "Holo", order: 1 },
  { key: "reverseHolofoil", type: "reverse_holofoil", label: "Reverse Holo", order: 2 },
  { key: "1stEditionNormal", type: "first_edition_normal", label: "1st Ed. Normal", order: 3 },
  { key: "1stEditionHolofoil", type: "first_edition_holofoil", label: "1st Ed. Holo", order: 4 },
  { key: "unlimitedHolofoil", type: "unlimited_holofoil", label: "Unlimited Holo", order: 5 },
  { key: "unlimited", type: "unlimited", label: "Unlimited", order: 6 },
];

function detectPatternPrinting(card) {
  const name = (card.name || "").toLowerCase();
  const url = (card.tcgplayer?.url || "").toLowerCase();
  if (name.includes("pokéball pattern") || name.includes("poké ball pattern") || url.includes("pokeball")) {
    return { type: "pokeball_reverse", label: "Pokéball Reverse", order: 10 };
  }
  if (name.includes("master ball pattern") || name.includes("masterball pattern") || url.includes("masterball")) {
    return { type: "masterball_reverse", label: "Masterball Reverse", order: 11 };
  }
  return null;
}

async function fetchAllCards(filterSetId) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let q = supabase
      .from("cards")
      .select("id, set_id, number, name, image_large, price_usd")
      .order("set_id", { ascending: true })
      .order("number", { ascending: true })
      .range(from, from + pageSize - 1);
    if (filterSetId) q = q.eq("set_id", filterSetId);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
    console.log(`  Loaded ${all.length} cards so far...`);
  }
  return all;
}

async function main() {
  const onlySet = process.argv[2];

  const cards = await fetchAllCards(onlySet);
  console.log(`Loaded ${cards.length} cards total.`);

  const byKey = {};
  for (const c of cards) {
    const k = `${c.set_id}::${c.number}`;
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(c);
  }

  const headers = { "X-Api-Key": TCG_KEY };
  const printingsToInsert = [];
  let processedCount = 0;
  const totalGroups = Object.keys(byKey).length;

  for (const [key, cardGroup] of Object.entries(byKey)) {
    const [setId, numStr] = key.split("::");
    const cardNumber = parseInt(numStr, 10);

    for (const card of cardGroup) {
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards/${card.id}`, { headers });
        if (!res.ok) {
          console.error(`  ${card.id} fetch failed: ${res.status}`);
          continue;
        }
        const json = await res.json();
        const apiCard = json.data;
        const prices = apiCard.tcgplayer?.prices || {};

        const pattern = detectPatternPrinting(apiCard);
        if (pattern) {
          const basePrice = prices.reverseHolofoil?.market || prices.holofoil?.market || prices.normal?.market || null;
          printingsToInsert.push({
            id: `${card.id}-${pattern.type}`,
            card_id: card.id,
            set_id: setId,
            card_number: cardNumber,
            printing_type: pattern.type,
            printing_label: pattern.label,
            display_order: pattern.order,
            price_usd: basePrice,
            image_url: apiCard.images?.large || null,
            updated_at: new Date().toISOString(),
          });
          continue;
        }

        for (const map of PRINTING_MAP) {
          const priceObj = prices[map.key];
          if (!priceObj) continue;
          printingsToInsert.push({
            id: `${card.id}-${map.type}`,
            card_id: card.id,
            set_id: setId,
            card_number: cardNumber,
            printing_type: map.type,
            printing_label: map.label,
            display_order: map.order,
            price_usd: priceObj.market || priceObj.mid || null,
            image_url: null,
            updated_at: new Date().toISOString(),
          });
        }

        if (!Object.keys(prices).length) {
          printingsToInsert.push({
            id: `${card.id}-normal`,
            card_id: card.id,
            set_id: setId,
            card_number: cardNumber,
            printing_type: "normal",
            printing_label: "Normal",
            display_order: 0,
            price_usd: card.price_usd,
            image_url: null,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error(`  ${card.id} error: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`  ${processedCount}/${totalGroups} card groups processed (${printingsToInsert.length} printings queued)`);
    }
  }

  console.log(`Inserting ${printingsToInsert.length} printing rows...`);

  for (let i = 0; i < printingsToInsert.length; i += 100) {
    const chunk = printingsToInsert.slice(i, i + 100);
    const { error: upErr } = await supabase
      .from("printings")
      .upsert(chunk, { onConflict: "id" });
    if (upErr) {
      console.error(`  Chunk ${i} failed: ${upErr.message}`);
    } else {
      console.log(`  ${Math.min(i + 100, printingsToInsert.length)}/${printingsToInsert.length}`);
    }
  }

  console.log("Printings seeded.");
}

main().catch((err) => { console.error(err); process.exit(1); });
