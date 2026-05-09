# Perfect Order — Claude Context

## Stack

- **Framework**: Next.js 16 App Router (JavaScript, not TypeScript)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + RLS)
- **Hosting**: Vercel
- **PWA**: Custom service worker at `public/sw.js`

## Local environment

- **Path**: `C:\Users\alexc\Documents\perfect-order`
- **Package manager**: npm
- **Node**: run `npm run dev` to start local server

## Key npm scripts

| Script | Purpose |
|---|---|
| `seed:sets` | Seed set metadata from Limitless TCG API |
| `seed:printings` | Seed card printings for all sets |
| `seed:manual` | Seed manual printings (me3, me2pt5, zsv10pt5, etc.) |
| `seed:priceless` | Seed sets whose printings have no prices yet |
| `seed:missing` | Seed manual printings for sets that have cards but zero printings |
| `reseed:empty` | Re-seed card data for sets with zero cards |
| `patch:set` | Patch a specific set's data |
| `patch:limitless` | Patch data sourced from Limitless TCG |
| `audit:counts` | Audit raff's card counts vs DB |
| `audit:sets` | Audit set completeness |
| `extract:themes` | Extract colour themes from set logos |
| `fix-seeding` | Fix broken seed data |

## Database tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (handle, display_name, avatar_url) |
| `friendships` | Friend relationships (user_a, user_b, status: pending/accepted) |
| `sets` | TCG set metadata (code, name, series, logo_url, theme_primary/secondary/bg) |
| `cards` | Individual cards (number, name, set_id, rarity, image_url) |
| `printings` | Card printings with variants (card_id, set_id, price_usd, variant info) |
| `user_sets` | Sets a user has added to their collection (user_id, set_id, added_at, hidden_at) |
| `user_set_preferences` | Per-user per-set UI preferences (e.g. view mode) |
| `collection_entries` | Cards a user owns (user_id, set_id, card_number, printing_id, checked, photo_url, duplicate_count, updated_at) |

## Established coding patterns

**Two-query split for sets**: Never use a nested aggregate like `printings!printings_set_id_fkey(count)` inside a join — PostgREST silently returns `[]`. Instead: fetch `user_sets`, then separately fetch `sets` with `.in("id", setIds)`, and use a flat top-level count query if needed.

**Paginated fetchAllEntries**: `collection_entries` has no `.limit()` — use a `.range()` loop with PAGE=1000 that breaks when a page returns fewer rows than PAGE. This is the canonical pattern in both `app/page.js` and `app/friend/[handle]/page.js`.

```js
const fetchAllEntries = async (userId) => {
  const PAGE = 1000;
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("collection_entries")
      .select("set_id, printing:printings(price_usd)")
      .eq("user_id", userId)
      .eq("checked", true)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
};
```

**Number() coercion on printing counts**: PostgREST returns aggregate counts as strings. Always coerce: `Number(set.printings?.[0]?.count) || 0`.

**ownedPrintingsRef pattern**: When a debounced write needs current state, assign `ref.current = state` directly in the render body (not in useEffect). The debounce closure captures `ref` and reads `.current` at fire time.

## PWA service worker

Cache name: `"perfect-order-v2"` in `public/sw.js`.  
To force-evict all cached entries after a strategy change: bump to `"perfect-order-v3"` (or next version).  
Current strategies:
- Navigate requests → NetworkFirst (always fetch fresh HTML)
- `/_next/static/` → StaleWhileRevalidate (content-hashed, safe to cache)
- Everything else → NetworkFirst

## Known large collections

- **raffertydall**: ~1598 checked entries across 5 sets. Always test pagination and home-page count logic against this account — it exceeds the PostgREST 1000-row default and has historically exposed truncation bugs.
