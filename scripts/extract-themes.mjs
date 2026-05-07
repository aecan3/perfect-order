import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Vibrant from "node-vibrant";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function rgbToHex([r, g, b]) {
  const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function vividnessScore(rgb) {
  const [, s, l] = rgbToHsl(...rgb);
  const lDistance = 1 - Math.abs(l - 0.55) * 2;
  return s * 0.7 + lDistance * 0.3;
}

async function extractTheme(logoUrl) {
  if (!logoUrl) return null;
  try {
    const palette = await Vibrant.from(logoUrl).getPalette();
    const swatches = Object.values(palette).filter(Boolean);
    if (swatches.length === 0) return null;

    const ranked = swatches
      .map((sw) => ({ rgb: sw.getRgb(), score: vividnessScore(sw.getRgb()), pop: sw.getPopulation() }))
      .sort((a, b) => b.score - a.score);

    const primary = ranked[0];
    const [pH] = rgbToHsl(...primary.rgb);
    const secondary = ranked.slice(1).find((s) => {
      const [sH] = rgbToHsl(...s.rgb);
      const diff = Math.min(Math.abs(pH - sH), 360 - Math.abs(pH - sH));
      return diff > 30;
    }) || ranked[1] || primary;

    const dark = swatches
      .map((sw) => ({ rgb: sw.getRgb(), l: rgbToHsl(...sw.getRgb())[2] }))
      .sort((a, b) => a.l - b.l)[0];
    const bgMix = dark.rgb.map((c) => Math.round(c * 0.15 + 10));

    return {
      primary: rgbToHex(primary.rgb),
      secondary: rgbToHex(secondary.rgb),
      bg: rgbToHex(bgMix),
    };
  } catch (err) {
    console.error(`  Extraction failed: ${err.message}`);
    return null;
  }
}

async function main() {
  const onlySet = process.argv[2];
  let query = supabase.from("sets").select("id, name, logo_url, theme_primary");
  if (onlySet) query = query.eq("id", onlySet);
  const { data: sets, error } = await query;
  if (error) throw error;

  console.log(`Processing ${sets.length} sets...`);

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    if (!set.logo_url) {
      console.log(`[${i + 1}/${sets.length}] ${set.name} — no logo, skipping`);
      continue;
    }
    if (set.theme_primary && !onlySet) {
      console.log(`[${i + 1}/${sets.length}] ${set.name} — already themed, skipping`);
      continue;
    }

    const theme = await extractTheme(set.logo_url);
    if (!theme) {
      console.log(`[${i + 1}/${sets.length}] ${set.name} — extraction failed`);
      continue;
    }

    const { error: upErr } = await supabase
      .from("sets")
      .update({
        theme_primary: theme.primary,
        theme_secondary: theme.secondary,
        theme_bg: theme.bg,
      })
      .eq("id", set.id);

    if (upErr) {
      console.error(`[${i + 1}/${sets.length}] ${set.name} — DB update failed: ${upErr.message}`);
    } else {
      console.log(`[${i + 1}/${sets.length}] ${set.name} — ${theme.primary} / ${theme.secondary} / ${theme.bg}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
