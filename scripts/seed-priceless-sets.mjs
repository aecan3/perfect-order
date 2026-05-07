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
  const { data: sets } = await supabase
    .from("sets")
    .select("id, name");

  const ids = [];
  for (const s of sets) {
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("set_id", s.id)
      .not("price_usd", "is", null);
    if (count === 0) ids.push(s.id);
  }

  console.log(`Found ${ids.length} sets without API price data: ${ids.join(", ")}`);

  for (const id of ids) {
    console.log(`\n=== Seeding manual printings for ${id} ===`);
    execSync(`node scripts/seed-manual-printings.mjs ${id}`, { stdio: "inherit" });
  }

  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });
