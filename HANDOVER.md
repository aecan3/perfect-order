# Handover Notes — 2026-05-09

## Session summary

This session fixed two production bugs (wrong home-page card counts for large collections, stale PWA cache) and shipped three new features to the set tracker. All changes are committed and pushed to main / deployed on Vercel.

---

## Bugs fixed

### 1. Wrong card counts on home page (and friend overview)

**Symptom**: Raff's home page showed sv6 = 0 and me2 = ~half the real number. The `audit:counts` script reported correct numbers — only the UI was wrong.

**Root cause**: `collection_entries` was queried with `.limit(10000)` (previously no explicit limit, which defaults to PostgREST's 1000-row cap). Raff has 1598 checked entries across 5 sets. PostgreSQL returns rows in heap order (the physical order pages were written). Raff's entries fill pages 0–22; with a 1000-row cap, PAR (Paradox Rift, ~428 entries, heap pages 15–22) was entirely cut off, and TWM/OBF were partially cut. The audit passed because it ran fresh queries per set.

**Fix**: Replaced `.limit(10000)` / no-limit queries with a paginated `.range()` loop (PAGE=1000) that concatenates pages until a page returns fewer rows than PAGE — guaranteeing all rows regardless of collection size.

**Files changed**: `app/page.js`, `app/friend/[handle]/page.js`

---

### 2. Deployed fixes not reaching PWA users (stale service worker cache)

**Symptom**: After fixing the count bug and deploying, Raff's PWA on iPhone was still showing wrong numbers. New JS bundles weren't being served — the PWA was returning stale cached chunks.

**Root cause**: The service worker (`public/sw.js`) was using `CacheFirst` for all non-navigate requests with cache name `"perfect-order-v1"`. Because Next.js content-hashed chunk URLs (e.g. `/_next/static/chunks/app/page-abc123.js`) never matched a new deploy's URLs, the old bundles sat in cache indefinitely — never evicted, never revalidated.

**Fix**:
- Bumped cache name to `"perfect-order-v2"` (forces eviction of all v1 entries on SW activation)
- `/_next/static/` → `StaleWhileRevalidate` (content-hashed so cached response for a URL is always correct; background fetch keeps cache warm)
- Navigate requests → `NetworkFirst` (always fetch fresh HTML, which carries the new chunk URLs)
- Everything else (RSC payloads, stable-URL assets) → `NetworkFirst` (always fresh)
- Added `skipWaiting()` + `clients.claim()` for immediate activation without waiting for tab close

**File changed**: `public/sw.js`

---

## Three new set tracker features

### Feature 1 — Price badge on all cards (including uncollected)

**What it does**: Shows a small price overlay in the bottom-right corner of every card image, whether or not the card is owned. Previously price was only shown as text below owned cards.

**Status**: Implemented and deployed. The overlay uses `bg-black/70` with theme primary colour text, `font-mono`, 9px. Uses the same `cardPrice` / `fmtMoney` logic already in the file.

**File changed**: `app/set/[setId]/page.js` — inside `renderCard`, the image container now has `relative` positioning and the price overlay is an absolutely positioned child.

---

### Feature 2 — Rarity/Binder segmented toggle + independent Missing Only pill

**What it does**: The old single "Master Set" toggle button was replaced with:
- A **segmented toggle** (Rarity | Binder) — active segment is filled with theme primary colour, inactive is dim. Persists to `localStorage` as `"po:masterSet"`.
- An **independent "Missing Only" pill** — when active, filters the card grid to only cards where at least one printing is uncollected. Works in both Rarity and Binder views. Does not persist (resets on navigation).

**Missing Only logic**: `missingFilter` checks if `checkedCount < prints.length` for the card. Section headers still show the full owned/total count for the unfiltered section (`section.cards.reduce(...)`) — only the rendered grid uses `section.displayCards` (the filtered subset). Empty sections are hidden; if the whole grid is empty, shows "All cards collected — nothing missing!"

**Status**: Implemented and deployed.

**File changed**: `app/set/[setId]/page.js` — header toggle markup, `missingOnly` state, `viewCards` / `viewSections` computed values, empty state message, `displayCards` usage in binder and rarity renders.

---

### Feature 3 — Duplicate counter per owned card

**What it does**: Below each owned card, shows a `+` button (and `−` button when duplicates > 0) with a count badge. Tapping `+` increments `duplicate_count` for that printing; `−` decrements (min 0). Writes are debounced 800ms per printing ID — rapid taps produce a single DB write.

**Implementation details**:
- `duplicate_count INTEGER NOT NULL DEFAULT 0` column added to `collection_entries` via Supabase migration.
- `collection_entries` select updated to include `duplicate_count`.
- `ownedMap` builder stores `duplicate_count` per printing.
- `dupTimersRef = useRef({})` holds per-printing-ID timeout handles (cleared on unmount).
- `ownedPrintingsRef.current = ownedPrintings` is set directly in the render body (not useEffect) so debounce closures always read current state at fire time.
- `handleDupChange(printingId, delta)` does optimistic state update → clears any pending timer → sets new 800ms timer → on fire, reads `ownedPrintingsRef.current` and upserts to Supabase.
- Only the `+` button is shown when `dupCount === 0`; both `−` and `+` appear when `dupCount > 0`.
- The counter row has `onClick={(e) => e.stopPropagation()}` so tapping `+`/`−` doesn't open the photo modal.

**Status**: Implemented and deployed. DB migration applied to production.

**File changed**: `app/set/[setId]/page.js` (state, refs, handler, renderCard UI). Supabase migration applied directly (no migration file in repo).

---

## All files changed this session

| File | What changed |
|---|---|
| `app/page.js` | Replaced `.limit(10000)` with paginated `fetchAllEntries` loop (PAGE=1000) |
| `app/friend/[handle]/page.js` | Same paginated fetch applied for friend's collection |
| `app/set/[setId]/page.js` | Three new features: price badge, rarity/binder+missing toggle, duplicate counter |
| `public/sw.js` | Complete caching strategy rewrite, cache bumped v1→v2 |
| `CLAUDE.md` | Created — permanent project context for future Claude sessions |
| `PLAN.md` | Created — blank structured template for task planning |
| `HANDOVER.md` | This file |

---

## Current codebase state

**Deployed and working:**
- Home page card counts correct for all collection sizes (paginated fetch)
- Friend overview card counts correct (same fix)
- PWA now picks up new deployments automatically (NetworkFirst + cache v2)
- Set tracker: price badge on all cards
- Set tracker: Rarity/Binder segmented toggle (replaces old Master Set button)
- Set tracker: Missing Only independent pill filter
- Set tracker: Duplicate counter with debounced writes
- `duplicate_count` column live in production `collection_entries`

**Not yet tested / known gaps:**
- Missing Only pill: edge case where a card has zero printings in DB — `missingFilter` would treat it as fully collected (0 < 0 is false). Unlikely to matter in practice but worth noting.
- Duplicate counter: only tracks duplicates on the `firstOwned` printing (the first printing the user has checked). If a user owns multiple printings of the same card, `−`/`+` only appears on the first. This is a known simplification.
- PWA cache eviction: Raff needs to close and reopen the app once for the v2 SW to activate and evict v1 entries. After that first refresh, all future deploys are picked up automatically.
- No automated tests exist. Manual testing against `raffertydall` (1598 entries, 5 sets) is the primary regression check for pagination logic.

---

## CLAUDE.md — what's in it

Permanent project context file at project root. Covers:
- Stack (Next.js 16 App Router, JS, Tailwind v4, Supabase, Vercel, PWA)
- Local path and package manager
- All npm scripts with purpose
- All DB tables with purpose
- Three established coding patterns:
  - Two-query split for sets (never nested PostgREST aggregate)
  - Paginated `fetchAllEntries` (`.range()` loop, PAGE=1000)
  - `Number()` coercion on PostgREST aggregate counts
  - `ownedPrintingsRef` pattern for debounced writes
- PWA cache version (currently v2, bump CACHE constant in `public/sw.js` to evict)
- Known large collection: raffertydall (1598 entries — always test pagination against this account)

---

## PLAN.md — what's in it

Blank structured template with sections: Goal, Files likely involved, Steps (numbered list), Done (checkbox list). Use it at the start of any non-trivial task to align on approach before writing code.

---

## Recommended next session startup

Load `CLAUDE.md` and this `HANDOVER.md` as context, then `/clear` stale session. CLAUDE.md gives Claude the permanent project shape; HANDOVER.md gives it what changed today and what to watch for.
