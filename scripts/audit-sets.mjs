import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function getCardCounts() {
  const counts = {};
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("set_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data) {
      counts[row.set_id] = (counts[row.set_id] || 0) + 1;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return counts;
}

async function getSets() {
  const sets = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("sets")
      .select("id, name, total, total_with_secrets")
      .range(from, from + PAGE - 1)
      .order("id");
    if (error) throw error;
    sets.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return sets;
}

async function main() {
  console.log("Fetching sets...");
  const sets = await getSets();
  console.log(`Fetched ${sets.length} sets`);

  console.log("Fetching card counts...");
  const counts = await getCardCounts();
  console.log("Done. Building report...");

  const rows = sets.map((s) => {
    const actual = counts[s.id] || 0;
    const expected = s.total_with_secrets || s.total || 0;
    const gap = expected - actual;
    const status = gap <= 0 ? "✅" : "❌";
    return { id: s.id, name: s.name, expected, actual, gap, status, total_with_secrets: s.total_with_secrets };
  });

  // Only count sets where we're genuinely short (actual < total_with_secrets)
  const withGaps = rows.filter((r) => r.gap > 0);
  const totalMissing = withGaps.reduce((sum, r) => sum + r.gap, 0);

  // Column widths
  const idW = Math.max(6, ...rows.map((r) => r.id.length));
  const nameW = Math.max(4, ...rows.map((r) => r.name.length));
  const expW = 8;
  const actW = 6;
  const gapW = 3;

  const sep = `${"─".repeat(idW + 2)}┼${"─".repeat(nameW + 2)}┼${"─".repeat(expW + 2)}┼${"─".repeat(actW + 2)}┼${"─".repeat(gapW + 2)}┼────────`;

  const header =
    ` ${"set_id".padEnd(idW)} │ ${"name".padEnd(nameW)} │ ${"expected".padEnd(expW)} │ ${"actual".padEnd(actW)} │ ${"gap".padStart(gapW)} │ status`;

  const lines = [
    `Perfect Order — Set Audit Report`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    header,
    sep,
  ];

  for (const r of rows) {
    const gapStr = r.gap === 0 ? "  0" : String(r.gap).padStart(gapW);
    lines.push(
      ` ${r.id.padEnd(idW)} │ ${r.name.padEnd(nameW)} │ ${String(r.expected).padEnd(expW)} │ ${String(r.actual).padEnd(actW)} │ ${gapStr} │ ${r.status}`
    );
  }

  lines.push(sep);
  lines.push(``);
  lines.push(`── Summary ──────────────────────────────────`);
  lines.push(`  Total sets:          ${rows.length}`);
  lines.push(`  Complete (✅):        ${rows.length - withGaps.length}`);
  lines.push(`  Sets with gaps (❌):  ${withGaps.length}`);
  lines.push(`  Total missing cards: ${totalMissing}`);
  lines.push(``);

  if (withGaps.length > 0) {
    lines.push(`── Sets needing attention (actual < total_with_secrets) ─────`);
    for (const r of withGaps.sort((a, b) => b.gap - a.gap)) {
      lines.push(`  ${r.id.padEnd(idW)}  missing ${r.gap}  (have ${r.actual}, need ${r.expected})`);
    }
    lines.push(``);
  }

  const report = lines.join("\n");
  writeFileSync("scripts/audit-report.txt", report, "utf8");
  console.log("\n" + report);
  console.log("Report saved to scripts/audit-report.txt");
}

main().catch((err) => { console.error(err); process.exit(1); });
