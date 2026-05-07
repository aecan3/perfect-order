import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Returns the array of printings for a card based on its rarity.
function printingsForRarity(rarity) {
  const r = (rarity || "").toLowerCase();

  // Common / Uncommon — Non-Holo + Reverse Holo
  if (r === "common" || r === "uncommon") {
    return [
      { type: "normal", label: "Non-Holo", order: 0, priceMultiplier: 1 },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.5 },
    ];
  }

  // Rare (Pokémon TCG "Rare Holo" cards) — Holo + Reverse Holo
  if (r === "rare") {
    return [
      { type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.3 },
    ];
  }

  // Everything else (Double Rare, Illustration Rare, Ultra Rare, SIR, Hyper Rare) — single Holo
  return [{ type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 }];
}

async function main() {
  const setId = process.argv[2];
  if (!setId) {
    console.error("Usage: node scripts/seed-manual-printings.mjs <set_id>");
    console.error("Example: node scripts/seed-manual-printings.mjs me3");
    process.exit(1);
  }

  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, number, rarity, price_usd")
    .eq("set_id", setId)
    .order("number", { ascending: true });

  if (error) throw error;
  if (!cards || cards.length === 0) {
    console.error(`No cards found for set "${setId}".`);
    process.exit(1);
  }

  console.log(`Seeding printings for ${cards.length} cards in ${setId}...`);

  await supabase.from("printings").delete().eq("set_id", setId);

  const rows = [];
  for (const card of cards) {
    const basePrice = card.price_usd || null;
    const printings = printingsForRarity(card.rarity);

    for (const p of printings) {
      rows.push({
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

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error: insErr } = await supabase.from("printings").insert(chunk);
    if (insErr) throw insErr;
  }

  console.log(`Inserted ${rows.length} printing rows for ${setId}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
