import { readFileSync, writeFileSync } from 'fs';

// Read as raw UTF-8 string
let content = readFileSync('app/page.js', 'utf8');

// After the curly-quote-flattening script ran, the garbled arrows are now:
// ↑ (U+2191): originally E2 86 91, triple-encoded → now U+00E2 + U+2020 + straight single quote '
// ↓ (U+2193): originally E2 86 93, triple-encoded → now U+00E2 + U+2020 + straight double quote "
//
// We can't match these with normal string literals safely because they contain
// quote chars. Instead, build the patterns from code points.
const garbledUp   = 'â†\''; // â + dagger + straight single-quote  → was ↑
const garbledDown = 'â†"';  // â + dagger + straight double-quote   → was ↓

// Similarly for ▲ / ▼ (these appear in comments, not in expressions, but fix anyway)
// ▲ U+25B2: E2 96 B2 → â + U+2013(–) + ²  ... let's just leave comment chars alone
// Only fix the expression-breaking ones

content = content.replaceAll(garbledUp,   '↑');
content = content.replaceAll(garbledDown, '↓');

writeFileSync('app/page.js', content, 'utf8');
console.log('done');

// Verify line 608
const lines = content.split('\n');
console.log('line 607:', lines[606]);
console.log('line 608:', lines[607]);
