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
  const empty = [];
  for (const s of sets) {
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("set_id", s.id);
    if (count === 0) empty.push(s);
  }

  console.log(`Found ${empty.length} empty sets:`);
  empty.forEach((s) => console.log(`  - ${s.id} (${s.name})`));

  for (const s of empty) {
    console.log(`\n=== Reseeding ${s.id} (${s.name}) ===`);
    try {
      execSync(`node scripts/seed-sets.mjs ${s.id}`, { stdio: "inherit" });
    } catch (err) {
      console.error(`Failed for ${s.id}: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });
