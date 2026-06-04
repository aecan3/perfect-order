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
