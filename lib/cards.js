// Perfect Order (POR / ME3) — 124 cards: 88 base + 36 secret rares
export const TOTAL = 124;
export const PRINTED_TOTAL = 88;
export const SET_CODE = "POR";

// Supported currencies (mid-market, May 2026). Update rates as needed.
export const RATES = {
  AUD: { rate: 1.39, symbol: "A$", code: "AUD" },
  CAD: { rate: 1.36, symbol: "C$", code: "CAD" },
};

// Card names by number
export const NAMES = {
  1: "Spinarak", 2: "Ariados", 3: "Shaymin", 4: "Snivy", 5: "Servine",
  6: "Serperior", 7: "Scatterbug", 8: "Spewpa", 9: "Vivillon", 10: "Rowlet",
  11: "Dartrix", 12: "Decidueye ex", 13: "Fletchinder", 14: "Talonflame",
  15: "Salandit", 16: "Salazzle ex", 17: "Turtonator", 18: "Seel", 19: "Dewgong",
  20: "Staryu", 21: "Mega Starmie ex", 22: "Lapras ex", 23: "Amaura", 24: "Aurorus",
  25: "Volcanion", 26: "Shinx", 27: "Luxio", 28: "Luxray", 29: "Dedenne",
  30: "Clefairy", 31: "Mega Clefable ex", 32: "Mawile", 33: "Espurr",
  34: "Meowstic", 35: "Spritzee", 36: "Aromatisse", 37: "Nosepass", 38: "Probopass",
  39: "Hippopotas", 40: "Hippowdon", 41: "Landorus", 42: "Binacle", 43: "Barbaracle",
  44: "Tyrunt", 45: "Tyrantrum", 46: "Hawlucha", 47: "Mega Zygarde ex", 48: "Gastly",
  49: "Haunter", 50: "Gengar", 51: "Skorupi", 52: "Drapion", 53: "Yveltal ex",
  54: "Chien-Pao", 55: "Mega Skarmory ex", 56: "Honedge", 57: "Doublade",
  58: "Aegislash", 59: "Klefki", 60: "Rattata", 61: "Raticate", 62: "Meowth ex",
  63: "Snorlax", 64: "Bunnelby", 65: "Diggersby", 66: "Fletchling", 67: "Furfrou",
  68: "Antique Jaw Fossil", 69: "Antique Sail Fossil", 70: "Core Memory",
  71: "Crushing Hammer", 72: "Energy Search", 73: "Energy Swatter",
  74: "Hole-Digging Shovel", 75: "Jacinthe", 76: "Judge", 77: "Lumiose City",
  78: "Lumiose Galette", 79: "Naveen", 80: "Poké Ball", 81: "Poké Pad",
  82: "Pokémon Catcher", 83: "Potion", 84: "Rosa's Encouragement", 85: "Tarragon",
  86: "Growing Grass Energy", 87: "Rocky Fighting Energy", 88: "Telepathic Psychic Energy",
  89: "Spewpa", 90: "Rowlet", 91: "Talonflame", 92: "Aurorus", 93: "Dedenne",
  94: "Clefairy", 95: "Espurr", 96: "Probopass", 97: "Drapion", 98: "Doublade",
  99: "Raticate", 100: "Decidueye ex", 101: "Salazzle ex", 102: "Mega Starmie ex",
  103: "Mega Clefable ex", 104: "Mega Zygarde ex", 105: "Yveltal ex",
  106: "Mega Skarmory ex", 107: "Meowth ex", 108: "Energy Recycler",
  109: "Forest of Vitality", 110: "Jacinthe", 111: "Lumiose City", 112: "Naveen",
  113: "Poké Pad", 114: "Rosa's Encouragement", 115: "Sacred Ash", 116: "Tarragon",
  117: "Wondrous Patch", 118: "Mega Starmie ex", 119: "Mega Clefable ex",
  120: "Mega Zygarde ex", 121: "Meowth ex", 122: "Jacinthe",
  123: "Rosa's Encouragement", 124: "Mega Zygarde ex",
};

// Raw USD market prices per card (sourced from public TCG aggregators, May 2026)
export const PRICES_USD = {
  1: 0.12, 2: 0.08, 3: 0.11, 4: 0.08, 5: 0.12, 6: 0.10, 7: 0.13, 8: 0.15,
  9: 0.13, 10: 0.13, 11: 0.13, 12: 0.48, 13: 0.09, 14: 0.16, 15: 0.13, 16: 0.52,
  17: 0.11, 18: 0.08, 19: 0.15, 20: 0.14, 21: 1.04, 22: 0.46, 23: 0.19, 24: 0.15,
  25: 0.09, 26: 0.11, 27: 0.12, 28: 0.11, 29: 0.13, 30: 0.14, 31: 0.61, 32: 0.14,
  33: 0.13, 34: 0.12, 35: 0.08, 36: 0.11, 37: 0.09, 38: 0.12, 39: 0.10, 40: 0.12,
  41: 0.08, 42: 0.15, 43: 0.14, 44: 0.20, 45: 0.23, 46: 0.09, 47: 0.74, 48: 0.16,
  49: 0.21, 50: 0.45, 51: 0.14, 52: 0.06, 53: 0.65, 54: 0.13, 55: 0.57, 56: 0.16,
  57: 0.12, 58: 0.13, 59: 0.11, 60: 0.16, 61: 0.11, 62: 5.13, 63: 0.18, 64: 0.07,
  65: 0.13, 66: 0.11, 67: 0.07, 68: 0.18, 69: 0.16, 70: 0.13, 71: 0.13, 72: 0.13,
  73: 0.10, 74: 0.14, 75: 0.14, 76: 0.16, 77: 0.09, 78: 0.23, 79: 0.13, 80: 0.10,
  81: 0.46, 82: 0.12, 83: 0.15, 84: 0.20, 85: 0.18, 86: 0.23, 87: 0.20, 88: 0.33,
  89: 2.61, 90: 5.53, 91: 2.81, 92: 4.13, 93: 6.94, 94: 27.54, 95: 4.68, 96: 1.29,
  97: 1.72, 98: 3.64, 99: 3.53, 100: 4.61, 101: 2.41, 102: 13.46, 103: 7.25,
  104: 10.95, 105: 7.19, 106: 6.39, 107: 20.56, 108: 3.47, 109: 7.58,
  110: 5.05, 111: 2.84, 112: 2.89, 113: 22.85, 114: 12.46, 115: 3.63, 116: 4.33,
  117: 4.83, 118: 83.80, 119: 71.73, 120: 104, 121: 168, 122: 34.21, 123: 83.16,
  124: 165,
};

// Mega Evolution / ex cards (no Common/Holo/RH variants)
export const EX_NUMBERS = new Set([12, 16, 21, 22, 31, 47, 53, 55, 62]);
export const isVariantEligible = (n) =>
  n <= PRINTED_TOTAL && !EX_NUMBERS.has(n);

export const VARIANTS = ["Common", "Holo", "Reverse Holo"];

export const valueOf = (n, currency) =>
  (PRICES_USD[n] || 0) * (RATES[currency]?.rate || 1);

export const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10) return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

export function tierFor(n) {
  if (n > 117) return "gold";
  if (n > PRINTED_TOTAL) return "illustration";
  if (EX_NUMBERS.has(n)) return "ex";
  if (n >= 75 && n <= 85) return "trainer";
  if (n >= 86 && n <= 88) return "energy";
  return "base";
}

export const TIER_STYLES = {
  base: "bg-gradient-to-br from-[#1a2a1a] to-[#0e1410] text-[#b9ff3c]/70 border border-[#2a3a2a]",
  trainer: "bg-gradient-to-br from-[#3a2e0e] to-[#1a1408] text-amber-300 border border-amber-900/40",
  energy: "bg-gradient-to-br from-[#3a3408] to-[#1a1604] text-yellow-300 border border-yellow-900/40",
  ex: "bg-gradient-to-br from-[#3a0e2e] to-[#1a081a] text-pink-300 border border-pink-900/40",
  illustration: "bg-gradient-to-br from-[#2a0e3a] via-[#3a0e2e] to-[#0e1a3a] text-violet-200 border border-violet-700/40",
  gold: "po-holo text-black border border-yellow-300/60",
};

export const TIER_LABELS = {
  base: "Pokémon",
  trainer: "Trainer",
  energy: "Energy",
  ex: "ex",
  illustration: "Illustration",
  gold: "Hyper Rare",
};
