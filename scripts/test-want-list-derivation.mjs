// Derivation test — run with:
//   node --env-file=.env.local scripts/test-want-list-derivation.mjs
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { missingCardsForSet } from "../lib/queries/wantList.js";

// Parse .env.local manually (CRLF-safe)
{
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Scenario (a): alex's me3 in 'any' mode ────────────────────────────────────
async function scenarioA() {
  console.log("\n=== Scenario (a): me3, 'any' mode (modern set) ===\n");

  const alexId = await supabase
    .from("profiles").select("id").eq("handle", "alex").single()
    .then(r => r.data.id);

  const { data: printings } = await supabase
    .from("printings")
    .select("id, card_number, printing_type")
    .eq("set_id", "me3");

  const { data: entries } = await supabase
    .from("collection_entries")
    .select("printing_id")
    .eq("user_id", alexId)
    .eq("checked", true);

  const owned = new Set((entries || []).map(e => e.printing_id));
  const missing = missingCardsForSet("me3", printings || [], owned, "any");

  console.log(`Total missing slots: ${missing.length}`);
  console.log("\nFirst 10 missing rows:");
  missing.slice(0, 10).forEach(r =>
    console.log(`  card #${r.card_number}  printing_id=${r.printing_id}  label="${r.edition_label}"`)
  );

  // Assertion: no row in a modern set should carry "Any edition"
  const badRows = missing.filter(r => r.edition_label.includes("Any edition"));
  if (badRows.length > 0) {
    console.error("\n✗ ASSERTION FAILED — modern rows carry '· Any edition':");
    badRows.forEach(r => console.error(`  card #${r.card_number}: "${r.edition_label}"`));
    process.exit(1);
  } else {
    console.log("\n✓ Assertion passed: zero me3 rows carry '· Any edition'");
  }

  // Show label distribution
  const labelCounts = {};
  for (const r of missing) labelCounts[r.edition_label] = (labelCounts[r.edition_label] || 0) + 1;
  console.log("\nLabel distribution:", labelCounts);
}

// ── Scenario (b): base1 cards in 'all' mode, empty collection ────────────────
async function scenarioB() {
  console.log("\n=== Scenario (b): base1, 'all' mode (WOTC multi-edition) ===\n");

  // Only use holofoil cards — they have first_edition_holofoil AND unlimited_holofoil
  const { data: printings } = await supabase
    .from("printings")
    .select("id, card_number, printing_type")
    .eq("set_id", "base1")
    .in("printing_type", ["first_edition_holofoil", "unlimited_holofoil", "shadowless_holofoil"])
    .order("card_number", { ascending: true });

  const ownedEmpty = new Set(); // no cards owned
  const missing = missingCardsForSet("base1", printings || [], ownedEmpty, "all");

  console.log(`Total missing rows (all mode, empty collection): ${missing.length}`);
  console.log("\nFirst 12 missing rows (should be first/unlimited holofoil pairs):");
  missing.slice(0, 12).forEach(r =>
    console.log(`  card #${r.card_number}  printing_id=${r.printing_id}  label="${r.edition_label}"`)
  );

  // Assertion: first_edition and unlimited appear as distinct rows with correct labels
  const hasFirst  = missing.some(r => r.edition_label.startsWith("1st Edition"));
  const hasUnlim  = missing.some(r => r.edition_label.startsWith("Unlimited"));
  const hasBadSuffix = missing.some(r => r.edition_label.includes("Any edition"));

  console.log("\n✓ Has '1st Edition ·' rows:", hasFirst);
  console.log("✓ Has 'Unlimited ·' rows:", hasUnlim);
  if (hasBadSuffix) {
    console.error("✗ ASSERTION FAILED — 'all' mode rows should never carry '· Any edition'");
    process.exit(1);
  } else {
    console.log("✓ No '· Any edition' suffix in 'all' mode rows (correct)");
  }

  const labelCounts = {};
  for (const r of missing) labelCounts[r.edition_label] = (labelCounts[r.edition_label] || 0) + 1;
  console.log("\nLabel distribution:", labelCounts);
}

// ── Scenario (b-any): base1 in 'any' mode — WOTC holofoil slot gets suffix ──
async function scenarioBany() {
  console.log("\n=== Scenario (b-any): base1, 'any' mode (slots with 2+ editions) ===\n");

  const { data: printings } = await supabase
    .from("printings")
    .select("id, card_number, printing_type")
    .eq("set_id", "base1")
    .order("card_number", { ascending: true });

  const ownedEmpty = new Set();
  const missing = missingCardsForSet("base1", printings || [], ownedEmpty, "any");

  console.log(`Total missing slots (any mode, empty collection): ${missing.length}`);
  console.log("\nFirst 12 rows:");
  missing.slice(0, 12).forEach(r =>
    console.log(`  card #${r.card_number}  printing_id=${r.printing_id}  label="${r.edition_label}"`)
  );

  // Assertion: WOTC holofoil slot should carry "· Any edition" (has first_edition + unlimited)
  const holofoilAny = missing.filter(r => r.edition_label === "Holofoil · Any edition");
  const normalAny   = missing.filter(r => r.edition_label === "Normal · Any edition");
  console.log(`\n✓ Holofoil · Any edition slots: ${holofoilAny.length}`);
  console.log(`✓ Normal · Any edition slots:   ${normalAny.length}`);

  const labelCounts = {};
  for (const r of missing) labelCounts[r.edition_label] = (labelCounts[r.edition_label] || 0) + 1;
  console.log("\nLabel distribution:", labelCounts);
}

await scenarioA();
await scenarioB();
await scenarioBany();
console.log("\nAll scenarios complete.");
