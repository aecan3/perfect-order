const VARIANT_LABELS = {
  holofoil:                  "Holofoil",
  reverse_holofoil:          "Reverse Holo",
  normal:                    "Normal",
  pokeball_reverse_holofoil:    "Poké Ball Pattern",
  masterball_reverse_holofoil:  "Master Ball Pattern",
};

function humanizeVariant(slotKey) {
  return VARIANT_LABELS[slotKey] ||
    slotKey.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Returns the human-readable label for a printing_type.
// Used on want-list tiles so a vendor knows which version to pull.
// Examples:
//   "holofoil"              → "Holofoil"
//   "reverse_holofoil"      → "Reverse Holo"
//   "first_edition_holofoil"→ "1st Edition · Holofoil"
//   "unlimited_holofoil"    → "Unlimited · Holofoil"
//   "first_edition"         → "1st Edition · Normal"
//   "shadowless"            → "Shadowless · Normal"
export function humanizeEditionLabel(printingType) {
  if (printingType === "first_edition") return "1st Edition · Normal";
  if (printingType === "unlimited")     return "Unlimited · Normal";
  if (printingType === "shadowless")    return "Shadowless · Normal";
  if (printingType.startsWith("first_edition_")) return `1st Edition · ${humanizeVariant(printingType.slice(14))}`;
  if (printingType.startsWith("unlimited_"))     return `Unlimited · ${humanizeVariant(printingType.slice(10))}`;
  if (printingType.startsWith("shadowless_"))    return `Shadowless · ${humanizeVariant(printingType.slice(11))}`;
  return humanizeVariant(printingType);
}

// Strips the edition prefix from a printing_type, returning the base type.
// WOTC edition types collapse to the same base: first_edition + unlimited → normal,
// first_edition_holofoil + unlimited_holofoil → holofoil.
// Modern types (no edition prefix) are returned unchanged.
export function stripEditionPrefix(printingType) {
  if (printingType.startsWith("first_edition_")) return printingType.slice(14);
  if (printingType.startsWith("unlimited_"))     return printingType.slice(10);
  if (printingType.startsWith("shadowless_"))    return printingType.slice(11);
  if (printingType === "first_edition" || printingType === "unlimited" || printingType === "shadowless") return "normal";
  return printingType;
}

// Slot key: edition-collapsed identity for a printing.
// Two printings with the same slot key count as one collectible unit.
export function getSlotKey(cardNumber, printingType) {
  return `${cardNumber}::${stripEditionPrefix(printingType || "")}`;
}

// Returns the edition options present in a set's printings array.
// Edition prefixes: 'first_edition', 'shadowless', 'unlimited'.
// Types without a prefix (normal, holofoil, reverse_holofoil, etc.) are
// edition-neutral — they don't belong to an edition and never trigger a toggle.
// Returns [] or ['unlimited'] → no toggle. Returns 2+ prefixes → show toggle.
export function getEditionOptions(printings) {
  const prefixes = new Set();
  for (const p of printings) {
    if (p.printing_type.startsWith("first_edition")) prefixes.add("first_edition");
    else if (p.printing_type.startsWith("unlimited"))   prefixes.add("unlimited");
    else if (p.printing_type.startsWith("shadowless"))  prefixes.add("shadowless");
  }
  return [...prefixes].sort(); // alphabetical: first_edition, shadowless, unlimited
}

// Returns true if the printing_type matches the given edition mode.
// 'any' and 'all' always return true (no filter).
export function matchesEdition(printingType, mode) {
  if (mode === "any" || mode === "all") return true;
  return printingType.startsWith(mode);
}

// Anon edition mode — stored in ms_anon_entries.setModes (top-level key beside entries).
// Absent = 'any'. Never uses separate localStorage keys.
export function getAnonEditionMode(setId) {
  try {
    const raw = localStorage.getItem("ms_anon_entries");
    if (!raw) return "any";
    const parsed = JSON.parse(raw);
    const mode = parsed.setModes?.[setId];
    return (mode && ["any","all","first_edition","unlimited","shadowless"].includes(mode)) ? mode : "any";
  } catch { return "any"; }
}

export function setAnonEditionMode(setId, mode) {
  try {
    const raw = localStorage.getItem("ms_anon_entries");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.setModes = { ...(parsed.setModes || {}), [setId]: mode };
    localStorage.setItem("ms_anon_entries", JSON.stringify(parsed));
  } catch { /* ignore */ }
}
