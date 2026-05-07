import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SET_ID = "me3";
const EX_NUMBERS = new Set([12, 16, 21, 22, 31, 47, 53, 55, 62]);
const PRINTED_TOTAL = 88;

const PRICES_USD = {
  1: 0.12, 2: 0.08, 3: 0.11, 4: 0.08, 5: 0.12, 6: 0.10, 7: 0.13, 8: 0.15,
  9: 0.13, 10: 0.13, 11: 0.13, 12: 0.48, 13: 0.09, 14: 0.16, 15: 0.13, 16: 0.52,
  17: 0.11, 18: 0.08, 19: 0.15, 20: 0.14, 21: 1.04, 22: 0.46, 23: 0.19, 24: 0.15,
  25: 0.09, 26: 0.11, 27: 0.12, 28: 0.11, 29: 0.13, 30: 0.14, 31: 0.61, 32: 0.14,
  33: 0.13, 34: 0.12, 35: 0.08, 36: 0.11, 37: 0.09, 38: 0.12, 39: 0.10, 40: 0.12,
  41: 0.08, 42: 0.15, 43: 0.14, 44: 0.20, 45: 0.23, 46: 0.09, 47: 0.74, 48: 0.16,
  49: 0.21, 50: 0.45, 51: 0.14, 52: 0.06, 53: 0.65, 54: 0.13, 55: 0.57, 56: 0.16,
  57: 0.12, 58: 0.13, 59: 0.11, 60: 0.16, 61: 0.11, 62: 5.13, 63: 0.18, 64: 0.07,
  65: 0.13, 66: 0.11, 67: 0.07, 68: 0.18, 69: 0.16, 70: 0.13, 71: 0.13, 72: 0.13,
  73: 0.10, 74: 0.14, 75: 0.14, 76: 0.16, 77: 0.09, 78: 0.23, 79: 0.13, 80: 0.10,
  81: 0.46, 82: 0.12, 83: 0.15, 84: 0.20, 85: 0.18, 86: 0.23, 87: 0.20, 88: 0.33,
  89: 2.61, 90: 5.53, 91: 2.81, 92: 4.13, 93: 6.94, 94: 27.54, 95: 4.68, 96: 1.29,
  97: 1.72, 98: 3.64, 99: 3.53, 100: 4.61, 101: 2.41, 102: 13.46, 103: 7.25,
  104: 10.95, 105: 7.19, 106: 6.39, 107: 20.56, 108: 3.47, 109: 7.58,
  110: 5.05, 111: 2.84, 112: 2.89, 113: 22.85, 114: 12.46, 115: 3.63, 116: 4.33,
  117: 4.83, 118: 83.80, 119: 71.73, 120: 104, 121: 168, 122: 34.21, 123: 83.16,
  124: 165,
};

async function main() {
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, number")
    .eq("set_id", SET_ID)
    .order("number", { ascending: true });

  if (error) throw error;
  console.log(`Seeding printings for ${cards.length} Perfect Order cards...`);

  await supabase.from("printings").delete().eq("set_id", SET_ID);

  const rows = [];
  for (const card of cards) {
    const n = card.number;
    const basePrice = PRICES_USD[n] || null;
    const isEx = EX_NUMBERS.has(n);
    const isSecretRare = n > PRINTED_TOTAL;

    if (isEx || isSecretRare) {
      rows.push({
        id: `${card.id}-holofoil`,
        card_id: card.id,
        set_id: SET_ID,
        card_number: n,
        printing_type: "holofoil",
        printing_label: "Holo",
        display_order: 1,
        price_usd: basePrice,
        updated_at: new Date().toISOString(),
      });
    } else {
      rows.push({
        id: `${card.id}-normal`,
        card_id: card.id,
        set_id: SET_ID,
        card_number: n,
        printing_type: "normal",
        printing_label: "Common",
        display_order: 0,
        price_usd: basePrice,
        updated_at: new Date().toISOString(),
      });
      rows.push({
        id: `${card.id}-holofoil`,
        card_id: card.id,
        set_id: SET_ID,
        card_number: n,
        printing_type: "holofoil",
        printing_label: "Holo",
        display_order: 1,
        price_usd: basePrice ? basePrice * 2.5 : null,
        updated_at: new Date().toISOString(),
      });
      rows.push({
        id: `${card.id}-reverse_holofoil`,
        card_id: card.id,
        set_id: SET_ID,
        card_number: n,
        printing_type: "reverse_holofoil",
        printing_label: "Reverse Holo",
        display_order: 2,
        price_usd: basePrice ? basePrice * 1.5 : null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error: insErr } = await supabase.from("printings").insert(chunk);
    if (insErr) throw insErr;
  }

  console.log(`Inserted ${rows.length} printing rows for Perfect Order.`);

  const { data: entries } = await supabase
    .from("collection_entries")
    .select("user_id, set_id, card_number, variant, printing_id")
    .eq("set_id", SET_ID);

  const variantMap = {
    Common: "normal",
    Holo: "holofoil",
    "Reverse Holo": "reverse_holofoil",
  };

  console.log(`Re-linking ${entries.length} collection entries...`);
  for (const e of entries) {
    const targetType = variantMap[e.variant] || "holofoil";
    const { data: matchingPrintings } = await supabase
      .from("printings")
      .select("id, printing_type")
      .eq("set_id", SET_ID)
      .eq("card_number", e.card_number)
      .order("display_order", { ascending: true });
    if (!matchingPrintings || matchingPrintings.length === 0) continue;
    const match = matchingPrintings.find((p) => p.printing_type === targetType) || matchingPrintings[0];
    await supabase
      .from("collection_entries")
      .update({ printing_id: match.id })
      .eq("user_id", e.user_id)
      .eq("set_id", SET_ID)
      .eq("card_number", e.card_number);
  }

  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
