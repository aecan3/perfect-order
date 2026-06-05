import { stripEditionPrefix, humanizeEditionLabel } from "../edition-utils.js";

// Derives missing slots for a set.
//
// printings — Array<{id, card_number, printing_type}> for ONE set
// ownedPrintingIdSet — Set<string> of printing_ids the user owns (checked=true)
// editionMode — 'any'|'all'|'first_edition'|'unlimited'|'shadowless'
//
// Returns Array<{set_id, card_number, printing_id, edition_label}>
// where each row is ONE missing slot (not one printing) in 'any' mode.
export function missingCardsForSet(setId, printings, ownedPrintingIdSet, editionMode) {
  // Group printings by card_number
  const byCard = new Map();
  for (const p of printings) {
    if (!byCard.has(p.card_number)) byCard.set(p.card_number, []);
    byCard.get(p.card_number).push(p);
  }

  const results = [];

  for (const [cardNumber, prints] of byCard) {
    if (editionMode === "any") {
      // Group by stripped slot key
      const slotMap = new Map();
      for (const p of prints) {
        const key = stripEditionPrefix(p.printing_type);
        if (!slotMap.has(key)) slotMap.set(key, []);
        slotMap.get(key).push(p);
      }
      for (const [slotKey, slotPrints] of slotMap) {
        if (slotPrints.some(p => ownedPrintingIdSet.has(p.id))) continue;

        // Representative printing: prefer bare type (modern), then unlimited, then first_edition, then first
        const rep =
          slotPrints.find(p => p.printing_type === slotKey) ||
          slotPrints.find(p => p.printing_type.startsWith("unlimited_") || p.printing_type === "unlimited") ||
          slotPrints.find(p => p.printing_type.startsWith("first_edition_") || p.printing_type === "first_edition") ||
          slotPrints[0];

        // "· Any edition" only when 2+ printings exist in the slot (WOTC multi-edition only)
        const variantLabel = humanizeEditionLabel(slotKey);
        const edition_label = slotPrints.length >= 2
          ? `${variantLabel} · Any edition`
          : variantLabel;

        results.push({ set_id: setId, card_number: cardNumber, printing_id: rep.id, edition_label });
      }
    } else if (editionMode === "all") {
      for (const p of prints) {
        if (!ownedPrintingIdSet.has(p.id)) {
          results.push({
            set_id: setId,
            card_number: cardNumber,
            printing_id: p.id,
            edition_label: humanizeEditionLabel(p.printing_type),
          });
        }
      }
    } else {
      // Single-edition: first_edition | unlimited | shadowless
      const active = prints.filter(p => p.printing_type.startsWith(editionMode));
      for (const p of active) {
        if (!ownedPrintingIdSet.has(p.id)) {
          results.push({
            set_id: setId,
            card_number: cardNumber,
            printing_id: p.id,
            edition_label: humanizeEditionLabel(p.printing_type),
          });
        }
      }
    }
  }

  return results.sort((a, b) => a.card_number - b.card_number);
}
