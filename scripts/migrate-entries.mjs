import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const VARIANT_MAP = {
  "Common": "normal",
  "Holo": "holofoil",
  "Reverse Holo": "reverse_holofoil",
};

async function main() {
  const { data: entries, error } = await supabase
    .from("collection_entries")
    .select("user_id, set_id, card_number, variant, printing_id")
    .is("printing_id", null);

  if (error) throw error;
  console.log(`Backfilling ${entries.length} entries...`);

  for (const e of entries) {
    const targetType = VARIANT_MAP[e.variant] || "normal";
    const { data: printings } = await supabase
      .from("printings")
      .select("id, printing_type")
      .eq("set_id", e.set_id)
      .eq("card_number", e.card_number)
      .order("display_order", { ascending: true });

    if (!printings || printings.length === 0) {
      console.error(`  No printings for ${e.set_id}/${e.card_number} — skipping`);
      continue;
    }

    const match = printings.find((p) => p.printing_type === targetType) || printings[0];

    const { error: upErr } = await supabase
      .from("collection_entries")
      .update({ printing_id: match.id })
      .eq("user_id", e.user_id)
      .eq("set_id", e.set_id)
      .eq("card_number", e.card_number);

    if (upErr) console.error(`  Update failed for ${e.set_id}/${e.card_number}: ${upErr.message}`);
  }

  console.log("Migration complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
