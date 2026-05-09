/**
 * Audit home-page vs set-tracker counts for all users (or one handle).
 *
 * For every set each user tracks, we verify:
 *   - Home-page denominator (flat printings count query) matches
 *     the ground-truth denominator (raw printings row count per set)
 *   - Checked numerator is fully fetched (paginated, not truncated)
 *
 * Usage:
 *   node scripts/audit-raff-counts.mjs              # all users
 *   node scripts/audit-raff-counts.mjs raffertydall  # one handle
 *
 * npm run audit:counts
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

async function fetchAll(builder) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

// Shared cache: printing counts are the same for all users.
const printingCountCache = {};
async function getPrintingCount(setId) {
  if (printingCountCache[setId] !== undefined) return printingCountCache[setId];
  let count = 0, from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("printings").select("id").eq("set_id", setId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    count += data.length;
    if (data.length < PAGE) break;
    from += PAGE;
  }
  printingCountCache[setId] = count;
  return count;
}

async function auditUser(userId, handle) {
  // 1. User's set_ids (preserve add order)
  const userSetsRows = await fetchAll(
    supabase.from("user_sets").select("set_id, hidden_at")
      .eq("user_id", userId).order("added_at", { ascending: false })
  );
  const setIds = userSetsRows.map((r) => r.set_id);
  if (setIds.length === 0) return { handle, sets: [], pass: 0, fail: 0 };

  // 2. Set details — flat query (mirrors fixed home page)
  const { data: setsData, error: setsErr } = await supabase
    .from("sets")
    .select("id, name, cards(count), printings!printings_set_id_fkey(count)")
    .in("id", setIds);
  if (setsErr) throw setsErr;
  const setById = Object.fromEntries((setsData || []).map((s) => [s.id, s]));

  // 3. Checked entries — paginated
  const checkedEntries = await fetchAll(
    supabase.from("collection_entries").select("set_id")
      .eq("user_id", userId).eq("checked", true)
  );
  const checkedBySet = {};
  checkedEntries.forEach((e) => {
    checkedBySet[e.set_id] = (checkedBySet[e.set_id] || 0) + 1;
  });

  // 4. Compare per set
  const sets = [];
  let pass = 0, fail = 0;

  for (const { set_id: setId, hidden_at } of userSetsRows) {
    const s = setById[setId];
    if (!s) {
      sets.push({ setId, name: "??", checked: 0, homeDenom: 0, trackerDenom: 0, ok: false, note: "set missing" });
      fail++;
      continue;
    }

    const homePrintingCount = Number(s.printings?.[0]?.count) || 0;
    const homeCardCount     = Number(s.cards?.[0]?.count) || 0;
    const homeDenom         = homePrintingCount > 0 ? homePrintingCount : homeCardCount;
    const trackerDenom      = await getPrintingCount(setId);
    const checked           = checkedBySet[setId] || 0;
    const ok                = homeDenom === trackerDenom;

    sets.push({ setId, name: s.name, checked, homeDenom, trackerDenom, ok, hidden: hidden_at != null });
    if (ok) pass++; else fail++;
  }

  return { handle, totalEntries: checkedEntries.length, sets, pass, fail };
}

async function main() {
  const handleArg = process.argv[2] || null;

  // Resolve profiles to audit
  let profiles;
  if (handleArg) {
    const { data, error } = await supabase.from("profiles")
      .select("id, handle").eq("handle", handleArg).maybeSingle();
    if (error || !data) { console.error(`User '${handleArg}' not found`); process.exit(1); }
    profiles = [data];
  } else {
    profiles = await fetchAll(
      supabase.from("profiles").select("id, handle").order("handle")
    );
    console.log(`Auditing ${profiles.length} user(s)…\n`);
  }

  let grandPass = 0, grandFail = 0;
  const failedUsers = [];

  for (const profile of profiles) {
    const result = await auditUser(profile.id, profile.handle);
    grandPass += result.pass;
    grandFail += result.fail;

    const statusIcon = result.fail === 0 ? "✅" : "❌";

    if (profiles.length === 1 || result.fail > 0) {
      // Print per-set detail for single-user runs and for any failing user
      const maxName = Math.max(4, ...result.sets.map((r) => (r.name || "").length));
      const nameW   = Math.min(maxName, 42);
      const sep     = "─".repeat(nameW + 58);

      console.log(`${statusIcon} ${result.handle}  (${result.sets.length} sets, ${result.totalEntries ?? "?"} checked entries)`);
      if (result.sets.length > 0) {
        console.log(`   ${"Set ID".padEnd(20)} ${"Name".padEnd(nameW)} ${"Ckd".padStart(5)} ${"Home".padStart(6)} ${"True".padStart(6)}  Status`);
        console.log(`   ${sep}`);
        for (const r of result.sets) {
          const name    = (r.name || "").substring(0, nameW).padEnd(nameW);
          const checked = String(r.checked).padStart(5);
          const home    = String(r.homeDenom).padStart(6);
          const truth   = String(r.trackerDenom).padStart(6);
          const icon    = r.ok ? "✅" : "❌";
          const hidden  = r.hidden ? " (hidden)" : "";
          const note    = !r.ok ? `  ← home=${r.homeDenom} truth=${r.trackerDenom}` : "";
          console.log(`   ${r.setId.padEnd(20)} ${name} ${checked} ${home} ${truth}  ${icon}${hidden}${note}`);
        }
        console.log(`   ${sep}`);
      }
      console.log();
    } else {
      // Single-line summary for passing users in all-users mode
      const setCount  = String(result.sets.length).padStart(3);
      const entryCount = String(result.totalEntries ?? "?").padStart(6);
      console.log(`  ✅  ${profile.handle.padEnd(30)} ${setCount} sets  ${entryCount} entries`);
    }

    if (result.fail > 0) failedUsers.push(result.handle);
  }

  // Grand summary
  console.log("═".repeat(60));
  console.log(`Grand total — Passed: ${grandPass}  Failed: ${grandFail}  Users: ${profiles.length}`);

  if (grandFail > 0) {
    console.error(`\n❌ Mismatches found for: ${failedUsers.join(", ")}`);
    process.exit(1);
  } else {
    console.log("\n✅ All sets match across all users.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
