import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: sets } = await supabase.from("sets").select("id, name");
  const missing = [];
  for (const s of sets) {
    const { count: cardCount } = await supabase
      .from("cards").select("id", { count: "exact", head: true }).eq("set_id", s.id);
    const { count: printCount } = await supabase
      .from("printings").select("id", { count: "exact", head: true }).eq("set_id", s.id);
    if (cardCount > 0 && printCount === 0) missing.push(s);
  }

  console.log(`Found ${missing.length} sets with cards but no printings.`);

  for (const s of missing) {
    console.log(`\n=== Seeding manual printings for ${s.id} (${s.name}) ===`);
    try {
      execSync(`node scripts/seed-manual-printings.mjs ${s.id}`, { stdio: "inherit" });
    } catch (err) {
      console.error(`Failed for ${s.id}: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });
