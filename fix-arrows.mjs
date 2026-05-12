import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('app/page.js', 'utf8');

// Replace all remaining non-ASCII problematic sequences in JSX string values.
// These appear as UTF-8 double-encoded byte sequences.
// We target only the ones that can break the JS parser (those whose byte sequences
// contain 0x22 = " or 0x27 = ' when misread).

// Safe replacements — use Unicode escapes so the source is pure ASCII in these spots
content = content
  // Corrupted ↑ (U+2191): bytes E2 86 91 read as windows-1252 → â†'
  .replace(/â†’/g, '↑')
  // Corrupted ↓ (U+2193): bytes E2 86 93 read as windows-1252 → â†" (93 = right-double-quote)
  .replace(/â†”/g, '↓')
  // Corrupted ▲ (U+25B2): E2 96 B2
  .replace(/â–²/g, '▲')
  // Corrupted ▼ (U+25BC): E2 96 BC
  .replace(/â–¼/g, '▼');

writeFileSync('app/page.js', content, 'utf8');
console.log('done');

// Show lines with non-ASCII in JS expressions
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (i >= 605 && i <= 615) console.log(i+1, JSON.stringify(l));
});
