// Rule 3 — grading-service tokens (word-bounded)
const GRADING_RE = /\b(PSA|BGS|CGC|TAG|BCCG|SGC|ACE|HGA|ISA|PCG)\b/i;

// Rule 4 — non-card item tokens
const NON_CARD_RE = /\b(poster|print|pin|enamel|metal\s+card|playmat|binder\s+page|sticker|magnet)\b/i;

// Rule 2 — slash-pattern, tolerates optional spaces around the slash
const SLASH_RE = /\b(\d+)\s*\/\s*(\d+)\b/g;

// Strip leading/trailing punctuation and common emoji ranges from the title
function normalise(title) {
  return (title || "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, " ")   // emoji block
    .replace(/[☀-➿]/gu, " ")           // misc symbols
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "")
    .trim();
}

/**
 * Match a single listing title against a set of candidate printings.
 *
 * @param {string} title
 * @param {Array<{printing_id: string, set_id: string, card_number: number, card_name: string, set_total: number}>} candidatePrintings
 * @returns {{ printing_id: string, set_id: string, card_number: number } | null}
 */
export function matchListing(title, candidatePrintings) {
  const normalised = normalise(title);
  const upper = normalised.toUpperCase();

  // Rule 3 — drop graded cards
  if (GRADING_RE.test(normalised)) return null;

  // Rule 4 — drop non-card items
  if (NON_CARD_RE.test(normalised)) return null;

  // Rule 2 — extract all slash-pairs from the title
  const slashPairs = [];
  let m;
  SLASH_RE.lastIndex = 0;
  while ((m = SLASH_RE.exec(normalised)) !== null) {
    slashPairs.push({ num: Number(m[1]), total: Number(m[2]) });
  }
  if (!slashPairs.length) return null;

  // Find candidates that match any slash-pair exactly on (card_number, set_total)
  const slashMatches = candidatePrintings.filter((p) =>
    slashPairs.some((pair) => pair.num === p.card_number && pair.total === p.set_total)
  );
  if (!slashMatches.length) return null;

  // Rule 1 — among slash-matched candidates, require card name present in title
  const nameMatches = slashMatches.filter((p) =>
    upper.includes(p.card_name.toUpperCase())
  );
  if (!nameMatches.length) return null;

  // If multiple survive (same card_number in two sets with same total — rare),
  // prefer the one whose set_id appears first in the title as a plain substring;
  // otherwise take the first candidate (caller controls ordering).
  const best = nameMatches.find((p) =>
    upper.includes(p.set_id.toUpperCase())
  ) ?? nameMatches[0];

  return {
    printing_id: best.printing_id,
    set_id:      best.set_id,
    card_number: best.card_number,
  };
}
