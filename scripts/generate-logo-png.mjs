// Generates public/brand/master-setter-stacked-email.png
// Renders the stacked MasterSetter logo lockup via sharp + embedded IBM Plex Sans 700.
// Run with: node scripts/generate-logo-png.mjs

import sharp from "sharp";
import https from "https";
import http from "http";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Fetch IBM Plex Sans 700 font bytes from Google Fonts.
//    The CSS API returns a @font-face with a CDN URL for the actual file.
// ---------------------------------------------------------------------------
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, { headers: { "User-Agent": "node" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function getFontBase64() {
  // Fetch the CSS to find the actual font file URL.
  const cssUrl = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@700&display=swap";
  const css = (await fetchUrl(cssUrl)).toString("utf8");
  // Extract the first src: url(...) in the @font-face rule.
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match) throw new Error("Could not parse font URL from Google Fonts CSS");
  const fontUrl = match[1];
  console.log("Font URL:", fontUrl);
  const fontBytes = await fetchUrl(fontUrl);
  console.log("Font bytes:", fontBytes.length);
  // Determine format from URL.
  const fmt = fontUrl.includes(".woff2") ? "woff2" : fontUrl.includes(".woff") ? "woff" : "truetype";
  return { b64: fontBytes.toString("base64"), fmt };
}

// ---------------------------------------------------------------------------
// 2. Build the SVG.
//    Mirrors MasterSetterLogo stacked variant geometry exactly.
// ---------------------------------------------------------------------------
function buildSvg(fontB64, fontFmt) {
  const accent = "#c8ff4a";
  const ink = "#f4f4f6";
  // bg = transparent (email card has its own dark bg)
  const bg = "none";

  // Render height for the bracket (this becomes the PNG height roughly).
  // Target ~540px wide PNG: at bracketH=240 the total is ~540px.
  const bracketH = 240;
  const bracketW = bracketH * 0.36;              // 86.4
  const s = Math.max(2, Math.round(bracketH * 0.023)); // 6
  const inset = bracketW * 0.55;                // 47.5

  const fontSize = Math.round(bracketH * 0.34); // 82
  const gap = Math.round(bracketH * 0.12);      // 29
  const lineHeight = Math.round(fontSize * 0.9); // 74 — actual rendered line height
  const marginTop = 4;

  // Text block width: estimate from actual character metrics of IBM Plex Sans 700
  // at fontSize 82. "MASTER" / "SETTER" — 6 uppercase chars.
  // IBM Plex Sans 700 uppercase advance width is ~0.62em per char on average.
  const charWidth = fontSize * 0.62;
  const textW = Math.ceil(6 * charWidth); // both words are 6 chars

  // Total canvas width.
  const totalW = Math.ceil(bracketW + gap + textW + gap + bracketW);
  // Total canvas height — bracket is tallest element, aligned to center of text block.
  const textBlockH = lineHeight + marginTop + lineHeight;
  const totalH = Math.max(bracketH, textBlockH) + 10; // small buffer

  // Y positions for brackets and text.
  const bracketY = (totalH - bracketH) / 2;
  const textMidY = totalH / 2;
  const line1BaseY = textMidY - textBlockH / 2 + lineHeight;  // baseline of "MASTER"
  const line2BaseY = line1BaseY + marginTop + lineHeight;       // baseline of "SETTER"

  // X positions.
  const leftBracketX = 0;
  const textX = bracketW + gap + textW / 2; // center of text block
  const rightBracketX = bracketW + gap + textW + gap;

  // Bracket helper — generates <g> for one bracket.
  function bracket(side, gx, gy) {
    const open = side === "left";
    const sx = open ? s / 2 : bracketW - s / 2;
    const hTop = s / 2;
    const hBot = bracketH - s / 2;
    const notchTop = bracketH * 0.45;
    const notchBot = bracketH * 0.55;
    const hi = open ? inset : bracketW - inset;

    return `
  <g transform="translate(${gx.toFixed(2)}, ${gy.toFixed(2)})">
    <!-- top horizontal -->
    <line x1="${hi.toFixed(2)}" y1="${hTop}" x2="${sx.toFixed(2)}" y2="${hTop}" stroke="${accent}" stroke-width="${s}"/>
    <!-- vertical spine -->
    <line x1="${sx.toFixed(2)}" y1="${hTop}" x2="${sx.toFixed(2)}" y2="${hBot}" stroke="${accent}" stroke-width="${s}"/>
    <!-- bottom horizontal -->
    <line x1="${sx.toFixed(2)}" y1="${hBot}" x2="${hi.toFixed(2)}" y2="${hBot}" stroke="${accent}" stroke-width="${s}"/>
    <!-- notch knockout (painted bg color over spine) -->
    <line x1="${sx.toFixed(2)}" y1="${notchTop.toFixed(2)}" x2="${sx.toFixed(2)}" y2="${notchBot.toFixed(2)}" stroke="${"#0e0e12"}" stroke-width="${s + 2}"/>
    <!-- center dot -->
    <circle cx="${sx.toFixed(2)}" cy="${(bracketH / 2).toFixed(2)}" r="${(s * 0.9).toFixed(2)}" fill="${accent}"/>
  </g>`;
  }

  const svgW = totalW;
  const svgH = totalH;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'IBM Plex Sans';
        font-weight: 700;
        src: url('data:font/${fontFmt};base64,${fontB64}') format('${fontFmt}');
      }
    </style>
  </defs>

  ${bracket("left",  leftBracketX,  bracketY)}
  ${bracket("right", rightBracketX, bracketY)}

  <!-- MASTER -->
  <text
    x="${textX.toFixed(2)}" y="${line1BaseY.toFixed(2)}"
    text-anchor="middle"
    font-family="'IBM Plex Sans', Arial, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    letter-spacing="-0.01em"
    fill="${ink}"
  >MASTER</text>

  <!-- SETTER -->
  <text
    x="${textX.toFixed(2)}" y="${line2BaseY.toFixed(2)}"
    text-anchor="middle"
    font-family="'IBM Plex Sans', Arial, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    letter-spacing="-0.01em"
    fill="${accent}"
  >SETTER</text>

</svg>`;
}

// ---------------------------------------------------------------------------
// 3. Convert SVG -> PNG via sharp and save.
// ---------------------------------------------------------------------------
async function main() {
  console.log("Fetching IBM Plex Sans 700...");
  const { b64, fmt } = await getFontBase64();

  console.log("Building SVG...");
  const svg = buildSvg(b64, fmt);

  const svgPath = join(ROOT, "public", "brand", "master-setter-stacked-email.svg");
  writeFileSync(svgPath, svg, "utf8");
  console.log("SVG saved to", svgPath);

  console.log("Converting to PNG via sharp...");
  const pngPath = join(ROOT, "public", "brand", "master-setter-stacked-email.png");
  const info = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(pngPath);

  console.log("PNG saved to", pngPath);
  console.log("Dimensions:", info.width, "x", info.height, "px");
  console.log("File size:", info.size, "bytes");
}

main().catch((err) => { console.error(err); process.exit(1); });
