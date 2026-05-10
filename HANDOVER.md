# Handover Notes — 2026-05-10 (Session 3)

## Session summary

Social/trading layer, discover panel, full messaging system, smart friend search, welcome/landing page, and PokéBinder rebrand. Several encoding and redirect bugs fixed. All changes committed and pushed to main; Vercel auto-deploys from main.

Previous session notes (design system, animations, master set celebration) are preserved at the bottom of this file.

---

## Bugs fixed this session

### collection_entries 1000-row truncation (home page + friend page)
**Root cause**: PostgREST default 1000-row cap. Raff has ~1598 entries. Single `.select()` calls silently returned only 1000 rows, making set values and checked counts wrong.

**Fix**: Paginated `.range()` loop with `PAGE=1000`. Runs until a page returns fewer rows than PAGE.

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

**Files changed**: `app/page.js`, `app/friend/[handle]/page.js`

---

### Unauthenticated users landing on /login instead of /welcome
**Root cause**: `proxy.js` (Next.js middleware) was redirecting all unauthenticated requests to `/login`, and `/welcome` was not in `PUBLIC_PATHS`, so it also got intercepted and redirected — creating a redirect loop.

**Fix**: Added `/welcome` to `PUBLIC_PATHS` and changed the redirect target from `/login` to `/welcome`.

**File changed**: `proxy.js`

---

### Character encoding corruption throughout the app
**Root cause**: Windows PowerShell 5.1 default encoding (UTF-16 LE) corrupting multibyte UTF-8 characters when files were batch-processed. Affected: `é` → `Ã©`, `·` → `Â·`, `✦` → `âœ¦`, `…` → `â€¦`, `£` → `Â£`.

**Fixes applied**:
- `Loading…` → `Loading...` (plain ASCII, avoids encoding issues entirely)
- Discover label `Â·` → `&mdash;` HTML entity
- Master Set badge `âœ¦` → `&#10022;` HTML entity
- GBP symbol `Â£` → literal `£` in RATES object
- `PokéBinder` in JSX → `Pok{"é"}Binder` or `const BRAND = "PokéBinder"` constant at file top (prevents Prettier mangling)

**Files changed**: `app/page.js`, `app/friends/page.js`, `app/messages/page.js`, `app/discover/page.js`, `app/sets/page.js`, `app/login/page.js`, `app/welcome/page.js`, `app/layout.js`

---

## Features built this session

### 1. Discover panel — home page (`app/page.js`)

Horizontal snap-scroll row of card thumbnails in the middle of the home page. Shows cards that friends own as duplicates that the logged-in user is missing.

**Data fetch** (non-blocking IIFE, fires after `setLoading(false)` so it never delays the main page):
1. Load accepted friendships
2. Load friends' `collection_entries` where `duplicate_count > 0`
3. Load user's own entries where `checked = false` (missing cards)
4. Cross-reference by `printing_id` OR `set_id:card_number` key
5. Sort by `price_usd` desc, limit 20
6. Image source: `printing.image_url` with fallback to `printing.card.image_large`

**Key PostgREST join** (must use alias syntax):
```js
.select("..., printing:printings(price_usd, image_url, card:cards(name, image_large)), set:sets(name, code)")
```
Do NOT use `card:cards(name, image_url)` — `image_url` doesn't exist on the `cards` table, only on `printings`.

**Tap behaviour**: opens a bottom sheet modal with two actions:
- "View in @handle's collection" → `/friend/${handle}/${setId}?from=discover`
- "Message @handle" → `/messages/${handle}?card=<json>`

**Panel hidden** when `discoverCards` is null (loading) or empty.

---

### 2. /discover full page (`app/discover/page.js`)

Same data fetch as the home panel but without the 20-card limit. Cards grouped by friend handle, displayed as a 3-column grid.

**Multi-select with single-friend lock**:
- `selected`: `Set` of card keys (`${printingId}:${friendHandle}`)
- `selectedFriend`: derived from `selectedCards[0]?.friendHandle ?? null`
- `toggleCard`: blocks selection if `selectedFriend && card.friendHandle !== selectedFriend`
- Other friends' cards: `opacity: 0.3`, `disabled={true}`
- "Select All" only selects cards from the locked friend
- Sticky bottom bar (fixed, z-20): "Message @handle" button per friend in selected set

**Filters**: set dropdown + minimum value dropdown, hidden during selection mode.

**Navigation back to discover**: `/friend/[handle]/[setId]/page.js` reads `?from=discover` param and sets back arrow destination accordingly.

---

### 3. Messaging system

**Database migration** (`messages` table):
```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  message_type text NOT NULL DEFAULT 'message', -- 'message' | 'trade_proposal'
  metadata jsonb
);
```
RLS policies: users can SELECT their own messages (sender or recipient), INSERT as sender, UPDATE read=true on received messages.

**Inbox** (`app/messages/page.js`): groups all messages by the other participant, shows last message preview, time-ago timestamp, unread dot.

**Thread** (`app/messages/[handle]/page.js`):
- Resolves other user by handle from profiles table
- Loads messages with `.or(and(sender=me,recipient=other),and(sender=other,recipient=me))`
- Auto-marks received messages read on open
- Realtime: `supabase.channel('thread:${[userId, otherId].sort().join(":")}')` with `postgres_changes` INSERT listener
- Bubbles: lime (#c8ff4a) background right (sent), dark left (received), 4px tail radius
- Card previews in bubble: horizontal scroll row, 88px wide per card, `maxWidth: 280`

**Card attachment via URL params**:
- `?card=<json>` — single card (legacy, still parsed)
- `?cards=<json-array>` — bulk from discover multi-select
- `?prefill=<text>` — pre-populated message body
- After first send, `router.replace('/messages/${handle}')` strips card params

**Unread badge** on home page header: non-blocking count query after main load. Red dot with count on MessageCircle icon.

---

### 4. Smart friend search (`app/friends/page.js`)

Replaced exact-handle input with debounced fuzzy search:
- Fires 300ms after last keystroke
- Queries `profiles` with `.or('handle.ilike.%q%,display_name.ilike.%q%').limit(8)`
- Dropdown below input shows avatar initial + display name + @handle
- Excludes existing friends and self from results
- Tapping a result locks it in (`selectedResult` state); submitting sends without second DB lookup
- Dropdown closes on outside click (mousedown listener on `document`)
- "No users found" shown when search returns empty

---

### 5. Welcome / landing page (`app/welcome/page.js`)

Pre-login landing page at `/welcome`. Logged-in users are immediately redirected to `/`. All protected routes now redirect to `/welcome` (not `/login`) via `proxy.js`.

**Platform detection** (client-side, in `useEffect`):
- `standalone` check: `window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches`
- iOS: `/iPad|iPhone|iPod/.test(ua)`
- Android: `/Android/.test(ua)`

**Android**: shows native "Install App" button when `beforeinstallprompt` fires; manual instructions if event never fires (already installed, or unsupported).

**iOS** (6-step guide matching iOS 17+ Safari UI):
1. Open in Safari (not Chrome)
2. Tap the **...** button (bottom right corner)
3. Tap **Share**
4. Tap **View More**
5. Tap **Add to Home Screen**
6. Tap **Add** (top right)

Note shown: Apple does not allow programmatic install on iOS — must be done manually through Safari.

**Other platforms**: generic "open in Safari/Chrome" message.

---

### 6. PokéBinder rebrand

- `public/manifest.json`: `name` and `short_name` updated to `"PokéBinder"`
- `app/layout.js`: `metadata.title`, `metadata.appleWebApp.title` updated
- `app/login/page.js`: heading updated (using `Pok{"é"}Binder` to prevent Prettier mangling)
- `app/welcome/page.js`: `const BRAND = "PokéBinder"` constant at top, used in JSX
- `public/sw.js`: cache bumped from `perfect-order-v2` → `perfect-order-v3` to force all existing installs to pick up the new name and clear old cached pages

---

### 7. Home page header updates (`app/page.js`)

- **Friends button**: pill-shaped with lime text, `Users` icon + "Friends" label — primary nav feel, not a utility icon. Style: `bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-green)] rounded-full px-3 py-1.5`
- **Messages icon**: `MessageCircle` with red unread badge (count, or "9+" if >9)
- **Logout**: `LogOut` icon, utility weight

---

## Current state of all features

| Feature | Status | Notes |
|---|---|---|
| Paginated `fetchAllEntries` | ✅ Deployed | Home + friend pages. PAGE=1000 loop. |
| SW caching strategy | ✅ Deployed | Cache **v3**, NetworkFirst for HTML/other, StaleWhileRevalidate for `_next/static/` |
| Price badge on all cards | ✅ Deployed | Owned and unowned |
| 3-way view toggle (Rarity/Binder/Missing) | ✅ Deployed | Persists to localStorage `po:setView` |
| Duplicate counter | ✅ Deployed | Debounced 800ms, `duplicate_count` column live in prod |
| Holo design system | ✅ Deployed | `globals.css`, all pages |
| RaritySection animations | ✅ Deployed | Bar fill on load, shimmer+badge on 100%, real-time completion |
| MasterSetCelebration | ✅ Deployed | Full cinematic overlay, auto-dismiss 4s, canvas particles |
| Home page master set card treatment | ✅ Deployed | Gradient border + glow + colour wash + &#10022; badge |
| Theme colour DB fixes | ✅ Applied | CRZ, ASC, PFL, POR corrected in Supabase |
| proxy.js auth middleware | ✅ Deployed | `/welcome` in PUBLIC_PATHS, redirects unauthenticated to `/welcome` |
| Discover panel (home page) | ✅ Deployed | Non-blocking, hidden if empty, bottom sheet modal |
| /discover full page | ✅ Deployed | Multi-select, single-friend lock, bulk message |
| Messaging system | ✅ Deployed | DB table, RLS, inbox, thread, realtime, card previews |
| Unread badge on messages icon | ✅ Deployed | Non-blocking count query, red dot |
| Smart friend search | ✅ Deployed | Debounced ilike, dropdown, excludes existing friends |
| Welcome landing page | ✅ Deployed | Platform-aware PWA install instructions |
| PokéBinder rebrand | ✅ Deployed | manifest, layout, login, SW v3 |

---

## What still needs testing

- [ ] Discover panel appears on home page when friends have duplicates you're missing
- [ ] Discover bottom sheet shows both buttons (View in collection + Message)
- [ ] /discover multi-select locks to one friend — other friends' cards dim and become untappable
- [ ] Message thread shows card attachment as horizontal scroll row (not vertical stack)
- [ ] Real-time message delivery (send from one account, receive on another)
- [ ] Unread badge clears when you open the thread
- [ ] Smart friend search: partial match on handle and display name works
- [ ] Smart friend search: existing friends excluded from dropdown
- [ ] Welcome page shown to logged-out users (not /login)
- [ ] Welcome page: logged-in users bypass immediately to /
- [ ] iOS install guide shows correct 6-step flow
- [ ] Android install button triggers native prompt when available
- [ ] PokéBinder name appears correctly in manifest (check on installed PWA)

---

## Known issues

- **Linter encoding corruption**: The project's linter (Prettier) runs on file save and corrupts non-ASCII characters in files it processes. Workaround: use HTML entities (`&mdash;`, `&#10022;`) or JSX string expressions (`{"é"}`) for any special characters. Never use raw Unicode in string literals that Prettier might reformat.
- **Test data not reverted**: `raffertydall`'s `me3-118-holofoil` has `duplicate_count=1` and `alex2`'s same printing also has `duplicate_count=1`. These were set for discover panel testing. Revert both to 0 in Supabase when testing is complete.
- **Login page accessible directly**: `/login` is in `PUBLIC_PATHS` so users with bookmarks can still navigate there directly. This is intentional — the page works fine — but users who type the URL won't see the welcome page first.

---

## Pending decisions

### App name
Currently branded as **PokéBinder**. Considering **Pokebase** (no accented characters, simpler to type, potentially cleaner for trademark). If renamed:
- Update `manifest.json` `name` and `short_name`
- Update `app/layout.js` metadata
- Update `app/login/page.js` heading
- Update `app/welcome/page.js` `BRAND` constant
- Bump SW cache version (`perfect-order-v3` → `perfect-order-v4`)

### App Store submission
Requires:
1. Apple Developer account ($149 AUD/year)
2. Native wrapper — Capacitor (recommended) or a custom WKWebView shell
3. Privacy policy page (required by Apple, must be hosted at a public URL)
4. App Store screenshots and metadata
5. Review — Pokémon-adjacent apps get extra scrutiny; ensure no official assets or names are used

### Custom domain
Purchase externally (e.g. Namecheap, Cloudflare Registrar), then:
1. Add domain in Vercel project settings → Domains
2. Set DNS A/CNAME records as instructed by Vercel
3. Update `manifest.json` `start_url` and `scope` if needed
4. Update Supabase project → Authentication → URL Configuration with new domain

---

## Architecture reminders

### Two-query split for user_sets + sets
Never use nested aggregates like `printings!printings_set_id_fkey(count)` inside a join — PostgREST silently returns `[]`. Fetch `user_sets`, then separately fetch `sets` with `.in("id", setIds)`, and use a flat top-level count query if needed.

### Paginated fetchAllEntries — use everywhere
Any query on `collection_entries` that doesn't have a tight `.limit()` must use the `.range()` loop. Apply this pattern in every new page that reads a user's full collection.

### PostgREST join aliases
Correct: `printing:printings(price_usd, image_url, card:cards(name, image_large))`
Wrong: `card:cards(name, image_url)` — `image_url` doesn't exist on `cards`, only on `printings`

### Service worker
- Cache name: `perfect-order-v3`
- Bump to `perfect-order-v4` on the **next SW change** (strategy or precache URL change)
- Navigate requests → NetworkFirst (always fetch fresh HTML)
- `/_next/static/` → StaleWhileRevalidate
- Everything else → NetworkFirst
- `skipWaiting()` + `clients.claim()` — new SW activates immediately on install

### Auth middleware
`proxy.js` at project root (not `middleware.js` — Next.js 16 uses the export name `proxy` with a `config.matcher`).

PUBLIC_PATHS (no auth required):
```
/welcome, /login, /manifest.json, /sw.js, /icon-192.png, /icon-512.png, /apple-touch-icon.png, /favicon.ico
```
All other paths: redirect unauthenticated users to `/welcome`.

### Test account
- **raffertydall**: ~1598 checked entries. Always test pagination against this account.
- **alex2**: Test account for messaging and discover. Has `me3-118-holofoil` with `duplicate_count=1` for discover panel testing.
- Both accounts have an accepted friendship for discover/messaging flows.

---

## Files changed this session

| File | Changes |
|---|---|
| `proxy.js` | Added `/welcome` to PUBLIC_PATHS; redirect target `/login` → `/welcome` |
| `app/page.js` | Discover panel + modal, unread badge, Friends pill button, encoding fixes |
| `app/discover/page.js` | New file — full discover page with multi-select, single-friend lock |
| `app/messages/page.js` | New file — inbox page |
| `app/messages/[handle]/page.js` | New file — conversation thread with realtime and card previews |
| `app/friends/page.js` | Smart search with debounced dropdown replacing exact-match input |
| `app/friend/[handle]/[setId]/page.js` | Back arrow respects `?from=discover` param |
| `app/welcome/page.js` | New file — landing page with platform-aware PWA install guide |
| `app/login/page.js` | Heading updated to PokéBinder |
| `app/layout.js` | Title/meta updated to PokéBinder |
| `public/manifest.json` | name/short_name updated to PokéBinder |
| `public/sw.js` | Cache bumped v2 → v3, `/welcome` added to PRECACHE_URLS |

---

## Commit history this session (most recent first)

| Hash | Message |
|---|---|
| `f41586f` | fix: update iOS install guide to match iOS 17+ Safari UI |
| `fbf2bbf` | fix: loading ellipsis encoding, iOS install guide, Friends button prominence |
| `64bfdab` | fix: welcome page redirect, friends icon, and encoding issues |
| `6bb8f64` | feat: smart friend search, PokéBinder rebrand, and welcome/install page |
| `b8c13af` | fix: discover UX — modal both options, single-friend lock, horizontal card scroll |
| earlier | discover panel, messaging system, social features |

---

---

# Session 2 Notes — 2026-05-09

## Session summary

Full visual redesign to a "Holo" dark aesthetic, completion animations across the set tracker and home page, master set trophy treatment, cinematic celebration screen, and a theme colour database audit/fix for four sets.

## 1. Global design system — "Holo" direction

**File:** `app/globals.css` (full rewrite)

### CSS variables (`:root`)
```
--po-bg:           #050507
--po-bg-soft:      #0c0c12
--po-border:       rgba(255,255,255,0.07)
--po-border-strong:rgba(255,255,255,0.13)
--po-green:        #c8ff4a
--po-green-dim:    rgba(200,255,74,0.42)
--po-text:         #f4f4f6
--po-text-dim:     rgba(244,244,246,0.55)
--po-text-faint:   rgba(244,244,246,0.32)
--po-progress-track: rgba(255,255,255,0.08)
--po-panel:        rgba(255,255,255,0.025)
```

### Keyframes added
- `po-shimmer-sweep` — horizontal shimmer for progress bars
- `po-dot-pop` — scale pulse for rarity dot on 100% bucket
- `po-badge-in` — spring pop-in for Complete badge
- `po-master-border-shift` — slow 4s background-position cycle for master set gradient border
- `po-star-pulse` — alternating opacity/scale for &#10022; symbols
- `po-glow-pulse` — pulsing radial glow orb (celebration overlay)
- `po-logo-in`, `po-master-slide-up`, `po-master-slam` — celebration text reveals

### CSS classes
- `.po-dot-pop`, `.po-badge-in` — completion animations
- `.po-master-border-wrap` — animated gradient border wrapper
- `.po-master-star`, `.po-master-star-b` — star pulse, offset by 1.3s
- `.po-master-logo`, `.po-master-glow-orb`, `.po-master-title-1`, `.po-master-title-2` — celebration animations

## 2. Home page master set card treatment (`app/page.js`)

Master sets (`checkedCount >= total`) get:
1. **Gradient border wrapper** (`.po-master-border-wrap`): animated `linear-gradient(135deg, primary → secondary → primary)`
2. **Dual-layer glow**: tight 6px burst + 28–32px mid-halo + 60–70px wide bloom
3. **Background colour wash**: `radial-gradient(ellipse at 0% 55%, primary28, transparent)` from left edge
4. **Master Set badge**: full-width pill with &#10022; stars, inset glow
5. **Count stays**: `342 / 342`, percentage hidden (badge communicates completion)

## 3. Set tracker redesign (`app/set/[setId]/page.js`)

- Sticky header with logo, themed name, stats, gradient progress bar
- 3-way toggle: Rarity / Binder / Missing (persists to `localStorage`)
- `RaritySection` component: bar animates from 0 on mount, shimmer+badge on 100%, real-time completion detection via `prevPctRef`
- `MasterSetCelebration` component: 100 burst particles + 35 drifters, canvas at z-60, overlay at z-200, auto-dismiss at 4s

## 4. Theme colour DB fixes

| Set | Code | theme_primary | theme_secondary | theme_bg |
|---|---|---|---|---|
| Crown Zenith | CRZ | `#c8b8e8` | `#7c5cbf` | `#0d0a18` |
| Ascended Heroes | ASC | `#e8c840` | `#4dcfb8` | `#111214` |
| Phantasmal Flames | PFL | `#e0359a` | `#38c8d4` | `#080a14` |
| Perfect Order | POR | `#b9ff3c` | `#ff7820` | `#0a0e0a` |

---

---

# Session 1 Notes — 2026-05-09 (earlier)

## Bugs fixed

### collection_entries 1000-row truncation
**Root cause**: PostgREST 1000-row default cap. Raff has 1598 entries.
**Fix**: Paginated `.range()` loop (PAGE=1000) in `app/page.js` and `app/friend/[handle]/page.js`.

### Deployed fixes not reaching PWA users
**Root cause**: CacheFirst SW strategy; content-hashed chunks never evicted.
**Fix**: NetworkFirst for navigate + everything else; StaleWhileRevalidate for `_next/static/`; bumped to cache v2.

### manifest.json returning 401
**Root cause**: No auth middleware — Vercel deployment protection catching it.
**Fix**: `proxy.js` with `PUBLIC_PATHS` set.

### SW clone error
**Root cause**: `res.clone()` called inside async `caches.open().then()` — body consumed before clone.
**Fix**: Call `res.clone()` synchronously before the async chain.

## Features shipped

- Price badge on all cards (owned and unowned)
- Rarity/Binder toggle + Missing Only pill (later unified into 3-way toggle in session 2)
- Duplicate counter with debounced DB writes, `duplicate_count` column live in prod
