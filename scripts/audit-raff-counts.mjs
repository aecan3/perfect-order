/**
 * Audit home-page vs set-tracker counts for a given user (default: raffertydall).
 *
 * For each set the user tracks, we compute:
 *   - Home-page style denominator: printings count from flat sets query
 *     (mirrors the fixed app/page.js approach)
 *   - Set-tracker style denominator: actual length of the printings table
 *     for that set_id (what the set tracker fetches and counts)
 *   - Checked numerator: collection_entries rows with checked=true, paginated
 *
 * All three should agree. Any mismatch is a bug.
 *
 * Usage:
 *   node scripts/audit-raff-counts.mjs [handle]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PAGE = 1000;

async function fetchAll(query) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function main() {
  const handle = process.argv[2] || "raffertydall";

  // 1. Resolve user
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, handle")
    .eq("handle", handle)
    .maybeSingle();
  if (profErr || !profile) {
    console.error(`User '${handle}' not found:`, profErr?.message);
    process.exit(1);
  }
  const userId = profile.id;
  console.log(`User: ${profile.handle}  (${userId})\n`);

  // 2. User's sets (preserve order)
  const userSetsRows = await fetchAll(
    supabase
      .from("user_sets")
      .select("set_id, hidden_at")
      .eq("user_id", userId)
      .order("added_at", { ascending: false })
  );
  const setIds = userSetsRows.map((r) => r.set_id);
  console.log(`Sets tracked: ${setIds.length}`);

  // 3. Set details — flat query (home-page approach after fix)
  const { data: setsData, error: setsErr } = await supabase
    .from("sets")
    .select("id, name, cards(count), printings!printings_set_id_fkey(count)")
    .in("id", setIds);
  if (setsErr) throw setsErr;
  const setById = Object.fromEntries((setsData || []).map((s) => [s.id, s]));

  // 4. Checked entries — paginated to handle >1000
  const checkedEntries = await fetchAll(
    supabase
      .from("collection_entries")
      .select("set_id")
      .eq("user_id", userId)
      .eq("checked", true)
  );
  const checkedBySet = {};
  checkedEntries.forEach((e) => {
    checkedBySet[e.set_id] = (checkedBySet[e.set_id] || 0) + 1;
  });
  console.log(`Total checked entries: ${checkedEntries.length}\n`);

  // 5. Ground-truth printing counts — paginated per set (set-tracker approach)
  const trackerDenomBySet = {};
  for (const setId of setIds) {
    let count = 0, from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("printings")
        .select("id")
        .eq("set_id", setId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      count += data.length;
      if (data.length < PAGE) break;
      from += PAGE;
    }
    trackerDenomBySet[setId] = count;
  }

  // 6. Compare
  let pass = 0, fail = 0;
  const results = [];

  for (const { set_id: setId, hidden_at } of userSetsRows) {
    const s = setById[setId];
    if (!s) {
      results.push({ setId, name: "??", checked: 0, homeDenom: 0, trackerDenom: 0, ok: false, note: "set not in sets table" });
      fail++;
      continue;
    }

    const homePrintingCount = Number(s.printings?.[0]?.count) || 0;
    const homeCardCount    = Number(s.cards?.[0]?.count) || 0;
    const homeDenom        = homePrintingCount > 0 ? homePrintingCount : homeCardCount;
    const trackerDenom     = trackerDenomBySet[setId] || 0;
    const checked          = checkedBySet[setId] || 0;
    const ok               = homeDenom === trackerDenom;

    results.push({
      setId,
      name: s.name,
      checked,
      homeDenom,
      trackerDenom,
      ok,
      hidden: hidden_at != null,
      note: ok ? "" : `MISMATCH home=${homeDenom} tracker=${trackerDenom}`,
    });

    if (ok) pass++; else fail++;
  }

  // 7. Print report
  const maxName = Math.max(4, ...results.map((r) => (r.name || "").length));
  const nameW   = Math.min(maxName, 45);
  const sep = "─".repeat(nameW + 60);

  console.log("── Home-page vs Set-tracker count audit ─────────────────────\n");
  console.log(
    `${"Set ID".padEnd(22)} ${"Name".padEnd(nameW)} ${"Checked".padStart(7)} ${"Home".padStart(6)} ${"Tracker".padStart(7)}  Status`
  );
  console.log(sep);

  for (const r of results) {
    const name    = (r.name || "").substring(0, nameW).padEnd(nameW);
    const checked = String(r.checked).padStart(7);
    const home    = String(r.homeDenom).padStart(6);
    const tracker = String(r.trackerDenom).padStart(7);
    const status  = r.ok ? "✅" : "❌";
    const hidden  = r.hidden ? " (hidden)" : "";
    const note    = r.note ? `  ← ${r.note}` : "";
    console.log(`${r.setId.padEnd(22)} ${name} ${checked} ${home} ${tracker}  ${status}${hidden}${note}`);
  }

  console.log(sep);
  console.log(`\nPassed: ${pass}  Failed: ${fail}  Total: ${results.length}`);

  if (fail > 0) {
    console.error(`\n${fail} set(s) have mismatched denominators — home page and set tracker disagree.`);
    process.exit(1);
  } else {
    console.log("\nAll sets match. Home page and set tracker counts agree.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
