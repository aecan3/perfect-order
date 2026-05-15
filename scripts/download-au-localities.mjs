// Downloads and processes the public-domain Australian postcodes dataset
// (derived from ABS GNAF data, maintained at github.com/matthewproctor/australianpostcodes).
// Run with: node scripts/download-au-localities.mjs
// Output: public/data/au-localities.json
// Refresh roughly annually — ABS updates GNAF twice a year but suburb changes are rare.

import https from "https";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SOURCE_URL =
  "https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.json";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "node" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

console.log("Fetching AU postcodes dataset...");
const raw = await fetchJson(SOURCE_URL);
console.log(`Downloaded ${raw.length} raw records.`);

// Keep only Delivery Area type records (actual populated localities).
// Filter out: Large Volume Receivers (LVR), PO Boxes, Non-Physical localities, etc.
// Also drop records missing suburb or postcode.
const seen = new Set();
const localities = [];

for (const r of raw) {
  const suburb = (r.locality || "").trim();
  const postcode = (r.postcode || "").toString().trim().padStart(4, "0");
  const state = (r.state || "").trim().toUpperCase();

  if (!suburb || !postcode || !state) continue;
  // Exclude non-standard types (PO Boxes etc.) when type field is present.
  if (r.type && r.type !== "Delivery Area") continue;

  const key = `${suburb.toLowerCase()}|${postcode}|${state}`;
  if (seen.has(key)) continue;
  seen.add(key);

  localities.push({ suburb, postcode, state });
}

// Sort: state asc, then suburb asc (makes binary search / display natural).
localities.sort((a, b) =>
  a.state.localeCompare(b.state) || a.suburb.localeCompare(b.suburb)
);

mkdirSync(join(ROOT, "public", "data"), { recursive: true });
const outPath = join(ROOT, "public", "data", "au-localities.json");

// Write compact JSON (no pretty-print — minimises file size).
writeFileSync(outPath, JSON.stringify(localities), "utf8");

const bytes = Buffer.byteLength(JSON.stringify(localities), "utf8");
console.log(`Written ${localities.length} localities to ${outPath}`);
console.log(`File size: ${(bytes / 1024).toFixed(1)} KB uncompressed`);
console.log("Sample (first 5):", localities.slice(0, 5));
console.log("Sample (last 5):", localities.slice(-5));
