export function rarityBucket(rarity, subtypes, cardNumber, setPrintedTotal, supertype = "") {
  const r = (rarity || "").toLowerCase().trim();
  const subs = (subtypes || []).map((s) => s.toLowerCase());
  const num = cardNumber || 0;
  const prt = setPrintedTotal || 0;

  if (!rarity) return (supertype || "").toLowerCase() === "energy" ? "energy_card" : "other_null";

  // ── UNIVERSAL ────────────────────────────────────────────
  if (r === "common")    return "common";
  if (r === "uncommon")  return "uncommon";
  if (r === "rare")      return "rare";
  if (r === "rare holo") return "rare_holo";
  if (r === "promo")     return "promo";

  // ── SCARLET & VIOLET + MEGA EVOLUTION ────────────────────
  if (r === "double rare") {
    if (subs.includes("mega")) return "mega_ex";
    if (subs.includes("tera")) return "tera_ex";
    if (subs.includes("ex"))   return "ex";
    return "double_rare";
  }
  if (r === "ultra rare")                return "ultra_rare";
  if (r === "illustration rare")         return "illustration_rare";
  if (r === "special illustration rare") return "sir";
  if (r === "hyper rare")                return "hyper_rare";
  if (r === "shiny rare")                return "shiny_rare";
  if (r === "shiny ultra rare")          return "shiny_ultra_rare";
  if (r === "ace spec rare")             return "ace_spec";
  if (r === "mega attack rare")          return "mega_attack_rare";
  if (r === "mega hyper rare")           return "mega_hyper_rare";

  // ── SWORD & SHIELD ───────────────────────────────────────
  if (r === "rare holo v")    return "v";
  if (r === "rare holo vmax") return "vmax";
  if (r === "rare holo vstar") return "vstar";
  if (r === "rare ultra") {
    const hasV = subs.some((s) => s === "v" || s === "vmax" || s === "vstar");
    if (hasV) return num > prt ? "v_full_art" : "v";
    return "full_art";
  }
  if (r === "rare rainbow") return "rainbow_rare";
  if (r === "rare secret") {
    const hasV = subs.some((s) => s === "v" || s === "vmax");
    if (hasV && num > prt)       return "alt_art";
    if (!hasV && num > prt + 20) return "gold_rare";
    return "secret_rare";
  }
  if (r === "trainer gallery rare holo") return "trainer_gallery";
  if (r === "rare shiny")                return "shiny";
  if (r === "amazing rare")              return "amazing_rare";

  // ── SUN & MOON ───────────────────────────────────────────
  if (r === "rare holo gx")    return "gx";
  if (r === "rare prism star") return "prism_star";
  if (r === "rare shining")    return "shining";

  // ── FALLBACK ─────────────────────────────────────────────
  return "other";
}

export const BUCKET_ORDER = [
  "common", "uncommon", "rare", "rare_holo",
  "gx", "v", "vmax", "vstar",
  "full_art", "prism_star", "shining",
  "v_full_art", "amazing_rare", "trainer_gallery", "shiny",
  "double_rare", "ex", "tera_ex", "mega_ex", "illustration_rare", "ace_spec",
  "rainbow_rare", "ultra_rare",
  "alt_art", "secret_rare", "gold_rare",
  "mega_attack_rare", "sir",
  "hyper_rare", "mega_hyper_rare",
  "shiny_rare", "shiny_ultra_rare", "promo",
  "energy_card", "other_null",
];
