import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DELAY_MS = 2000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function printingsForRarity(rarity) {
  const r = (rarity || "").toLowerCase();
  if (r === "common" || r === "uncommon") {
    return [
      { type: "normal", label: "Non-Holo", order: 0, priceMultiplier: 1 },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.5 },
    ];
  }
  if (r === "rare") {
    return [
      { type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 },
      { type: "reverse_holofoil", label: "Reverse Holo", order: 2, priceMultiplier: 1.3 },
    ];
  }
  return [{ type: "holofoil", label: "Holo", order: 1, priceMultiplier: 1 }];
}

async function scrapeCard(setCode, num) {
  const url = `https://limitlesstcg.com/cards/${setCode}/${num}`;
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html" } });
  } catch (e) {
    return { ok: false, reason: `fetch error: ${e.message}` };
  }

  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const html = await res.text();

  // Name: title is "Card Name - Set Name (CODE) #N – Limitless"
  // Strip everything from " - <anything>(CODE) #N" onwards to handle names with dashes
  let name = null;
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    name = decodeHtmlEntities(
      titleMatch[1].replace(/\s*-\s*.+?\([A-Z0-9]+\)\s*#\d+.*/s, "").trim()
    );
  }
  if (!name) return { ok: false, reason: "no name found in title" };

  // Rarity: "#252 · Ultra Rare" — appears as plain text inside a <span>
  let rarity = null;
  const rarityMatch = html.match(/#\d+\s*·\s*([^\n<]+)/);
  if (rarityMatch) rarity = rarityMatch[1].trim();

  // Supertype: <p class="card-text-type">Pokémon\n - Basic\n</p>
  let supertype = "Pokémon";
  const typeMatch = html.match(/card-text-type[^>]*>\s*(Pok[eé]mon|Trainer|Energy)/i);
  if (typeMatch) {
    const t = typeMatch[1].toLowerCase();
    if (t.startsWith("trainer")) supertype = "Trainer";
    else if (t.startsWith("energy")) supertype = "Energy";
    else supertype = "Pokémon";
  }

  // Images: og:image has the SM CDN URL; swap suffix for LG
  let imageSmall = null;
  let imageLarge = null;
  const ogImgMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
  if (ogImgMatch) {
    imageSmall = ogImgMatch[1];
    imageLarge = imageSmall.replace("_SM.png", "_LG.png");
  } else {
    // Fallback: find any LG URL in the page
    const lgMatch = html.match(/https:\/\/limitlesstcg\.nyc3\.cdn\.digitaloceanspaces\.com\/[^\s"'<>]+_LG\.png/);
    if (lgMatch) {
      imageLarge = lgMatch[0];
      imageSmall = imageLarge.replace("_LG.png", "_SM.png");
    }
  }

  return { ok: true, name, rarity, supertype, imageSmall, imageLarge };
}

async function main() {
  // Optional 5th arg: alphanumeric prefix for card numbers (e.g. "RC" → RC1, RC2…)
  // Usage with prefix: node scripts/patch-limitless.mjs bw11 LTR 1 25 RC
  const [setId, setCode, startStr, endStr, numPrefix = ""] = process.argv.slice(2);

  if (!setId || !setCode || !startStr || !endStr) {
    console.error("Usage: node scripts/patch-limitless.mjs <setId> <setCode> <start> <end> [numPrefix]");
    console.error("Example (integers):  node scripts/patch-limitless.mjs me2pt5 ASC 252 295");
    console.error("Example (prefixed):  node scripts/patch-limitless.mjs bw11 LTR 1 25 RC");
    process.exit(1);
  }

  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (isNaN(start) || isNaN(end) || start > end) {
    console.error(`Invalid range: ${startStr}–${endStr}`);
    process.exit(1);
  }

  // For prefixed ranges (e.g. RC1–RC25), we assign DB integers starting after
  // the current max card number in the set, so we never collide with existing rows.
  let dbNumberOffset = 0;
  if (numPrefix) {
    const { data: maxRow, error: maxErr } = await supabase
      .from("cards")
      .select("number")
      .eq("set_id", setId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) throw maxErr;
    dbNumberOffset = maxRow ? maxRow.number : 0;
  }

  // For integer ranges, check which numbers are already in DB
  // For prefixed ranges, check by DB number in the offset window
  const rangeLabel = numPrefix ? `${numPrefix}${start}–${numPrefix}${end}` : `${start}–${end}`;
  let existingNumbers = new Set();
  if (!numPrefix) {
    const { data: existing, error: fetchErr } = await supabase
      .from("cards")
      .select("number")
      .eq("set_id", setId)
      .gte("number", start)
      .lte("number", end);
    if (fetchErr) throw fetchErr;
    existingNumbers = new Set(existing.map((c) => c.number));
  }

  const toFetch = [];
  for (let n = start; n <= end; n++) {
    if (!numPrefix && existingNumbers.has(n)) continue;
    toFetch.push(n);
  }

  console.log(`\n=== Patching ${setId} from limitlesstcg.com/${setCode} #${rangeLabel} ===`);
  if (numPrefix) console.log(`DB numbers will be assigned starting at ${dbNumberOffset + 1}`);
  console.log(`To fetch: ${toFetch.length}  |  Already in DB: ${existingNumbers.size}`);
  if (toFetch.length === 0) {
    console.log("Nothing to do — all cards already present.");
    return;
  }

  const inserted = [];
  const failed = [];

  for (let i = 0; i < toFetch.length; i++) {
    const num = toFetch[i];
    // For prefixed ranges, use the prefix in the URL but assign sequential DB integers
    const urlNum = numPrefix ? `${numPrefix}${num}` : num;
    const dbNum  = numPrefix ? dbNumberOffset + (num - start + 1) : num;

    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

    process.stdout.write(`  [${i + 1}/${toFetch.length}] #${urlNum} (db:${dbNum}) ... `);

    const scraped = await scrapeCard(setCode, urlNum);
    if (!scraped.ok) {
      console.log(`SKIP (${scraped.reason})`);
      failed.push({ num: urlNum, reason: scraped.reason });
      continue;
    }

    const cardRow = {
      id: `${setId}-${urlNum}`,
      set_id: setId,
      number: dbNum,
      name: scraped.name,
      rarity: scraped.rarity,
      supertype: scraped.supertype,
      subtypes: null,
      image_small: scraped.imageSmall,
      image_large: scraped.imageLarge,
      price_usd: null,
      updated_at: new Date().toISOString(),
    };

    const { error: insErr } = await supabase.from("cards").insert(cardRow);
    if (insErr) {
      console.log(`DB ERROR: ${insErr.message}`);
      failed.push({ num: urlNum, reason: insErr.message });
      continue;
    }

    const printingRows = printingsForRarity(scraped.rarity).map((p) => ({
      id: `${cardRow.id}-${p.type}`,
      card_id: cardRow.id,
      set_id: setId,
      card_number: dbNum,
      printing_type: p.type,
      printing_label: p.label,
      display_order: p.order,
      price_usd: null,
      updated_at: new Date().toISOString(),
    }));

    const { error: pErr } = await supabase.from("printings").insert(printingRows);
    if (pErr) {
      console.log(`card OK · printings WARN: ${pErr.message}`);
    } else {
      console.log(`OK — "${scraped.name}" (${scraped.rarity ?? "?"}) +${printingRows.length} printings`);
    }
    inserted.push({ num: urlNum, name: scraped.name });
  }

  // Final counts
  const { count: finalCards } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("set_id", setId);
  const { count: finalPrintings } = await supabase
    .from("printings")
    .select("id", { count: "exact", head: true })
    .eq("set_id", setId);

  console.log(`\n✓ ${setId} patch complete`);
  console.log(`  Inserted:         ${inserted.length} cards`);
  console.log(`  Skipped/failed:   ${failed.length}`);
  console.log(`  Total cards in DB: ${finalCards}`);
  console.log(`  Total printings:   ${finalPrintings}`);

  if (failed.length > 0) {
    console.log(`\n  Failures:`);
    failed.forEach((f) => console.log(`    #${f.num}: ${f.reason}`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
