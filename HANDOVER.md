# Master Setter — Handover Note

*Updated end of session, 3 Jun 2026. Single source of truth for the next session.*
*Supersedes the previous handover note from session 7.*

---

## ✅ RESOLVED — marketplace cron back online (3 Jun 2026)

The cron-job.org 26-failure incident was **diagnosed and fixed 3 Jun 2026**. Root cause was NOT a timeout — the cron-job.org Authorization header Value field had been set to just `Bearer` with no token after prior secret-rotation work. `CRON_SECRET` in Vercel was correct and unchanged throughout; only the cron-job.org *sender* header was broken. Fix: re-added `Bearer <CRON_SECRET>` to the cron-job.org job header. BATCH_SIZE dropped 12 → 10 (commit `243e371`) to give ~8s headroom against the 30s cron-job.org limit (~22s actual at 10 cards). Test run post-fix: 200 OK, `{"refreshed":10,"errors":0,"durationMs":26549}` — healthy.

**Deferred marketplace work still stands** — see §1 and §18 below:
- Remove `.github/workflows/marketplace-pool-refresh.yml` (GitHub Actions rollback, now confirmed unneeded)
- Pool composition rebalance toward modern sets (me3/me4/me2pt5 currently ~6% of pool vs 73% vintage)
- $5 vs $10 price threshold decision
- me4 (Chaos Rising) pricing blocked on PokeScope upstream indexing

---

## 0. WHAT MASTER SETTER IS

A Pokémon TCG "master set" collection-tracking PWA with social trading. Users
track which cards they own, mark cards they want, add friends, message each
other, and arrange trades of physical cards between themselves. Master Setter
does not handle payment, does not escrow, is not a party to any trade.

**Stack:** Next.js 16 (App Router), Tailwind v4 (PostCSS), Supabase (Postgres
+ Auth, RLS on all tables, **Tokyo region — ap-northeast-1**), Vercel
(auto-deploys from `main`, GitHub `aecan3/perfect-order`). Project root:
`C:\Users\alexc\Documents\perfect-order`. Dark theme, IBM Plex Sans/Mono, lime
`#c8ff4a` accent on near-black `#07070a`, amber `#FFB830` for Grand Master /
favourites. User works primarily on iPhone PWA.

**Operator:** A E Cann Pty Ltd, ABN 98 655 390 284. Domain
`mastersettertcg.com`.

**Working-style discipline (proven critical this project):**
- Diagnose before fixing. Get hard evidence before theorising.
- Test on the real device before declaring something done. "Reasoned-through"
  is not "tested."
- When two fixes in a row don't move the symptom, stop fixing and go read the
  actual request path — the bug is somewhere nobody's looked.
- For SW-involved issues: check Network tab **Initiator column** early —
  `sw.js:NN` is ground truth.
- When changing data-model semantics (what a row's presence/absence means),
  audit every reader of that data, not just the writer being fixed.
- The user does all dashboard work (Vercel, Supabase, Resend, VentureIP) and
  runs Claude Code. Do NOT request OAuth access to their infrastructure.
- Stop when tired rather than stacking late changes. Auth changes especially.

---

## 1. CURRENT STATE — WHAT'S LIVE AND WORKING

Phase 4 (Trade Binder magnet acquisition flow) is fully shipped. Door A (anonymous binder action sheet → message thread) and Door B (anonymous catalog browse → localStorage collection → signup migration → restored real collection) are both live on production. Next phase: real-traffic observation, polish, and the deferred items listed in §7 / §18.

### Auth surface — complete
- Custom domain `mastersettertcg.com` live, SSL, `www` 307s to bare domain
- Resend transactional email — verified, sending from
  `noreply@send.mastersettertcg.com`, **proven delivering** (Gmail confirmed,
  Outlook reputation now built up)
- Supabase Auth routed through Resend custom SMTP (verified)
- Login, signup, forgot-password, reset-password, email confirmation — all
  branded, all working end-to-end
- Both auth emails (reset + confirm) use the real Master Setter logo (PNG
  hosted at `mastersettertcg.com/brand/master-setter-stacked-email.png`),
  dark theme, on-brand
- Auth flow: `signUp()` → "check your email" screen → confirmation email →
  `/auth/confirm` → `verifyOtp` → profile row created with all consent
  metadata → into the app

### Auth gate — proxy.js
- `proxy.js` is the app's server-side auth gate (Next.js 16 feature, NOT
  middleware.js — different filename/export). It runs before any page or API
  route. Logged-out users hitting any path NOT in `PUBLIC_PATHS` (or matched
  by a prefix check) get 307'd to `/welcome`.
- Documented at both the file level (35-line header comment) AND in
  `CLAUDE.md` so future sessions don't re-discover it.
- Current `PUBLIC_PATHS`: `/welcome`, `/login`, `/forgot-password`,
  `/reset-password`, `/auth/confirm`, `/terms`, `/privacy`, `/manifest.json`,
  `/sw.js`, `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`,
  `/favicon.ico`, `/api/admin/card-report-notify`, `/api/cron/trade-handover-prompts`,
  `/api/cron/marketplace-pool-refresh`, `/api/push/notify`, `/monitoring`.
  Plus prefix checks for `/icons/`, `/brand/`, `/trade-binder/`, `/sets`, `/set/`, `/friend/`.
- **Rule for any new public route/asset:** add to `PUBLIC_PATHS` or it gets
  silently gated. This has bitten three times across the project.

### Legal documents — live
- ToS v1.0 and Privacy Policy v1.0 live in `content/legal/terms.js` and
  `content/legal/privacy.js`. Last updated 16 May 2026. Governing law:
  Victoria. Reviewed by ChatGPT and Gemini, revised against their feedback.
- `lib/legalVersions.js` exports `TOS_VERSION = "1.0"`, `PRIVACY_VERSION = "1.0"`.
- `/terms` and `/privacy` routes render them, dark-themed, accessible to
  logged-out users.
- Signup form has the country dropdown + 18+/ToS/Privacy checkbox. Create
  Account button disabled until both are set. Both documents open in a modal
  without destroying the half-filled form.
- Profile row records: `country`, `tos_version`, `tos_agreed_at`,
  `privacy_version`, `privacy_agreed_at` (carried through `signUp()` user
  metadata → `/auth/confirm` → profile upsert).
- The legal integration spec with the pre-launch must-do list is at
  `docs/legal-integration-spec-v1.0.md`.

### Recent feature work
- Welcome page "Create Account" button now correctly routes to signup mode
  (was routing to sign-in)
- Suburb + postcode + state autocomplete component
  (`SuburbAutocomplete.jsx`) using a static AU locality dataset (18,085
  entries, ~134KB gzipped, cached by the SW for offline). Renders in the
  location-fallback flow when a user taps "Not now" on the location prompt.
- Location-permission explainer modal (`LocationExplainer.jsx`) — shown
  once before the OS geolocation prompt, with `ms_location_explained`
  localStorage flag, currently only triggered in `TradePanel.jsx` (see
  loose threads below).
- Profiles table migration run: added `country`, `tos_version`,
  `tos_agreed_at`, `privacy_version`, `privacy_agreed_at`, `suburb`,
  `postcode`, `state` columns. All nullable, existing rows unaffected.
- **useTableRefetch hook** — `lib/hooks/useTableRefetch.js`. Extracted
  shared Supabase real-time subscription pattern used in 4 sites: MSShell
  (unread messages), messages inbox, Discover page, home page. Uses
  `onChangeRef` to avoid stale closures. Third real-time use triggered the
  extraction per the rule of three (commits `d97d6e5`).
- **`lib/hooks/` is an emerging subsystem.** Two hooks now exist:
  `useTableRefetch` and `useLocation`. If a third hook lands, treat
  `lib/hooks/` as a real subsystem with its own conventions: `use*` naming,
  SSR-safe `typeof window !== "undefined"` guards, `createPortal` for UI
  output, `useCallback` for stable references. Don't add a hook here without
  following those patterns.
- **Discover real-time refresh** — Ticking a card now propagates to Discover
  in real time. Root cause of stale Discover was twofold: (a) no subscription
  on `collection_entries` for the viewer's own changes, fixed via
  `useTableRefetch`; (b) the `myHave` query in `getDiscoverMatches` was
  silently truncated at 1000 rows — raff had 2,618 checked entries — fixed
  with a paginated loop (same `PAGE=1000` pattern from CLAUDE.md). This also
  closed item 13 (Spewpa-style stale Discover). File: `lib/queries/discover.js`.
  Commits: `c311c4e`, `9e5990f`.
- **Thread scroll-to-bottom fixed** — All three scroll bugs in
  `app/messages/[handle]/page.js` resolved (commit `427bc75`):
  (1) opens in middle of all-read thread; (2) yanks user back when new message
  arrives while scrolled up; (3) lands in middle after returning from another
  surface. Root cause: `scrollIntoView` on `bottomRef` is ambiguous in the
  nested-scroll layout — the `overflow: hidden` outer wrapper qualifies as a
  scroll container under the CSS spec, so the browser could scroll the wrong
  ancestor. Fix: replaced `bottomRef` with `scrollContainerRef` attached to
  the inner `overflow-y: auto` div; all scroll-to-bottom calls now use
  `container.scrollTop = container.scrollHeight`. Also added an 80px
  near-bottom guard on the new-message auto-scroll so it doesn't yank the
  user back while reading history.
- **Drag-to-reorder sets on home page** — Edit-mode toggle: "Edit Order"
  button appears when 2+ sets exist; tapping enters reorder mode where sets
  become dnd-kit `SortableContext` items with GripVertical drag handles; Done
  upserts `sort_order` values to `user_set_preferences`; Cancel reverts
  in-memory. Order persists across sessions. New sets without a saved
  sort_order appear at the top (−1 fallback). Hide/Unhide/Remove keep
  `orderedSets` in sync. Migration: `sort_order integer` added to
  `user_set_preferences`, `collection_mode` made nullable (no rows existed).
  Files: `app/page.js`, `components/home/SortableSetCard.jsx`,
  `supabase/migrations/20260519000000_add_sort_order_to_user_set_preferences.sql`.
  Commit: `af71bc8`.
- **Card error reporting (`card_reports`)** — Users can flag data issues
  (wrong image, wrong name/number, wrong rarity, wrong price, missing card or
  variant, other) via a floating flag FAB on the set page. This is the
  **data-corrections funnel** and is entirely separate from the upcoming
  `user_reports` trust-and-safety funnel (items 5–7). The two funnels have
  different tables, different categories, and will have different admin queues.
  Mount site: `app/set/[setId]/page.js` — FAB is visible across all three view
  modes (rarity, binder, missing) from a single mount. The "four surfaces"
  phrasing in the original brief was based on a mistaken assumption that
  rarity/binder/missing were separate routes — they are not.
  Components: `components/ReportCardFAB.jsx` (flag button + toast),
  `components/ReportCardForm.jsx` (bottom-sheet form, `createPortal` to body,
  `zIndex: 9999`). Migration:
  `supabase/migrations/20260521000000_create_card_reports_table.sql`.
  RLS: authenticated insert (`reporter_id = auth.uid()`) + select-own only —
  no client-side update/delete.
  Notification email: Supabase webhook → `app/api/admin/card-report-notify/route.js`
  → Resend → `hello@mastersettertcg.com`. Email subject and body both show the
  human-readable set name (e.g. "Perfect Order") resolved live from `sets.name`,
  with the internal set_id in parentheses as a triage aid. Falls back to raw
  set_id if the lookup fails. Commits: `a5e9318`, `c74eee5`, `e1538c1`,
  `7dfb9f1`, `f41b163`, `a73ee67` — full pipeline verified end-to-end on device.
  **Admin queue is not yet built** — see item 38.

- **eBay Find Online domestic filter (`78c83ae`):** Added `&LH_PrefLoc=1` to
  the eBay search URL in `lib/ebay.js`, restricting results to items physically
  located in the buyer's domestic market rather than just items that ship there.
  Works across all 5 markets — `lib/ebay.js` already swaps the domain per market,
  `LH_PrefLoc=1` is universal. One-line change; no UI or API changes.

- **Avatar upload system (`6f89e01`, `98f7467`):** Profile pictures, end to end.
  Migration: `profiles.avatar_url` column + a public-read `avatars` Storage bucket
  with 4 RLS policies scoping writes to the owner's folder (`{user_id}/avatar.webp`
  via `storage.foldername()`). `lib/avatar.js` does client-side processing:
  `createImageBitmap` → center-crop to square → canvas 400×400 → WebP 0.85 →
  upload (upsert) → cache-busted public URL → persist to `profiles.avatar_url`.
  Upload UI on `/settings` (initial test surface) and `/you` (via the profile
  dashboard redesign). Read-surface pass: wired `avatar_url` through every avatar
  render site — `get_feed_events` (was returning `NULL::text` since the column
  didn't exist at M3 time), `FeedEventCard` comment authors (was hardcoded null),
  `/friends` search, `/messages` inbox + thread. Friend pages already worked via
  `select("*")`. HEIC on iPhone confirmed working (Safari decodes natively via
  `createImageBitmap`).

- **Duplicates storefront (`0de383c`, fixes `3228951`/`7e19085`/`c2d7d80`):**
  New `/duplicates/[handle]` page — a user's spare master-tier cards
  (`duplicate_count > 0`) as a trade shop window. `get_user_duplicates(target_user,
  viewer)` is a SECURITY DEFINER function returning the target's dupes enriched with
  `hunted_by_viewer` (does the viewer have this printing in favourites?). Privacy:
  non-friends are hard-blocked before any data fetch. One flat route serves own and
  friend views. Three fixes followed device testing: card images use
  `cards.image_large` (not the universally-NULL `printings.image_url`); the
  `--border-radius-md` / `--border-radius-lg` tokens were ghost variables
  (referenced but undefined — see §17); card aspect is 2.5/3.5 not 2/3.

- **Profile dashboard, Stage 1 (`86a5a28`) and Stage 2 (within `e5ddd7e`):**
  `/you` replaced a settings menu with a collector dashboard via a new shared
  `components/profile/ProfileView.jsx` component. `ProfileView` accepts `footer`
  and `headerAction` slots and is used by both `/you` (own view: gear → settings,
  friends face-pile, account menu) and `/friend/[handle]` (friend view: ⋯ overflow
  with Report/Block + speech-bubble → `/messages/[handle]`, mutual friends, inline
  collection set list). Hero = Hunting strip (up to 6 favourites as card art, sorted
  by price DESC). Stats row: Sets / Cards / DUPES (lime, tappable →
  `/duplicates/[handle]`). Friend page Stage 2 rewrite preserved the `is_blocked`
  RPC safety gate, Report/Block modals, and the paginated set-list pipeline verbatim.
  `/friends` page gained a per-row `MessageCircle` speech bubble → direct message.

- **Duplicates select-to-trade (`e5ddd7e`):** The duplicates storefront became
  interactive. Tap cards to multi-select (green `outline`). A fixed bottom bar
  ("N selected · Clear · Propose Trade") appears; `MSShell hideTabBar` hides the
  tab bar while the bar is visible (otherwise the bar is obscured — same pattern as
  Discover's selection mode). Propose Trade builds `?with=handle&requests=JSON`
  with the same param shape Discover uses, verified against `/trade/new`'s parser —
  selected cards pre-load as the "You want" side so the flow completes rather than
  erroring. Hunting (viewer-favourited) cards get a soft gold box-shadow halo
  (`rgba(255,184,48,0.55)`) distinct from the green selection outline; both can
  coexist on a tile. The big "Propose Trade" / "Message" buttons were removed from
  the friend-view profile in favour of the top-right speech-bubble + ⋯.

- **Navigable duplicates (`c974c0a`):** `get_user_duplicates` extended with
  `set_logo_url` and `rarity` return columns (required `DROP FUNCTION` + recreate —
  Postgres rejects `CREATE OR REPLACE` for return-type changes). Tile overlay
  restructured as a flex row (text `flex:1 minWidth:0`, logo `flex-shrink:0`) so
  the set name truncates before colliding with the logo. Sort pills (Price ↓/↑
  toggle, Name A–Z, Rarity rarest-first), client-side via `useMemo`. Rarity
  ranking extracted from `app/set/[setId]/page.js` to `lib/rarity.js`
  (`rarityBucket` + `BUCKET_ORDER`) and imported in both places — single source of
  truth. Set filter chips ("All" + one per set present, shown only when dupes span
  ≥2 sets). Filter + sort compose in one memo (filter first, sort second). Selection
  survives both (keyed by `printing_id`). Header restructured to eyebrow `@handle`
  + big "DUPLICATES" title instead of the wrapping `@handle's duplicates`.

- **Phase 4 Door B — anonymous browse + collection migration (commits `51c3716`, `d43aaf5`, `c1951a7`, `8f1a018`, `17fcb50`, `437f8e1`, `4f47932`):** Full anonymous acquisition funnel, end-to-end. Public catalog (`/sets`, `/set/[setId]`, `/friend/[handle]`) open to logged-out users; 2-item anonymous tab bar (Sets, Sign Up Free). Anonymous ticks saved to `ms_anon_entries` localStorage with per-entry `setId`. CTA count + value updates live via `ms-anon-entries-changed` custom event. Threshold modals (`card_threshold`) at 5/15/30/50 cards. On signup: `verifyOtp` → `/auth/confirm` catch-all migration block. On signin: catch-all migration block regardless of intent. Both paths call `POST /api/anonymous-migration`, which batch-upserts `collection_entries` AND `user_sets` (both are required — see §17 gotcha). localStorage cleared on full match; `ms_show_restore_toast` sessionStorage triggers a 5s lime bar on the landing set page. Service worker bumped v22→v23 with `/auth/*` and `/api/*` bypass rules. **Verified end-to-end on production: test7 account, 15 cards migrated to me4, MY SETS displays me4 correctly.**
  Key files: `lib/hooks/useCollectionState.js` (anonymous data layer, per-entry `setId`, `ms-anon-entries-changed` event), `components/AnonymousCollectionBlocker.jsx` (threshold/nav-away modals), `app/api/anonymous-migration/route.js` (authenticated POST endpoint, 500-entry cap), restore toast inline in `app/set/[setId]/page.js`.
  **Cross-context confirm behaviour (confirmed 4 Jun 2026, test10+test11):** If the user ticks cards in one browser context (e.g. incognito tab, iOS PWA) and then opens the email confirmation link in a *different* context (mail app → default browser), `localStorage` is empty at confirm time and the migration POST is silently skipped — resulting in an empty-looking account. This is not a code bug; it is a browser storage partition. **Recovery:** the `/login` catch-all runs on the user's next sign-in in the original context and migrates whatever is in `localStorage` at that point (proven working). **Future UX:** add a contextual hint on an empty MY SETS page ("Still missing your cards? Open the link in this browser, or sign in here to recover them") to reduce confusion.

- **Marketplace cron migration (GitHub Actions → cron-job.org, session 18+):** Diagnosis chain: GitHub Actions `*/10` schedule fires ~7×/day (not 144×/day) due to GitHub's known sub-hourly degradation → pool cycling at 140 cards/day vs 2,880 designed → vintage skew. Fix: `BATCH_SIZE` dropped **25→10** (12 at first in commit `81e9d5a`, then dropped further to 10 in commit `243e371`) to fit cron-job.org's 30s timeout (~22s actual at ~2.2s/card). cron-job.org fires every **5 minutes** (5 min × 10 cards = ~2,880/day, ~18h full pool cycle). Auth: `Authorization: Bearer CRON_SECRET` header. **26-failure incident on 3 Jun 2026 diagnosed and fixed** — cron-job.org job header was missing the Bearer token value (only "Bearer" with no token), Vercel env was correct throughout. See RESOLVED note at top. Deferred: remove `.github/workflows/marketplace-pool-refresh.yml` once cron-job.org proven stable long-term; pool composition rebalance toward modern sets; $5 threshold question; me4 prices blocked on PokeScope upstream indexing.

- **Push notifications — full system (session 18 follow-up, commits across multiple pushes):** End-to-end verified on device. Architecture: Supabase Database Webhook `push_notification` on `notifications` INSERT → POSTs to `/api/push/notify` → `web-push` + VAPID → Apple/Google push. Because it hooks `notifications` INSERT, ALL types (feed, trade, friend request, friend accepted, messages) push automatically including any future type. **Messages** were the only type with no prior notification; added DB trigger `trg_notify_new_message` (migration `20260603000000`) with 5-min per-sender suppression. Plumbing: `push_subscriptions` table (migration `20260602000000`), `lib/push/subscribe.js` (subscribeToPush/getPushState/unsubscribeFromPush), `lib/push/support.js` (isPushSupported/isStandalone). SW bumped to **v25** with `push` + `notificationclick` handlers. User-facing opt-in: Settings pill toggle (on/off/blocked/unsupported states), `PushNudge` contextual prompt in `app/page.js` beside PasskeyNudge. PushNudge defers to PasskeyNudge within the 10-min post-signup window to prevent double-banner. Re-nag schedule (commit `c61ff9c`): `ms_push_prompt_state = { dismissCount, lastDismissedAt }`, shows at count 0, after 3 weeks (count 1), after 1 month (count 2), never at ≥3. Secrets: `PUSH_WEBHOOK_SECRET` (dedicated, NOT reusing CRON_SECRET) in Vercel env + Supabase hook Authorization header — must be byte-identical in both places. VAPID keys in Vercel. Both were rotated after transcript exposure during session.

- **Friend-request notification button reappear fix (commit `ad8085e`):** Buttons reappeared after accept/decline on return because `resolvedRequests` was in-memory state reset on every mount. Fix: on mount, query live `friendships` DB state — build `pendingSenderHandles` Set (`user_b = me, user_a = sender, status = 'pending'`). Buttons render only if sender is in that set; removed on action. Persists across navigation and cross-surface actioning. Confirmed directional convention: **sender = `user_a`, recipient = `user_b`**, always (verified in `app/friend/[handle]/page.js` line 340 insert and the accept path's `user_a` read for requester notification).

- **Trade Binder Stage 1 — `trade_flagged` data foundation (3 Jun 2026, migration `20260603100000_add_trade_flagged.sql`):** Added `trade_flagged boolean NOT NULL DEFAULT false` to `collection_entries`. Updated ALL four binder-read sites to honour the new flag (binder membership = `duplicate_count > 0 OR trade_flagged = true`):
  1. `get_user_duplicates` RPC — `WHERE` clause updated (required `DROP FUNCTION` + recreate due to the prior `OR` clause change)
  2. `"anon can read public duplicates"` RLS policy — `USING` clause updated to match
  3. `lib/queries/discover.js` line 83 — `.or("duplicate_count.gt.0,trade_flagged.eq.true")`
  4. `app/api/profile/[handle]/public-stats/route.js` line 66 — `.or("duplicate_count.gt.0,trade_flagged.eq.true")`
  Stage 1 verified end-to-end: flagged Doublade #98 (`me3-98-holofoil`, `duplicate_count=0`) via single-row UPDATE with full PK in WHERE — appeared in own binder AND public/anonymous binder. Unflagged; `trade_flagged = false` confirmed. **Key semantic distinction preserved:** `trade_flagged = true` on a single copy ("I have one but I'll trade it") is explicitly NOT collapsed to incrementing `duplicate_count` ("I have a spare"). Do not change this.
  Stats/collection are unaffected: all collection-count paths gate on `checked = true` and/or `collection_tier = 'master'` — `trade_flagged` has no bearing on any of them. Confirmed safe.
  **Stages 2–4 still pending** — see §18 deferred items.

### Earlier work that landed earlier in the project
- Favourites redesign (3×2 grid, max 6, unified bottom sheet)
- Grand Master tier hidden everywhere except dedicated set-page sections
  (`selectMasterPrintings` helper, `master_printing_counts` RPC)
- Navigation chrome (MSHeader/MSTabBar/MSShell/MSPageTitle)
- Duplicate-orphan bug fix (untick now deletes the row entirely)
- Variant dot-system on multi-printing cards
- Discover bug (this session): "wants" logic was looking for `checked=false`
  rows that no longer exist post the untick-orphan fix. Inverted the logic
  to check what the viewer HAS, and extracted the Discover query into
  `lib/queries/discover.js` so the home scroller and detail page share one
  helper.

### Operational facts about the deployment
- **Supabase region:** Tokyo (ap-northeast-1) — free tier doesn't allow
  Sydney. Disclosed in the Privacy Policy.
- **Resend region:** ap-northeast-1 (Tokyo). Disclosed in the Privacy Policy.
- **Vercel:** global edge network, primary in US. Disclosed.
- **Analytics:** Vercel Analytics is enabled and disclosed. Sentry is
  disclosed in the policy but NOT YET WIRED IN — must-do item.
- **Card data sources:** pokemontcg.io (names, set info, prices),
  Limitless TCG (image hotlinks). Documented in the policy.
- **Affiliate scope:** eBay only currently. Policy is scoped accordingly.
- **Vercel cron (first in codebase — added 23 May 2026).** `vercel.json` at
  project root defines a single daily cron at 08:00 UTC pointing to
  `GET /api/cron/trade-handover-prompts`. The route authenticates via
  `Authorization: Bearer CRON_SECRET` (env var set in Vercel dashboard — NOT
  in `.env.local`). Pattern for future cron routes: (1) use service-role
  Supabase client (no user session in cron context); (2) fail-closed auth
  check (503 if env var unset, 401 if wrong); (3) add route to `PUBLIC_PATHS`
  in `proxy.js` or Vercel scheduler gets 307'd to `/welcome`; (4) per-record
  error isolation — don't let one bad row abort the batch; (5) record
  idempotency event BEFORE mutating state so concurrent runs bail cleanly.

### Trade state machine
Trades progress through these statuses. All values are enforced by a CHECK
constraint (`trades_status_check`) on the `trades` table.

| Status | How reached | Who can advance it |
|---|---|---|
| `pending` | Trade proposed (INSERT default) | Recipient (accept/decline) |
| `verification_required` | Recipient accepts with verification | Both parties (photo upload → accept) |
| `accepted` | Both parties confirm after photo verification | Terminal for verified path |
| `agreed_pending_handover` | Recipient accepts with `no_verification` (skip path) | Either party (confirm-handover) |
| `physically_completed` | Either party confirms exchange happened, OR cron auto-completes at day 21 | Terminal |
| `declined` | Recipient declines | Terminal |
| `cancelled` | Either party reports exchange didn't happen | Terminal |
| `completed` | Legacy — never written by any current code, preserved in constraint | N/A |

**Skip-verification path (added 23 May 2026):** `pending` → `agreed_pending_handover` → `physically_completed` or `cancelled`. Proposer signals skip intent via `proposer_offered_skip = true` at proposal time. Recipient sees three-button UI: accept-no-verify / accept-with-verify / decline. Both parties see a confirm-handover UI once agreed. Informational only — no `collection_entries` mutations on any completion path (deferred, see item 42).

**Cron behaviour:** `app/api/cron/trade-handover-prompts` runs daily at 08:00 UTC. Prompts both parties at day 7, day 14. Auto-completes with `physical_handover_auto_completed = true` at day 21. Idempotency tracked via `trade_events` (`handover_prompt_d7`, `handover_prompt_d14`, `handover_auto_completed`). Anchor timestamp: `trades.updated_at` at the moment the `agreed_pending_handover` UPDATE was applied — reliable because no code mutates trades rows between that transition and cron/confirm-handover firing.

---

## 2. MUST-DO BEFORE PUBLIC LAUNCH

These items are tracked in `docs/legal-integration-spec-v1.0.md` as the
pre-launch list. Ordered by priority. The legal documents *make claims* that
require some of these to be true.

### Privacy / accuracy (reconcile the docs to the code)

1. ~~**Strip EXIF metadata on all photo uploads.**~~ **DONE 19 May 2026 (commit `669ed0e`) — verification + documentation pass, not a build.** Full audit of all upload paths confirmed EXIF is already stripped incidentally via `canvas.toBlob()` in both upload paths (trade verification via `CameraCapture.jsx`; collection photos via `handlePhoto` in `app/set/[setId]/page.js`). Canvas only holds pixel data — no metadata survives the re-encode. The Privacy Policy claim is accurate. No library needed, no logic change made. Explicit comments added to all three relevant sites so the strip can't be silently removed by a future refactor. Existing photos in Storage are also clean — both paths have always used canvas. No backfill required.

2. ~~**Remove the unused `mailing_address` column from `profiles`**~~
   **DONE 16 May 2026 (commit `0453cb5`).** Audit found the column had zero
   writers and was read only by `app/api/trade/[tradeId]/reveal-address/route.js`,
   which always returned 404. Removed: the API route, the `PostLogistics`
   sub-component and related state in `TradePanel.jsx`, the column itself
   (`ALTER TABLE profiles DROP COLUMN mailing_address;`). The "Post" logistics
   option in TradePanel now renders a message directing users to exchange
   addresses in chat, consistent with the messages-based design described in
   the Privacy Policy.
   **Follow-up: TradePanel "Post" copy change is untested on device.** Verify
   `@handle` interpolates to the actual other-party handle (not literally
   "@handle" or "@undefined") and the back button works, on first real use.
   Low risk but the project's "reasoned-through ≠ tested" rule means this
   should land on a real device before being declared fully done.

3. ~~**Wire up Sentry error reporting.**~~ **DONE 25 May 2026 (commits `e5f12e0` foundation, `6d459f1` cleanup, `940c7ca` Crons).** `@sentry/nextjs` installed via wizard. Error monitoring + tracing + errors-only Session Replay (0% session sample rate, 100% error replay) enabled. `proxy.js` updated to expose `/monitoring` tunnel route to unauthenticated clients. `global-error.js` wired to `captureException`. Example scaffolding removed post-verification. Cron monitor for `trade-handover-prompts` wired with full check-in lifecycle (in_progress → ok/error). Source maps upload on every Vercel build — verified in Vercel build log 25 May 2026. DSN inlined as literal string (wizard default; public by design). See §17 for gotchas.

4. ~~**Verify Vercel Analytics is correctly configured.**~~ **DONE 17 May 2026 (commit `9d3b8a2`).** `@vercel/analytics` v2.0.1 installed and `<Analytics />` mounted in root layout. Page-view collection only — no Speed Insights.
   **Follow-up:** Verify page-view events appearing in Vercel dashboard within ~24h of deploy.

### Trust & safety (required because messaging is on at launch)

5. ~~**Build "Report user" feature.**~~ **DONE 22 May 2026 (commits `930935e`, `245ccb5`, `223e156`).** `user_reports` table created with 10 columns, 4 indexes, 2 CHECK constraints (`no_self_report`, `details_required_when_other`), RLS insert + select-own policies. `OverflowMenu` component (`components/OverflowMenu.jsx`) — iOS-style bottom action sheet (portal, ESC, focus trap, return-focus-to-trigger). Takes `targetHandle` + `items` array; built for extensibility when Block adds a second row. `ReportUserForm` component (`components/ReportUserForm.jsx`) — portal bottom sheet matching `ReportCardForm` gold standard (ESC, focus trap, form reset, aria-modal). Reason as tappable radio rows; details always visible with dynamic optional/required label; submit gated on reason + details-when-other. On success: self-contained toast "Thanks — we'll review this report." On error: sheet stays open, inline message. Mounted on `app/friend/[handle]/page.js` (context='profile', hidden on own profile via `currentUserId !== friend.id`) and `app/messages/[handle]/page.js` (context='thread'). **This is the T&S data-corrections funnel — entirely separate from `card_reports` (data corrections).** Verified: row insertion correct on both surfaces, RLS blocks reported user from seeing the row, no notification sent to reported user. Admin queue (item 7) is unbuilt — separate future session.
   **Follow-up (loose thread 39):** When Block ships (item 6), the report form success state should upgrade from a toast to an inline "Would you like to block @{handle} as well?" prompt with [Block] and [Not now] buttons. UI flow decided 22 May 2026 but deliberately deferred so the Report brief ships clean.

6. ~~**Build "Block user" feature.**~~ **DONE 24 May 2026 (session 10).** `user_blocks` table with RLS (blocker SELECT/INSERT/DELETE own rows). SECURITY DEFINER functions `is_blocked()` and `get_block_peer_ids()` bypass RLS for bidirectional block checks. All enforcement surfaces: Discover (search + card tap), Friends list (search filter + sendRequest guard), Friend profile view, Friend set-detail view, Messages thread (load + send guard), Messages inbox, Trade propose API, `feed_events` SELECT RLS. API routes: `POST /api/block`, `DELETE /api/block/[targetUserId]`, `GET /api/block/list`. UI: `BlockConfirmModal` (shared sheet, `mode="block"|"unblock"`), Settings blocked-users list, overflow-menu "Block user" on profile + message thread, post-report block prompt in `ReportUserForm`. Silent block design: blocked user is not notified. Key commits: `51e5140` (DB + `lib/queries/blocks.js`), `69982ce` (Friends), `c251165` (profile), `c5c62e9` (set-detail), `d48e2d0` (message thread), `defee19` (inbox), `c739627` (trade propose), `f06de55` (feed_events RLS), `a2f3c35` (POST /api/block), `f88482c` (DELETE /api/block), `21ef4ad` (GET /api/block/list), `30bcabb` (BlockConfirmModal), `70ee0de` (Settings + unblock mode), `70278e9` (profile overflow), `b1aa070` (thread overflow), `94a3cc5` (post-report prompt). Verified end-to-end on device 24 May 2026.

7. ~~**Admin moderation queue — DONE 26 May 2026.**~~ Both `user_reports` and `card_reports` admin queues shipped. `user_reports` queue: view all reports, dismiss with optional note, Open/Dismissed toggle. `card_reports` queue: 4-view UI (Open/In-Progress/Resolved/Dismissed), full status transition workflow (Start Work → Mark Resolved / Dismiss, Reopen from any terminal state), inline resolution notes, `resolution_note` preserved on reopen. Admin gate fixed — non-admins silently redirected to `/you` with no data flash (`checking` state + `router.replace`, replacing the broken `notFound()` pattern). All routes: `cf79bc1` (admin helper), `794804e` (user_reports RLS), `d8c5e6b` (user_reports page), `c318e36` (dismiss route), `561fb81` (server/client split), `c2890e7` (diag logging removal), `9c50b27` (HANDOVER), `e2003b4` (gate fix), `609b5f6` (card_reports RLS), `ce699b8` (card_reports page), `cd5dc8f` (status API). Deferred: warn/suspend/terminate (needs `user_actions` schema); inline card editing in queue (fix via Studio for now); bulk actions/search/pagination.

8. **Address-reveal nudge in messages.** When a user types something that
   looks like a mailing address into a message thread, show a one-time
   inline reminder ("only share your address with someone you trust... etc").
   Optional polish but explicitly flagged by AI reviewers.

### Pricing infrastructure (required before soft launch)

10a. ~~**Upgrade PPT API plan to $9.99/mo (20,000 credits/day).**~~ **DONE 25 May 2026.** Plan upgraded — 20,000 credits/day active.

### Legal / UI compliance

9. ~~**Affiliate disclosure visible near eBay links.**~~ **DONE 19 May 2026 (commit `c96268e`).** Audit confirmed `FindOnline.jsx` already contained the disclosure text ("Master Setter may earn a commission from purchases made through links on this page. This does not affect the price you pay."). Fix: bumped opacity of that paragraph from 0.38 → 0.55 so it reads clearly. Also deleted two dead components (`FindOnEbay.jsx`, `FindCard.jsx`) that were never imported anywhere — found during audit.

10. **"Suggested match" / "trade at your own risk" UI language.** Matching
    surfaces should describe matches as "suggested." Trade-action surface
    should include a brief at-your-own-risk note near the start-trade
    button. Small wording, real legal value — backs up the
    platform-not-a-party framing in the ToS operationally.

---

## 3. BUGS LOGGED (not launch-blocking but real)

11. ~~**Discover refresh-after-tick.**~~ **DONE 19 May 2026 (commits `c311c4e`, `9e5990f`).** Two separate root causes, both fixed:
    (a) No subscription: viewer's own collection changes weren't triggering a Discover refetch. Fixed by adding `useTableRefetch` on `collection_entries` in the Discover page and home page.
    (b) 1000-row truncation: `getDiscoverMatches` myHave query was silently capped by PostgREST default — raff had 2,618 checked entries, so the query only returned 1,000 and matched wrong cards as still-missing. Fixed with the standard paginated loop (PAGE=1000, `.range()`) in `lib/queries/discover.js`.

12. **Price pipeline — three independent problems (fully diagnosed 21 May
    2026, partially fixed).** Originally logged as inflated set values
    (~A$878 for Perfect Order vs gut-check ~A$200). The pipeline is
    `PokeTrace → ptcgio → PPT → PokeScope` in a waterfall; once any source
    sets `result`, subsequent sources are skipped.

    **~~Problem 1 — ME-set promo bleed (Gengar me3-50 example)~~ FIXED 24 May 2026**
    PokeScope shows a "Multiple variants available" block for cards with stamp
    promos (and for commons/uncommons with normal+reverse_holofoil). Old code
    grabbed the first `$amount` after "market price", which was always the
    highest-priced stamp promo. Fix shipped 24 May 2026 (commit `e87a957`):
    `tryPokeScope` now detects the variant block, parses label+price pairs,
    maps `printing_type → PokeScope label` via whitelist, silently skips
    unknown labels (Gamestop Stamp, Eb Games Stamp, etc.). Single-variant
    cards (SIR, MHR, UR) hit the unchanged else-branch.
    Secondary bug found during fix verification: the variant block window was
    1500 chars, cutting off the Holofoil div (4th of 4, offset ~1360+) exactly
    1 byte short of its closing `</p>` tag — labelM regex failed, Holofoil
    silently dropped from variantMap. Fixed in commit `f305475`: window
    expanded to `VARIANT_BLOCK_WINDOW = 3000` (named constant; covers ~7
    variant divs). **Lesson: always size string-slice windows with explicit
    headroom and a named constant — off-by-one truncation is silent.**
    Tertiary block: after the partial 1500-char run wrote all rows except
    holofoil, the staleness gate (`prices_updated_at` stamped at 03:15)
    blocked all subsequent refresh attempts. Required manually NULLing
    `user_sets.prices_updated_at` for @alex/me3 to let f305475 run. This is
    the same family of issue as item 40 — staleness gate fires on partial
    success, locking out the corrective run. **Item 40 is now elevated:
    blocking a real fix, not just a theoretical concern.**
    Final verified state (24 May 2026, 04:00 UTC): me3-50-holofoil=$0.56,
    me3-50-reverse_holofoil=$1.00, me3-121-holofoil=$197.87 (unchanged),
    me3-124-holofoil=$171.62 (unchanged). Problem 1 closed.

    **Problem 2 — Pattern variants stuck at $0.00 (sv8pt5, sv10, zsv10pt5,
    rsv10pt5 pokeball/masterball printings)**
    ptcgio runs first and succeeds for SV sets → `result` is set → PPT branch
    never runs. Even if PPT ran, its per-card product-ID discovery resolves
    only the standard TCGPlayer product — pokeball/masterball variants are
    **separate TCGPlayer products** (IDs 610541+ for sv8pt5) not discoverable
    via ptcgio. PPT's set endpoint (`/api/v2/cards?setId=N`) is the only way
    to enumerate them; products are identified by `"(Poke Ball Pattern)"` /
    `"(Master Ball Pattern)"` in the product name.
    *Fix shipped (21 May 2026, commit `924738e`):* New `PPT_PATTERN_SET_IDS`
    constant + `tryPptPatterns()` supplemental pass added to
    `app/api/refresh-prices/route.js`. Runs after the waterfall, independent
    of whether ptcgio succeeded. All four sets are now wired:
    - sv8pt5 → PPT setId 23821 ✅ refreshed and verified (see below)
    - sv10 → PPT setId 24269 ✅ wired, **refresh not yet triggered**
    - zsv10pt5 → PPT setId 24325 ✅ wired (commit `c6be1ca`), **refresh not yet triggered**
    - rsv10pt5 → PPT setId 24326 ✅ wired (commit `c6be1ca`), **refresh not yet triggered**
    me2pt5 is untouched — still PokeScope.

    **sv8pt5 refresh verified clean (22 May 2026, session 8).** After the
    first successful refresh, three diagnostics confirmed data integrity:
    (1) PPT product count for setId 23821 = exactly 100 Poke Ball Pattern +
    67 Master Ball Pattern — matches DB row counts 1:1. (2) Zero pattern
    rows exist for Double Rare / Special Illustration Rare / Hyper Rare /
    ACE SPEC cards — no over-seeding. (3) Spot-check prices on eligible
    cards ($0.27–$10.87 range) are realistic. The inclusion-rule concern was
    unfounded — seeding and pricing are both correct.

    **Current state (22 May 2026, session 8):**
    - sv10: cleaned up — null entry in `PPT_PATTERN_SET_IDS`, 286 phantom rows deleted via migration `20260522130000`.
    - rsv10pt5: fully priced.
    - zsv10pt5: 72/82 pokeball + 72/74 masterball priced after re-refresh. 10 null-priced rows remain: 9 pokeball + 1 masterball. All are `_pb`-suffix IDs from pre-release ingestion — see item 36d.

    **Problem 4 — me4 (Chaos Rising) pricing blocked on PokeScope upstream indexing**
    Set ingested clean (122 cards, 198 printings, themes extracted, ME_SETS
    updated — commit `1d004ea`, 24 May 2026). PokeScope returns 404 for all
    me4 cards as of 24 May. `tryPokeScope` logs 122 warnings, returns null,
    no prices written. All me4 printings remain at $0. No code action needed —
    re-trigger refresh in a few days once PokeScope indexes the set. Confirmed
    by sampling cards 1, 10, 50, 100, 122 via direct HTTP.

    **Problem 3 — ECard/Platinum holofoil stale prices**
    ptcgio builds PID `ecard3-N-normal` but DB rows are typed `ecard3-N-holofoil`.
    TCGPlayer prices these eras under the `normal` key, but our DB rows use
    `holofoil` type (from `seed-manual-printings.mjs`). ptcgio writes to nowhere.
    PokeTrace is also currently failing for ECard sets (last success 2026-05-08).
    *Fix decided:* Auto-detect rule — if a set has zero non-holofoil printings in
    the DB → use the API's `normal` key price for holofoil rows. ~1–2 hours.
    **Not yet implemented.** Defer to next pricing session.

    **What this bug is NOT:**
    - Not a calculator bug. The set-value math faithfully sums whatever prices
      it's given.
    - Not a GM-tier filter bug. Perfect Order has zero GM-tier printings.
    - Not a duplicate-counting bug. Query confirmed zero hidden duplicate rows.
    - Not a currency bug. Conversion rate is plausible (~0.65 AUD/USD).

    **Related minor finding:** `collection_entries.duplicate_count` is almost
    entirely unused (3 across 193 rows for @alex's Perfect Order). Vestigial
    column like `mailing_address` was. Future audit: populate via UI or drop.

13. ~~**Spewpa-style stale Discover issue.**~~ **DONE 19 May 2026 (same fix as item 11).** Same two-part root cause: no collection-changes subscription + myHave 1000-row truncation. Both resolved.

13a. ~~**Discover preview action buttons inconsistent across entry points.**~~ **DONE 17 May 2026 (commits `f2bf467`, `4c59ed4`).** Two separate surfaces fixed independently (two different implementations, not a shared component):
    - Home modal: added "Propose Trade" as primary action (`f2bf467`)
    - Discover page sticky action bar: added "View Collection" as third button (`4c59ed4`)
    **Design decision captured:** Discover intentionally uses three different UI mechanisms across surfaces — tappable handle for profile, action bar for trade/message, three-button modal on home preview. This is NOT drift. Do not "fix" by consolidating.
    *Correction to original description: "set detail page" was wrong — there are only two surfaces (home preview + Discover page), not three.*

13b. ~~**Messages tab on MSTabBar missing unread-count badge.**~~ **DONE 17 May 2026 (commit `b037328`).** Red dot badge on Messages tab icon in MSTabBar. Deduped by `sender_id` so it counts unread *threads*, not raw message count. Updates on: pathname change, Supabase real-time INSERT subscription, and visibilitychange on tab restore. Only counts `message_type = "message"` — trade proposals excluded.
    **Architectural note:** First global real-time subscription in the app. Written so it can be lifted into a shared hook (e.g. `useUnreadSubscription`) when a third use case appears — rule of three. Lives in `components/chrome/MSShell.jsx`.

13c. ~~**Variant picker tick hit-target too small.**~~ **DONE 17 May 2026 (commit `0da9c37`).** Entire variant picker row now toggles the tick. Right-hand controls (`−`, count, `+`, camera) all already had `stopPropagation` in place — only the row container needed `onClick`, `role="button"`, `tabIndex`, and `onKeyDown` added. One file changed (`app/set/[setId]/page.js`), 5-line diff.
    *Open: whether `+` from 0 → 1 should auto-tick the card — separate UX decision, capture if raised.*

13d. **Messages list real-time updates. DONE 17 May 2026 (commit `85b5734`).** The messages inbox (`app/messages/page.js`) previously fetched once on mount with no live updates. Now subscribes to INSERT and UPDATE events on `messages` filtered server-side by `recipient_id`, triggering a full refetch on each event. Followed the pattern established in item 13b. Second global real-time subscription in the app — not yet extracted to a shared hook per the rule of three.

13e. **Thread scroll bugs — fully resolved 19 May 2026 (commits `cce3d45`, `f01b33a`, `427bc75`).** Three bugs fixed across two sessions:
    - `cce3d45` (17 May): Scroll to first unread on thread open; "New messages" divider.
    - `f01b33a` (19 May): Double rAF + `initialScrollAtRef` 2-second window + `onLoad` handlers on images — improved timing but didn't fix the target ambiguity.
    - `427bc75` (19 May, final fix): Replaced `bottomRef` + `scrollIntoView` with `scrollContainerRef.scrollTop = scrollHeight`. Root cause was nested-scroll target ambiguity — the `overflow: hidden` outer wrapper qualifies as a scroll container under CSS spec. Also added 80px near-bottom guard on new-message auto-scroll so it doesn't yank the user while reading history.
    All three symptoms (opens in middle, yanks on new message, lands in middle after returning) are resolved.

13f. **Prevent use of leaked passwords (Supabase Attack Protection — deferred).** Currently disabled. Dashboard → Authentication → Attack Protection → "Prevent use of leaked passwords" toggle — runs new and changed passwords against HaveIBeenPwned. Small defence-in-depth step. Not urgent.

---

## 3a. DATA CORRECTNESS SPRINT — 21 MAY 2026 (SESSION 5)

All items below were completed in full this session.

**S5-1. Victini rarity fixes (rsv10pt5-172, zsv10pt5-171).** Both Victinis were
tagged `'Rare'` at ingestion. Community consensus verified across TCG Collector,
Sports Card Investor, PSA, eBay, and Cash Cards Unlimited: correct rarity is
`'Black White Rare'` (abbreviated BWR on card). Single transaction-wrapped
`UPDATE` to both rows. Closes the secret-rare audit's 45-candidate list
(43 API-confirmed correct, 2 manually fixed).

**S5-2. Archen #131 rarity fix (rsv10pt5-131).** Tagged `'Uncommon'` at
ingestion, actually an `'Illustration Rare'` per pokemon.com official listing,
pkmncards.com, Pokellector, and Sports Card Investor. The card's solo holofoil
printing was already correct for an Illustration Rare — only the rarity label
was wrong. Single `UPDATE`. Same fix shape as the Victinis: special card
mis-tagged at a base rarity, surfaced via phantom-row audit.
(The rsv10pt5-131 phantom holofoil row that originally triggered the Cat 1-2
audit was correctly the only printing for an Illustration Rare, not an artefact.
Resolved by rarity fix, not row deletion.)

**S5-3. PRE80 Dudunsparce data quality fixes (zsv10pt5).** zsv10pt5-PRE80
is a legitimate Black Bolt Dudunsparce ingested from Limitless TCG pre-release
data before final art shipped. Two fixes applied:
- `subtypes` set to `['Stage 2']` (was `null`)
- Missing `masterball_reverse_holofoil` printing inserted:
  ID `zsv10pt5-PRE80-masterball_reverse_holofoil`, `display_order=2`,
  `printing_type='masterball_reverse_holofoil'`, `card_number=80`
Black Bolt Master Ball coverage is now complete per inclusion rule (see S5-4).
*Known cosmetic inconsistency:* The existing pokeball printing uses
`display_order=3` and `_pb` ID suffix — inherited from pre-release ingestion,
diverges from the rest of the set's `display_order=2` convention. Variant
picker still works. Future cleanup only (see item 36b below).

**S5-4. Black Bolt Master Ball coverage audit.** Compared
`pokeball_reverse_holofoil` vs `masterball_reverse_holofoil` counts across
zsv10pt5. Found 9 cards with pokeball but no masterball. Triaged:
- 8 correctly excluded: 7 Trainers + 1 Energy (pokeball-eligible but not
  masterball-eligible per inclusion rule)
- 1 genuine gap: PRE80 Dudunsparce — fixed above (S5-3)
White Flare (rsv10pt5) verified clean, no gaps.
**Inclusion rule confirmed:** Pokéball = non-ex Pokémon (C/U/R) + Trainers
(C/U). Master Ball = non-ex Pokémon (C/U/R) only. Trainers do NOT get Master
Ball variants.

**S5-5. Common/Uncommon phantom holofoil cleanup.** New phantom pattern beyond
Cat 1+2 scope: Common/Uncommon cards with `printing_type='holofoil'` where a
`normal` counterpart also exists. Audit found 31 candidate rows across 14
patterns. Triaged into three groups:
- **Group A (22 rows, 9 sets) — deleted.** Sets: pop4-9, sv7, zsv10pt5 Common,
  rsv10pt5 Common. Same artefact pattern as Cat 1+2. 3 user `collection_entries`
  cascaded.
- **Group B (8 rows, det1 Detective Pikachu) — kept.** API spot-check confirmed
  det1 (2019 movie tie-in promo) is holofoil-only product structure. TCGPlayer
  prices all det1 cards under the `holofoil` key. Legitimate.
- **Group C (1 row, rsv10pt5-131 Archen) — handled separately.** Investigation
  revealed mis-tagged Illustration Rare, not an artefact. Fixed via S5-2 above.

**S5-6. ID/number mismatch audit.** zsv10pt5-80 (ID) has `number=173` in DB —
Antique Cover Fossil, a Stellar Crown card inadvertently seeded into Black Bolt
from the same pre-release ingestion event as PRE80. Audit confirmed exactly one
such instance across the entire database. 2 user `collection_entries` reference
it. **Deferred** — low urgency, cosmetic only. See item 36a below.

---

## 4. LOOSE THREADS FROM EARLIER WORK

14. ~~**Location explainer — extract into reusable hook.**~~ **DONE 19 May 2026 (commit `1cab435`) — preparatory refactor, no live behaviour change.** `useLocation` hook created at `lib/hooks/useLocation.js`. Exposes `requestLocation({ onGranted, onDenied, title, purpose })` — checks `ms_location_explained` localStorage flag, renders `LocationExplainer` via portal if not yet seen, calls `navigator.geolocation.getCurrentPosition` via `callGeolocation` after consent. `LocationExplainer` now accepts optional `title`/`purpose` props (defaults to current card-shop copy) so any future caller can customise the sheet. `TradePanel` migrated: `showLocationExplainer` state and inline localStorage logic removed, replaced with `const { requestLocation, locationModal } = useLocation()`. `handleFindShops` now takes a `pos` parameter instead of calling geolocation itself. **Note: the Card Shop Nearby button is still disabled in production UI** — the hook is not exercised by any live feature today. The refactor sets up the correct entry point for Discover proximity matching and any other future location feature; it does not fix or change current user-visible behaviour.

15. ~~**Password minimum length consistency.**~~ **DONE 17 May 2026 (commit `15a12f9`).** Bumped to 8 in both signup (`app/login/page.js`) and reset-password (`app/reset-password/page.js`). Supabase Auth dashboard also set to 8 (manual config). Both layers enforce.

16. ~~**The 800ms timer in `/auth/confirm`.**~~ **DONE 19 May 2026 (commit `59604ff`).** Audited the confirm page. The timer fires after `verifyOtp` and `profiles.upsert` are both `await`ed — it's purely cosmetic, letting the user read the "Confirmed!" state before the redirect. It is NOT a race condition. Explanatory 4-line comment added above the `setTimeout` to make this permanently clear. *(Item was originally item 15 in some earlier numbering — don't be confused by this. In the current handover item 15 is "Password minimum length consistency." The 800ms timer is correctly item 16.)*

39. ~~**Block prompt after report submit.**~~ **DONE 24 May 2026 (commit `94a3cc5`).** `ReportUserForm` now renders a `submitted` state after a successful report instead of closing immediately: title "Report submitted", body offering to block the reported user, primary "Block @{handle}" button (opens `BlockConfirmModal` via `onBlockRequested` callback prop), secondary "Done" closes. Toast removed — the in-sheet title is the confirmation. Wired on both profile (`context="profile"`) and message thread (`context="thread"`) surfaces.

40. ~~**Staleness gate bug.**~~ **RESOLVED 24 May 2026, commit `bd0be5a`.**
    **Cause:** `prices_updated_at` was advanced unconditionally at the end of
    every refresh run — including failed runs (upstream down), zero-write runs
    (all sources returned null), and partial-success runs (some printings
    skipped due to parser bugs). The timestamp advanced regardless of whether
    a single real price had been written.
    **Impact:** Failed or empty runs locked the user out of retrying for 6
    hours, requiring manual `NULL` of `user_sets.prices_updated_at` via
    Supabase SQL editor to unblock. Happened in production twice before fix:
    (1) sv8pt5 refresh with PPT down. (2) me3 promo-bleed fix session — the
    1500-char window bug wrote 199/200 rows, stamped the gate, and blocked
    the `f305475` corrective run for hours of unnecessary debugging.
    **Fix:** Wrapped the step-6 `user_sets` update in `if (updates.length > 0)`.
    Both `previous_value` and `prices_updated_at` are conditional together —
    if no real prices were written, neither advances. Zero-write runs now log
    a `console.warn` and leave the timestamp unchanged so the user can retry
    immediately. Verified end-to-end: me4 (zero writes, PokeScope 404) left
    timestamp NULL across two consecutive triggers; me3 (real writes) advanced
    timestamp and correctly blocked the second immediate trigger.
    **Cross-reference:** Item 12 (Gengar pricing pipeline) required two manual
    DB interventions and an hour of diagnosis because of this gate. The
    combined fix (item 12 parser + item 40 gate) removes both root causes.
    Bonus: the item 40 verification run also produced the final me3-50-holofoil
    correction ($216.08 → $0.56), retroactively completing item 12 verification.

42. **Trade-aware duplicate inventory.** Today's 5b implementation hides offered cards from Discover via filter, but the underlying `duplicate_count` isn't decremented. This leaves a concurrency window where two users could propose for the same single duplicate between Discover refreshes. The durable solution is to decrement `duplicate_count` on trade proposal and restore on resolution (decline/cancel). Requires careful state-machine work — touches the `printings`/`collection_entries` table which trade flow has not previously mutated. Defer until trade volume warrants. Captured 23 May during 5b verification.

41. **23 May trade-test observation — apparent card movement between collections during confirm-handover happy path.** Alex observed Salazzle ex / Mega Starmie ex appearing to transfer between collections after confirming a skip-verification trade as "completed". Code audit (23 May 2026) confirmed **no ownership transfer mechanism exists anywhere in the codebase**: no triggers, RLS policies, or code in `confirm-handover`, `accept`, or any other route mutate `collection_entries` on trade status change. DB trigger audit found only `trades_updated_at` (sets `updated_at = NOW()`) and `card_report_email_notification` — neither touches `collection_entries`. Most likely explanation: UI artifact or stale-state read across two devices used for testing. **Re-verify with a direct DB query on `collection_entries` for both user IDs before authorising any work that assumes no-transfer semantics.** Do not act on this observation until reproduced against the DB directly.

---

## 5. DESIGN & UX — DEFERRED

The user explicitly wanted to step back from interface work, so these are
NOT next-session priorities. Captured to not lose them.

- **Build real `/settings` page** — currently a partial real page (with the
  Location/Suburb section that Claude Code added during the legal work).
  Real full version should be a hub: currency picker, profile editing
  (handle/avatar), country/suburb, location prefs, **2FA toggle** (see
  Security), **"Chat help" entry point** (see Growth), notification prefs,
  account deletion.
- Audit existing `/friends` page — confirm full coverage (list/requests/
  send/search/unfriend).
- Real-time subscriptions on `/notifications` (currently fetch-on-mount).
- Notifications polish — filter/sort, mark individual unread,
  swipe-to-dismiss.

---

## 6. SECURITY — DEFERRED

17. **Optional 2FA via Supabase MFA (TOTP).** Decision locked in earlier:
    optional toggle in Settings, NOT mandatory at signup. Originally
    considered as step-up auth for the trade mailing-address reveal flow,
    but that flow no longer exists (see item 2). Still worth doing for
    general account security. Supabase handles the hard part — this is
    integration, not building auth. Don't let this slip far past launch —
    a compromised account with no 2FA option is a real incident risk once
    stranger-trades are happening.

17a. **Mutual skip of photo verification — needs design thinking, not just
    building.**

    **Status (27 May 2026 audit):** Not built. The session 9 work
    (proposer_offered_skip + verification_skipped columns + three-button
    acceptor UI, commits 87b1077 etc.) is a SEPARATE one-party-offer
    feature where the proposer signals skip intent and the recipient picks.
    That work is shipped and stable. 17a as designed is MUTUAL consent —
    either party can initiate, both must actively agree, with a consent
    record. Audit confirmed all five sub-decisions below are still
    unresolved. Deferred until post-beta — the asymmetry of session 9 may
    turn out to be a feature (forces explicit suggestion, dampens
    social-pressure drift). Revisit if beta testers report friction with
    proposer-only initiation.

    Idea raised 16 May: let both parties in a trade agree to
    skip the verification-photo step. Do NOT just build this as a toggle.
    Trust-and-safety implications worth thinking through first: the pairs
    most likely to mutually agree to skip are also the pairs where one
    party is being socially pressured by the other ("c'mon, we don't need
    photos, just trust me"). Before building, decide:
    - per-trade toggle vs profile preference (per-trade is safer);
    - consent record schema (who agreed, when, stored where, immutable?);
    - whether skip is reversible mid-trade;
    - whether reports involving skipped-verification trades get flagged
      or prioritised in the admin queue (item 7);
    - whether skip is gated behind some trust signal (e.g. existing
      friend, N successful prior trades, account age) rather than open
      to any two parties.
    Probably worth pairing with items 5-7 (Report/Block/Admin queue)
    rather than building standalone, since the moderation surface needs
    to know about it.

---

## 7. GROWTH & FEATURES — DEFERRED

18. **In-app help via the messenger.** A system "Master Setter Help"
    profile that appears as a thread in the existing messenger. Accessed
    via "Chat help" in You/Settings. User messages it → server-side hook
    calls an AI → AI replies as the Help profile using a curated
    app-knowledge base → AI self-escalates when needed → admin can reply
    *as* the Help profile (user sees one continuous conversation).
    Backend (AI loop + admin plumbing + system profile concept) is the
    real work; UI largely reused from existing messenger. Watch the AI
    layer — a confidently-wrong support bot is worse than none.

19. **Instagram-style Browse feed on Discover** — infinite scroll;
    sorted: favourited first → missing from active sets → nearby →
    everything else.

20. **Broader network matching engine** — beyond direct friends,
    proximity-based.

21. **Profile stat "X Grand Master completions"; leaderboard for most GM
    completions.**

22. ~~**Push notifications — DONE 3 Jun 2026.**~~ Full system shipped end-to-end. Webhook-driven pipeline: `notifications` INSERT → Supabase webhook → `/api/push/notify` → web-push + VAPID → iOS/Android PWA. All notification types push automatically. Message notifications added via DB trigger `trg_notify_new_message` (5-min per-sender suppression). User-facing: Settings pill toggle + PushNudge contextual prompt with 3-ask re-nag schedule. See §1 for full detail. **The "friend gets a duplicate of your favourited card" sub-feature is NOT built** — the system pushes on all standard notification types but the duplicate-match notification type doesn't exist yet.

43. **Stale intent reminder popup (Door B deferred).** When `ms_anon_intent` is present at signin but older than 30 min, currently discarded silently. Better UX: "You started a message about X earlier — continue, view binder, or skip?" Deferred to post-beta.

44. **Restore toast cross-set variant.** Current toast shows "Your N cards have been saved." When migration spans multiple sets, could say "Saved N cards across M sets." Migration API already returns `setIds[]` — toast just needs the multi-set display branch.

45. **Production observability for migration flow.** Instrument: how often migrations fire, how often they partial-fail (`inserted < requested`), conversion through each modal trigger type (card_threshold / nav_away / auth_required). No mechanism yet.

38. **Admin queue for `card_reports`.** The `card_reports` table is live and
    collecting submissions. An admin-only view is not yet built. Needs: a
    protected admin route, a table view of open reports (category, details,
    reporter handle, created_at, status), and action buttons (mark
    in_progress, resolved, dismissed) that update `status` and optionally
    `resolution_note` + `resolved_at` via the service role. Access control:
    check `profiles.is_admin` or similar flag, or use a hard-coded admin
    uid list for the first version. Keep this separate from the `user_reports`
    T&S admin queue (item 7) — they serve different purposes and will have
    different workflows.

---

## 8. DATA — DEFERRED

23. **Grand Master sourcing project.** Audit every set against the
    master/GM line; source images + prices for GM sections. Sets needing
    attention: Prismatic Evolutions, Ascended Heroes, Perfect Order,
    Crown Zenith, White Flare, Black Bolt. White Flare GM section has
    no images.

24. **Re-run PB/MB inserts for Prismatic Evolutions** when pokemontcg.io
    adds remaining cards (community reports 181 vs 180). Use
    `ON CONFLICT DO NOTHING`.

25. **Monthly DB-vs-community card count check.**

26. **White Flare BWR card #174 (Reshiram ex)** — confirm if in DB. If
    missing: `node scripts/patch-limitless.mjs rsv10pt5 WHT 174 174`.

27. **Find Online search query** — Black Bolt 174/131 searched wrong;
    pass the exact collector-number string from the card object, don't
    reconstruct.

36a. **zsv10pt5-80 ID/number mismatch (deferred).** Card ID `zsv10pt5-80` has
    `number=173` in the DB — a Stellar Crown card (Antique Cover Fossil) seeded
    into Black Bolt during the same pre-release ingestion event as PRE80. Single
    isolated artefact. 2 user `collection_entries` reference printings on this
    card. Low urgency, cosmetic mismatch only. Future cleanup brief.

36b. **PRE80 Dudunsparce printing inconsistency (deferred).** The existing
    pokeball printing (`zsv10pt5-PRE80-pokeball_reverse_holofoil_pb`) uses
    `display_order=3` and a non-standard `_pb` ID suffix — inherited from
    pre-release ingestion. The new masterball printing and all other zsv10pt5
    printings use `display_order=2`. Variant picker still works. Cosmetic only.
    Future cleanup: rename ID suffix and fix `display_order` to match set
    convention.

41. **me2pt5 ball type granularity (Ascended Heroes).** The set has 140
    `pokeball_reverse_holofoil` rows in the DB — all 140 priced via PokeScope.
    But the physical set has multiple distinct ball types per Pokémon (Poké Ball,
    Love Ball, Friend Ball, Quick Ball, Dusk Ball) plus Energy reverse and "R"
    for Team Rocket cards. The current data model conflates all ball types into
    a single `pokeball_reverse_holofoil` type. Pricing still works (PokeScope
    returns one market price per card regardless of ball type), but collectors
    who care about which specific ball type they own can't record that distinction.
    Per PokeBeach: these ball variants act as regular reverse-holo slots in
    Ascended Heroes — they are not chase-rarity "hits" the way Prismatic
    Evolutions / Black Bolt / White Flare pokeball/masterball variants are.
    Audit and potentially remodel if collector demand warrants distinguishing
    ball types. Low priority until post-launch.

36d. **zsv10pt5 `_pb`-suffix pokeball printings — null-priced, zero ticks, low impact.** Black Bolt has 9 pokeball printings with legacy `_pb` ID suffixes from pre-release ingestion (cards 79, 81–86, 171, 173, PRE80). 7 are real PPT products that stay null-priced because `tryPptPatterns` constructs the lookup key as `zsv10pt5-79-pokeball_reverse_holofoil` but `existingIds` contains `zsv10pt5-79-reverse_holofoil_pb` — no match, silently skipped. Card 173 is a phantom (stays null correctly). PRE80 pokeball is a known `display_order` anomaly (see 36b). Checked zero collection ticks across all 9 IDs. If a user eventually ticks one and queries why no price shows, run a small ID-rename migration to bring the suffix in line with the standard format; `tryPptPatterns` will then price them on the next refresh.

36c. **Class of bug: special cards mis-tagged at base rarities in custom sets.**
    Both session 5 rarity fixes (Victinis → Black White Rare, Archen →
    Illustration Rare) share the same shape: special card with non-standard
    variant structure, surfaced via phantom-row audit, fixed by correcting rarity
    not deleting rows. Future audit candidate: scan all custom sets (me1, me2,
    me2pt5, me3, rsv10pt5, zsv10pt5) for cards whose printing structure suggests
    a special rarity (holofoil-only with no normal counterpart at C/U) that has
    been miscategorised as C/U/R. Could surface similar mis-tags. Defer until
    post-launch.

---

## 9. SCALING / QUERY-SAFETY — NONE URGENT

All safe at current scale; flagged so they're not forgotten.

- `messages/page.js ~L48` — profile fetch via `.in()` unbounded; breaks at
  1000+ message partners.
- `friends/page.js ~L41` — friend profile fetch via `.in()` unbounded;
  breaks at 1000+ friends.
- `favourites/page.js ~L57` — `.in()` on favourited printings; effectively
  a non-issue (capped at 6).
- When any of these matter, use the existing `fetchInBatches()` helper from
  `trade/new/page.js`.

---

## 10. CLEANUP — REAL BUT LOW-PRIORITY

28. ~~**Update project `README.md`**~~ **DONE 19 May 2026 (commit `3d6452f`).** Replaced create-next-app boilerplate with real project description: what Master Setter is, stack, running locally (all env vars documented), project structure, auth gate summary, status.

29. **Move `design_handoff_navigation_chrome/` to `docs/design/`.**

30. **Grep hardcoded `rgba(244,244,246,0.08)` etc → replace with
    `--ms-rule` token.**

31. **Service worker offline fallback cleanup.** The SW's navigate fallback
    serving cached `/` masked routing bugs repeatedly in this project. It
    should serve a proper offline page / real 404 instead. Genuine footgun.

32. ~~**`/manifest.json` 401 on Vercel**~~ **DONE 17 May 2026 (no commit — verification only).** Returns 200 with `application/json` content type to anonymous curl against `mastersettertcg.com`. Resolved when custom domain went live.

37. **Z-index scale inconsistency.** Two bottom-sheet overlays use different values: `LocationExplainer` at 300, `FindOnline` at 9999. `ReportCardFAB` (new) sits at 400; `ReportCardForm` overlay (new) uses 9999 to match `FindOnline` and correctly cover the FAB. The inconsistency is harmless now but will become confusing as more layered UI is added. Future cleanup: document a named z-index scale (e.g. page content 1–99, sticky UI 100–199, page overlays 200–399, floating buttons 400–499, modals/sheets 9000+) and standardise all existing usages against it.

---

## 11. EMAIL — POST-LAUNCH POLISH

33. **Resend Insight: "Ensure link URLs match sending domain."** Now mostly
    addressed by the token_hash flow — reset/confirm links point at
    `mastersettertcg.com`, not raw `supabase.co`. Re-check the insight is
    cleared next time Resend's checked.

34. **Resend Insight: "Don't use no-reply."** Best-practice nudge. Could
    switch sender to a friendlier address still on the verified
    `send.mastersettertcg.com` subdomain (NOT `hello@mastersettertcg.com` —
    bare domain not verified in Resend).

35. **Post-launch:** proper inbox + "send as" so replies come from `hello@`.

---

## 12. REVENUE — MONITOR

- eBay affiliate is live — monitor dashboard.
- Contact Fetch TCG (fetchTCG.com.au) re partnership.
- Revisit TCGPlayer affiliate when AU shipping is restored.
- Revisit US expansion later.

---

## 13. OBSERVABILITY — NICE TO HAVE

- Structured JSON logging on price refresh.
- Axiom via Vercel marketplace.
- Admin dashboard (sets returning `priceSource=none`, refresh durations,
  error rates); alerting.
- **Wire Sentry error capture — move to next session (4 Jun 2026).** Two silent failures discovered today (anonymous migration zero-entries + setModes wipe) were both invisible without manual `SELECT` in Supabase Studio. Sentry is disclosed in the Privacy Policy but not yet wired to a real DSN. Until it is, any server-side throw inside a try/catch and any client-side swallowed error goes completely dark. Priority: move to next session before further beta expansion.

---

## 14. APP STORE — POST-LAUNCH

- Apple App Store + Google Play wrappers; app icons all sizes; decide
  Capacitor vs TWA vs PWA.

---

## 15. STORAGE — POST-LAUNCH

- Monitor verification-photo storage; weekly cleanup function for
  verification folders >30 days where the trade is resolved.

---

## 16. LEGAL — REVIEWED ROADMAP

- **Get the ToS and Privacy Policy reviewed by a lawyer** before scaling
  beyond the first ~100 friend-and-network users. A flat-fee startup
  review is a few hundred dollars and is genuinely worth it before
  strangers are on the platform. Specifically priority for lawyer eyes:
  - The "platform not a party" framing vs the app actively suggesting
    matches
  - The limitation of liability vs Australian Consumer Law (ACL)
    non-excludable guarantees
  - The Pokémon/Nintendo IP use (data source licence, image hotlinking)
  - The social-media-classification question (does Master Setter fall
    under evolving AU social-media-age legislation?)

---

## 17. KEY WORKING-NOTES LESSONS FROM THE LAST FEW DAYS

- **proxy.js has now bitten three times** — the missing forgot-password/
  reset-password routes, the `/brand/` PNG, and very nearly the
  `/terms`/`/privacy` routes. The documentation is now in place at both
  file and `CLAUDE.md` level. **Any new public route or asset must be
  added to PUBLIC_PATHS or a prefix check** — this is the single most
  important repeating-lesson of the project.

- **Data-model changes need reader audits.** The untick-orphan fix (which
  was right) silently broke Discover because Discover was still reading
  "unticked" as `checked=false` instead of "no row." When changing what
  a row's presence/absence means, audit every consumer of that data.

- **Observation before action.** Multiple multi-round sagas resolved only
  when we stopped theorising and pulled hard evidence (HAR files, Network
  tab Initiator, console errors, local prod-build tests). For SW issues,
  the Initiator column is ground truth.

- **Two fixes in a row that don't move the symptom** = stop fixing, go
  read the actual request path. The bug is somewhere nobody's looked yet
  (forgot-password was `proxy.js`; the password reset was the PKCE flow
  not the page logic; etc.).

- **Reasoned-through ≠ tested.** Every fix that "should work" has to land
  on the real device before being declared done. SW cache cycling matters
  for this — stale state has cost real time.

- **Reports describing work ≠ proof the work matches the brief.** Read
  what was actually built carefully. Several times this project Claude
  Code reported "done" while having silently skipped parts of a brief
  (most notably the legal-integration build that did Part 5 and skipped
  Parts 1-4).

- **Pattern variant rows must only be created for confirmed sets.** Before
  creating `pokeball_reverse_holofoil` or `masterball_reverse_holofoil`
  printings for any set, confirm via BOTH an authoritative source
  (PokeCottage, PokeBeach) AND an empirical PPT probe
  (`GET /api/v2/cards?setId=N`, count "(Poke Ball Pattern)" / "(Master
  Ball Pattern)" products). The canonical confirmed list lives in
  `PPT_PATTERN_SET_IDS` in `app/api/refresh-prices/route.js`. Sets with
  `null` entries have been deliberately confirmed as having no patterns —
  do not re-add. The sv10 phantom row incident (286 rows seeded for
  Destined Rivals which has zero pattern products) cost a full session to
  diagnose and clean up (migration `20260522130000`).

- **Schema and data changes go through tracked migrations only — no direct
  SQL in the Supabase dashboard.** The sv10 phantom rows were created via
  untracked dashboard SQL months before they were discovered. Finding and
  deleting them took a full diagnostic session. Migrations leave a trail;
  dashboard SQL doesn't. Every `INSERT`, `UPDATE`, or `DELETE` that changes
  the shape or content of the data model goes in `supabase/migrations/` with
  a descriptive name and a header comment explaining why.

- **Any feature inserting `collection_entries` must also upsert a `user_sets` row.** Two tables are required for catalog visibility: `collection_entries` (the cards) and `user_sets` (the set subscription). MY SETS filters by `user_sets` — cards can be fully present in `collection_entries` with no corresponding `user_sets` row, producing an empty MY SETS with no error and no clue. Caught during production test7 verification of the anonymous migration. Upsert shape: `{ user_id, set_id, hidden_at: null }` with `onConflict: "user_id,set_id", ignoreDuplicates: true`. `added_at` defaults itself; prices come from the cron later.

- **Hydration-safe pattern for components reading client-only APIs.** Components that read `localStorage`, `window`, `navigator`, or any other browser API during render cause React hydration mismatches — the server renders one value, the first client render produces a different value, and Next.js overlays a blank screen. The pattern: `const [hydrated, setHydrated] = useState(false)`, then `setHydrated(true)` as the first line of `useEffect`, then gate all dynamic content with `hydrated && ...`. The server render and the first client render must match. Caught when `AnonymousTabBar`'s dynamic CTA text (reading localStorage card count) caused the entire app to blank.

- **Service worker must explicitly bypass `/auth/*` and `/api/*`.** SW intercepting `/auth/*` produces "Failed to convert value to 'Response'" — Supabase auth redirect chains return opaque responses the SW can't handle, breaking the entire `/auth/confirm` lifecycle silently. SW intercepting `/api/*` risks caching dynamic responses or 401s. Both must be early-return guards at the top of the `fetch` handler, before any caching logic, ordered: non-http scheme → Supabase hostname → non-GET → `/auth/` → `/api/`.

- **SW cache version bump is required on any SW change.** Without bumping the `CACHE` constant in `public/sw.js`, existing PWA installs keep the OLD service worker indefinitely. `skipWaiting() + clients.claim()` only activate a newly installed SW — they can't help if nothing triggered a new install. Increment the constant (current: `"perfect-order-v25"`) on every SW change; the next page load activates the new worker and evicts stale entries.

- **Anonymous data migration should fire on any successful auth with localStorage data — not just when a matching intent is present.** Real failure modes: user signs up, but `/auth/confirm` migration fails (SW bug, network glitch); user signs in later with no intent param but data still in localStorage. A catch-all block at the end of BOTH auth paths (confirm page + signin handler) handles these without cost to normal signins (no localStorage data = no-op). Idempotency via ON CONFLICT DO NOTHING makes re-running harmless.

- **`ms_anon_intent` sessionStorage leaks across sessions if the user abandons the auth flow.** Without expiry, intent captured when a user tapped a Trade Binder card hours earlier would route them to that message thread on next signin. Fix: record `capturedAt` timestamp at write time, check age on read, discard if older than 30 minutes.

- **`localStorage` is origin-scoped — `localhost:3000` and `mastersettertcg.com` are different origins.** Anonymous data ticked at `localhost:3000` is not accessible at `mastersettertcg.com`, and vice versa. The full anonymous → signup → migration flow must be tested on a single origin end-to-end. Testing signup on production while data was accumulated on localhost always produces 0 migrated entries with no error. This cost several hours of confused diagnosis during Door B verification.

### Gotchas — 30-second fixes that took 20 minutes to find

- **Supabase real-time requires explicit publication membership.** A `supabase.channel().on("postgres_changes", ...).subscribe()` will appear correctly wired in code but silently receive zero events if the table isn't in the `supabase_realtime` publication. Always verify both: code subscription exists AND table is in the publication (`SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`). Add missing tables via `ALTER PUBLICATION supabase_realtime ADD TABLE <table>;` and save as a migration. Discovered 23 May 2026 when TradePanel real-time updates weren't firing across devices despite the subscription code being correct.

- **Fail-closed env var checks on auth-protected routes.** When a route is authenticated via a shared-secret env var (not a user session), always check explicitly for env var presence at the top of the handler and return 503 "not configured" if unset — before doing any string comparison. Do NOT combine the presence check and the value comparison into a single `||` expression: `!process.env.SECRET || header !== \`Bearer ${process.env.SECRET}\`` fails closed correctly today, but produces an indistinguishable 401 for both "env var missing" and "wrong secret", making misconfiguration invisible in logs. Correct pattern: `if (!process.env.SECRET) return 503; if (header !== \`Bearer ${process.env.SECRET}\`) return 401;`. This prevents `Bearer undefined` string-comparison footguns and makes deployment misconfiguration immediately diagnosable. Applied to both `card-report-notify` and `trade-handover-prompts` routes.

- **Windows PowerShell glob expansion.** `[` and `]` in file paths (Next.js dynamic routes like `[tradeId]`) are treated as wildcards by PowerShell's `Remove-Item`. Use `Remove-Item -LiteralPath ...` to actually delete dynamic-route files.

- **Supabase Auth config location.** Password minimum length, leaked-password check, and other auth-provider config lives at: Dashboard → Authentication → Sign In / Providers → scroll to Auth Providers → expand the Email provider row. NOT the Policies page (that's RLS). NOT Attack Protection (that's captcha + leaked-password toggle only). NOT Email under NOTIFICATIONS (that's email templates). The `auth.config` SQL table no longer exists in current Supabase — must use the dashboard.

- **PowerShell `curl` is aliased to `Invoke-WebRequest`.** Use `curl.exe -i ...` (with the `.exe`) for real curl behaviour. Important for testing public endpoint accessibility — `Invoke-WebRequest` uses session cookies which can mask 401 errors.

- **Verifying public asset accessibility.** Don't test by opening a URL in a browser — your browser session masks auth issues. Use `curl -i` (or `curl.exe -i` on Windows) with no cookies to test as an anonymous client would.

- **PPT's standard waterfall cannot reach pattern products.** ptcgio's product-ID
  discovery (via `prices.pokemontcg.io/tcgplayer/{id}` redirect) resolves only the
  standard TCGPlayer product for a card. Pokeball/masterball variants are *separate*
  TCGPlayer products in a different ID range (610541+ for sv8pt5). Only PPT's set
  endpoint (`/api/v2/cards?setId=N`) can enumerate them. There is no per-card route
  to them via any other source.

- **PPT product name convention for pattern variants.** PPT appends
  `"(Poke Ball Pattern)"` or `"(Master Ball Pattern)"` to the product name —
  e.g. `"Cottonee (Poke Ball Pattern)"`. This suffix is the matching key the new
  code relies on. If PPT changes this naming convention, `tryPptPatterns` will
  silently return 0 matches rather than erroring.

- **pokemontcg.io has NO /products, /prices, or /variants endpoints.** Only
  `/cards`, `/sets`, `/types`, `/subtypes`, `/supertypes`, `/rarities`. Verified
  during session 5 audit. Do not chase these non-existent endpoints.

- **PokeTrace is currently dead for modern English sets.** Returns `count: 0` for
  all SV-era and SWSH-era English slugs tried during session 5. The `tryPokeTrace`
  short-circuit handles this gracefully (`result` stays `null`), but the source
  contributes nothing to English-set pricing. Last successful pull confirmed
  2026-05-08.

- **TCGPlayer price-key naming differs by era:**
  - SV-era (most sets): `holofoil` + `reverseHolofoil` keys (no `normal` key for Rares)
  - SWSH/XY/SM: `normal` + `reverseHolofoil` keys (no `holofoil` key — the
    "holofoil-as-Rare" assumption in `seed-manual-printings.mjs` created phantom rows here)
  - EX/e-Card/DP/Platinum: Rares holofoil-only but priced under TCGPlayer's `normal` key
    (no `holofoil` key for these eras — causes Problem 3, see item 12)
  Pattern products have a `Holofoil` entry in `printingsAvailable`, but their price
  lives in `product.prices.market`, not in a TCGPlayer variant key.

- **PPT free tier (100 credits/day) is adequate for single-user dev only.** Worst-case
  pattern fix costs ~24 credits per full 4-set refresh cycle. Multi-user load will
  exhaust it in hours. Must upgrade to $9.99/mo plan before soft launch (see item 10a).

- **Pattern variant inclusion rule (sv8pt5 / zsv10pt5 / rsv10pt5 only):**
  Pokéball = non-ex Pokémon (C/U/R) + Trainers (C/U). Master Ball = non-ex Pokémon
  (C/U/R) only. Trainers do NOT get Master Ball variants. Confirmed against Cardrake
  community consensus and verified via Black Bolt coverage audit.
  sv10 (Destined Rivals) was incorrectly included in this list — it has zero
  pattern variants per PokeCottage + PPT empirical probe. Phantom rows deleted
  via migration `20260522130000`. Only three sets have Prismatic-style
  pokeball+masterball patterns: sv8pt5, zsv10pt5, rsv10pt5.

- **me2pt5 (Ascended Heroes) uses a different pokeball pricing path.** PokeScope's
  `default` case prices `pokeball_reverse_holofoil` as `marketPrice` directly (no
  multiplier). 140/140 priced ($0.18–$3.50 range). No Master Ball variants exist in
  me2pt5. ME-set logic must NOT be touched by future pricing fixes — `tryPptPatterns`
  already guards this with `!ME_SETS.has(setId)`.

- **Supabase JS silently drops RLS WITH CHECK failures on INSERT — no error, just empty data.** When an INSERT fails the `WITH CHECK` policy, Supabase JS returns `{ data: [], error: null }` — not an error object. Any route that checks only `if (error)` will falsely report success while persisting nothing. Always pair INSERTs to RLS-protected tables with `.select()` and verify `data.length > 0` before returning success. Discovered 24 May 2026 debugging `POST /api/block` — the route returned `{ blocked: true }` while `user_blocks` stayed empty. Applied fix: both an `insertErr` check and a `!insertData?.length` check before returning success.

- **Old notifications referencing later-blocked users surface dead links.** Notifications created before a block (trade proposals, friend requests) remain in the recipient's notification list; their links resolve to now-restricted content (blank profile view, empty trade panel). Acceptable per the "historical events stay; access is restricted" design — same as past messages remaining in the DB. Polish opportunity: "no longer available" state for stale notification links if it generates user complaints. Discovered 24 May 2026 during Block end-to-end device test.

- **Event-capture for client-side Supabase operations uses Postgres triggers (security
  definer), not application-level inserts.** All five Feed Milestone 1 event types
  (`set_started`, `set_completed`, `card_favourited`, `friend_added`, and
  `set_milestone` via thin API route) are captured this way because the source
  operations (user_sets INSERT, master_completions INSERT, favourites INSERT,
  friendships UPDATE) are done client-side via the Supabase SDK. Migrating those to
  API routes would be meaningful scope creep. Trigger functions run as security definer
  and bypass RLS to write into `feed_events`. Established 24 May 2026, Feed Milestone 1.
  Future event types follow the same pattern unless the source operation already has an
  API route.

- **Postgres triggers fire on manual Supabase Studio edits too.** The feed_events
  triggers (on `user_sets`, `master_completions`, `favourites`, `friendships`) will
  fire for manual row edits made via Supabase Studio — not just app traffic. If you
  manually insert a `user_sets` row for debugging, a `set_started` feed_events row
  will be written for that user. Not a bug, but worth knowing before doing data fixes
  on trigger-backed tables. Discovered pattern 24 May 2026.

- **Event capture race condition pattern.** When multiple parallel requests check
  "has this event already fired?" before any have inserted, all see "no" and all
  insert. Fix is a partial UNIQUE INDEX scoped to the event type, with the route
  handling Postgres error code `23505` as a successful no-op (return 200,
  `thresholds_fired: []`). Established 24 May 2026 for `set_milestone` events
  (migration `20260524174839`, index `feed_events_milestone_unique_idx`). The race
  was observed in production: four parallel ticks crossing the 90% threshold produced
  two `set_milestone` rows 18ms apart before the unique index existed. Apply this
  pattern to any future event type where threshold detection requires server-side
  computation and concurrent firing is possible.

- **Card-level helpers are wrong for printing-level filters.** `isCardOwned(cardNumber)` uses `prints.some(p => ownedPrintings[p.id]?.checked)` — returns `true` if *any* printing is owned. This is correct for stats rows ("how many cards has this user started?") but wrong for Missing filters ("show cards where at least one printing is uncollected"). Friend set-detail view copied `isCardOwned` from personal view where it was used for the stats count, then reused it for the Missing filter — silently wrong, cards with partial printing ownership were excluded from Missing. The correct test for Missing is `checkedCount < totalPrints` (mirror of personal view's `missingFilter`). Before reusing any helper at a new call site, confirm its unit of measurement (card vs printing) matches what the new site requires. Discovered and fixed 24 May 2026, commit `a309e6b`.

- **Friend-facing card render sites must call `get_friend_favourites` and pass the resulting Set to the renderer.** When building any new surface that renders a friend's cards, call `supabase.rpc("get_friend_favourites", { viewer, target })` alongside the other data fetches and store the result as a `Set<string>` of printing IDs. In the card renderer, `isCardFavourited = prints.some(p => favouritesSet.has(p.id))`. Display a `★` overlay (top-left, `#FFB830`, `fontSize:15`, `drop-shadow(0 1px 3px rgba(0,0,0,0.85))`) that taps to `/friend/${handle}/favourites` with `stopPropagation`. Top-left positioning avoids the existing completion badge (top-right) and partial-collected N/M badge (top-right). Pattern established 24 May 2026 in `app/friend/[handle]/[setId]/page.js`. Apply to any future friend-facing card surface.

- **`get_friend_favourites` is fetched on every friend set-detail page load — acceptable N+1 at current scale.** The RPC runs as part of the `Promise.all` on mount in `app/friend/[handle]/[setId]/page.js`. At current user count this is fine. If it becomes a hot path: fetch once per friend session and pass the Set through context, or add a `set_id` filter to the function so it returns only the relevant set's favourites rather than all of the friend's favourites.

- **Set logos contain the set name as part of the graphic art — this is acceptable alongside MSPageTitle.** When a set logo is rendered alongside MSPageTitle's text-rendered set name, the words appear visually duplicated. This reads as graphic brand mark + page title, not as two text strings, and is considered acceptable. A SEPARATE earlier fix (commit `3496418`, 24 May 2026) removed a real text-rendered set name from the friend set-detail hero that duplicated the MSPageTitle. These are different categories: logo-art overlap is acceptable; independent text elements duplicating the title text are not.

- **Sentry `enabled: process.env.NODE_ENV === 'production'` keeps local dev noise out of the dashboard.** Vercel preview deploys ARE captured because Vercel sets `NODE_ENV=production` on all builds (preview and production alike). To debug locally with Sentry active, temporarily flip this flag. Without it, development errors and test noise clutter the Issues queue.

- **Source maps upload on every Vercel build via `withSentryConfig`.** Stack traces in Sentry resolve to original source code. If errors appear with minified stack traces, the source map upload broke — check Vercel build logs for lines prefixed with "Sentry" for upload errors. `SENTRY_AUTH_TOKEN` in Vercel env vars is required for this to work.

- **Sentry DSN is inlined as a literal string in config files (wizard default).** DSN is public by design — it identifies the project but can only send events, not read data. No secret risk in inlining it. The brief specified env vars; we followed the wizard's pattern instead. Do not move the DSN to an env var without good reason.

- **Sentry's `automaticVercelMonitors` only works with Pages Router.** App Router cron routes need manual `captureCheckIn` calls. The `trade-handover-prompts` route demonstrates the pattern: pass the schedule config object on the first (in_progress) check-in — Sentry auto-creates the monitor. Subsequent calls reference the returned `checkInId`. Every distinct exit path (error, empty, per-trade catch, final success/partial-failure) needs its own check-in call or the monitor goes stale.

- **Sentry Crons partial-failure visibility: per-trade catch blocks call `captureException` with `tradeId` in `extra`.** Individual failures surface as filterable Issues in Sentry. The final check-in status is `errors.length ? "error" : "ok"` — partial failures mark the cron run red in the monitor, not just the individual exception. Strict by default; loosen only if spurious single-trade failures become noise.

- **API route Sentry instrumentation: only the cron route is manually instrumented.** All other API routes rely on `onRequestError` (exported from `instrumentation.js` as `Sentry.captureRequestError`) which captures all unhandled server-side errors automatically. If finer-grained capture is needed in a specific route later (custom tags, breadcrumbs, partial-failure tracking), wrap the relevant section with `try/catch + Sentry.captureException`. Do not manually instrument every route — the automatic hook is sufficient for the common case.

- **Files in `lib/` that mix server-only and client-safe exports MUST be split into `*-server.js` and `*-client.js`.** Importing `next/headers` (or any other server-only module) in a file that a `"use client"` page also imports causes Webpack/Turbopack to drag the server module into the client bundle and fail at build time with a cryptic error. Pattern: server-only exports (anything using `cookies`, `headers`, `NextResponse`) go in `lib/foo-server.js`; client-safe exports go in `lib/foo-client.js`. Discovered 25 May 2026 when `lib/admin.js` (mixed) caused a build failure — split into `lib/admin-server.js` and `lib/admin-client.js` to fix.

- **Admin gate pattern: `profiles.is_admin` column + two helper modules.** `lib/admin-server.js` exports `requireAdmin()` for API routes — creates its own Supabase client, checks auth + `is_admin`, returns `{ user, supabase }` or a 401/403 `NextResponse`. `lib/admin-client.js` exports `isAdminClient(supabase, userId)` for `"use client"` pages — takes a browser client, returns bool, caller calls `notFound()` if false. Single admin route at `/admin/reports` — not linked from app nav, discovery-by-URL only. `profiles.is_admin` defaults to false; set to true via SQL UPDATE for each admin.

- **Admin RLS pattern: additive permissive policies on `user_reports`.** Added `user_reports_admin_select_all` (SELECT) and `user_reports_admin_update` (UPDATE) policies gated on `profiles.is_admin = true`. PostgreSQL OR-combines permissive policies — existing `user_reports_select_own` still applies, so regular users see their own reports while admins see all. No existing policy was modified or removed.

- **`notFound()` from `next/navigation` does NOT work as a security gate in `"use client"` components.** When called from inside `useEffect`, it throws a sentinel error inside an async function — the rejected Promise is silently swallowed (nothing awaits it, React's reconciler never sees it). The component stays in its current rendered state, functioning as a no-op. Use `router.replace(targetUrl)` from `useRouter()` instead, combined with a `checking` state: `if (checking) return null;` BEFORE any JSX, and `setChecking(false)` only after the gate confirms access is allowed. This pattern prevents any data flash for users who will be redirected. Applies to ANY client-side gate (admin pages, any feature checked client-side via Supabase auth). Discovered 25 May 2026 — the original admin gate let non-admins view report data because `notFound()` was silently swallowed.

- **Card report status transitions preserve `resolution_note` when reopening.** When a resolved or dismissed report is reopened (status reset to 'open'), only `status` and `resolved_at` are cleared — `resolution_note` is treated as historical context, not state. Useful for "I already fixed this once, why is it being reported again?" workflows. Same principle applies to any future workflow with reversible state transitions: reset the status and timestamp, leave the audit trail.

- **Profile fetches for @handle display should never be a serial gate before data loading.** When a page needs to show a user's handle in the header, fetching their profile and then awaiting the result before starting data fetches is a waterfall. Auth gives you `user.id` immediately — run `profiles.select().eq("id", user.id)` in parallel with all other data queries via `Promise.all`. The profile render is non-blocking; if it loads a tick later than the data, nothing breaks. Pattern established 26 May 2026 on homepage (`perf(home): parallelize profile + entries + prefs after auth`, commit `6934068`) and friends page (`perf(friends): parallelize own profile fetch with friendships load`, commit `38423af`).

- **Latest-per-group queries must use a SECURITY DEFINER Postgres function, not client-side aggregation of an unbounded query.** The inbox query pattern — "fetch all messages, then loop to find the latest per peer" — hits PostgREST's 1000-row default limit silently. Once truncated, old conversations vanish from the inbox without error. The correct fix is a `SECURITY DEFINER` function using `DISTINCT ON` to return exactly one row per conversation partner server-side, with unread counts as a CTE. The canonical pair deduplication key is `LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)` — this covers both directions of a conversation regardless of who sent first. Pattern: see `get_inbox_threads()` (migration `20260526214808`). The same pattern applies to any future "latest per entity" requirement (latest trade per peer, latest audit log per entity, etc.).

- **When two related fixes are in-flight back to back, "Pushed [hash]" must name the fix explicitly.** During session 12, the homepage perf commit (`6934068`) was confirmed pushed, and the friends perf fix was separately approved — but "Pushed 6934068" in context was read ambiguously, and the friends fix was accidentally left uncommitted. Discovered via `git status`. Rule: always name what shipped ("homepage perf fix pushed as 6934068") and confirm each fix separately before moving on.

- **Pre-fetch idempotency doesn't survive concurrent writes.** A pattern like "SELECT to check if row exists, then INSERT if not" looks safe but isn't — N rapid parallel route calls can all pass the SELECT before any INSERT commits, then all INSERT, producing N duplicate rows. Discovered 27 May 2026 during M3 smoke test: 5 rapid ticks of a 5-card set produced 3 `set_started` rows. Milestone events were protected from session 10 (`feed_events_milestone_unique_idx`); set_started and set_completed were not. Fix: always pair pre-fetch idempotency with a partial unique index, and handle 23505 in the route as a silent no-op. Migration `20260527000003_m3_feed_events_unique_indexes.sql` is the canonical reference. Applies to ANY route-fired event; trigger-fired events are protected by the source-row constraints (e.g. favourites unique key, friendships unique pair).

- **State that needs to survive in-app navigation belongs in a Context provider mounted at `app/layout.js`, above per-page MSShell instances.** Pattern established 27 May 2026 by `RefreshPricesProvider`. The provider wraps `{children}` only (not `<SwRegister />` or `<Analytics />`). Per-page MSShell consumes via hook. Global UI (slim indicator bar, etc.) mounts inside MSShell between header and `<main>`. Survives navigation between routes; does NOT survive hard reload or PWA close (that's A2 territory, deferred). `sessionStorage` can be used to detect a hard reload mid-operation and show a transient recovery state.

- **Positive-direction events use API routes; negative-direction cleanup uses Postgres triggers.** New M3 pattern, alongside the existing "client-side Supabase operations use triggers" rule. Example: tick-on at 100% INSERTs a `set_completed_pending` row via the record-milestone API route (positive direction). Untick or delete on `collection_entries` deletes that pending row via `trg_delete_pending_on_collection_change` (negative direction). The asymmetry is correct — the route is already called on tick-on, but isn't called on untick. Adding a route call to every untick just to handle cleanup would double network round-trips for a one-line DB operation; a trigger handles it server-side with zero added latency.

- **When both JS and SQL implementations of the same logic exist, both files must carry parity comments pointing at the other.** Drift between implementations is silent and causes correctness failures. M3 has `computeOwnershipPct` in both `lib/feed-progression.js` (JS, called by the record-milestone route) and inside `flush_pending_completions()` (SQL, called by pg_cron). Both files carry a comment block explaining what must stay in sync. If filter mechanism, join shape, or rounding changes in one, the other MUST change to match. Adopt this rule for ALL future JS/SQL duplications.

- **Briefs should specify behavioural intent in plain language, not just pseudocode.** A faithful implementation of wrong pseudocode is still wrong. Discovered 27 May 2026: M3's milestone bulk-add debounce pseudocode handled "multiple newly-crossed thresholds in a single call" (rare in practice) instead of "any milestone crossing during the 30-min window" (the actual design intent). Smoke testing on a real user flow caught it; brief review wouldn't have. From now on, every brief leads with a plain-language statement of "what should happen, from the user's perspective" before any pseudocode.

- **For migrations, verify the SQL that was actually applied — not just the success status.** Discovered 27 May 2026: a typo in a Claude Code summary ("set_completed_potential" instead of "set_completed_pending") on an ALTER TABLE line raised concern about whether the typo was only in the report or also in the SQL. MCP verifications (table exists with correct name, RLS enabled, no phantom typo'd table) confirmed the SQL was correct; the typo was transcription-only. The lesson: for migrations specifically, when the artifact IS the SQL, verify the database state matches expectations after apply. Cheap, catches silent failure modes that build/lint can't.

- **pg_cron worst-case settle delay is up to 5 min + full cron interval, not 5 min + half-cron-interval.** Observed 27 May 2026: a `set_completed_pending` row with `crossed_at = 12:10:35` (settle expires 12:15:35) was skipped by the 12:15:00 cron run because the window hadn't expired yet, and picked up by the 12:20:00 run. Real-world worst case for the M3 design is closer to 10 minutes than the original "5+5" estimate. Acceptable for the Feed but worth knowing for any future cron-based settle pattern.

- **Briefs delivered as copyable .md files via present_files for top-of-task plans; chat-format fenced code blocks for per-part follow-ups.** User workflow preference established 27 May 2026 (session 13). Files are easier to copy from a separate panel; per-part instructions are easier to copy from chat. Future sessions should default to this format.

- **Any page reachable from multiple navigation paths needs a router.back() back button.** Discovered 27 May 2026 (session 13 part 2): four pages added or updated this session — `/friend/[handle]` profile, `/set/[setId]`, plus the existing `/friend/[handle]/[setId]` and `/friend/[handle]/favourites` from sessions 11/12. Pattern: `<BackButton />` (no href, defaults to `router.back()`) inlined as the FIRST child of the page's identity row or hero row flex container. Default import (`import BackButton from "@/components/BackButton"`). Works regardless of entry path. Edge case: when there's no history (deep link, PWA cold start from saved URL), `router.back()` is a no-op — silent dead tap. Accepted edge case today; upgrade BackButton with a `fallbackHref` prop if it surfaces as a beta-tester complaint.

- **Dynamic routes (`[id]` parameters) build once and serve all variations.** Easy to confuse "32/32 pages" build output with "32 individual instances built." Next.js builds the route template once; the parameter fills in at request time. Adding a component to `app/set/[setId]/page.js` adds it to every set — existing, future, even sets that don't exist yet. Mental model: file = template, URL parameter = data, render = template + data at request time.

- **PostgREST returns bigint columns as strings, not numbers.** Discovered 27 May 2026 during M3 PART 4: `like_count` and `comment_count` from `get_feed_events` (SQL `count(*)::bigint`) arrived as strings on the client. Without `Number()` coercion, `count + 1` on a like-tap produces `"31"` instead of `4` (string concatenation). Apply `Number(value)` immediately on consumption in JS. Affects any SQL function returning `count()`, `sum()`, or other aggregates.

- **`printings.image_url` is universally NULL — always use `cards.image_large` for card art.** Every join that needs card art must reach through `printings → cards.image_large`. Any code that reads `printings.image_url` directly will render a broken image with no error. Verified during session 14 when the duplicates page tiles were first wired up. Applies to every new card-art surface going forward.

- **Pokémon card aspect ratio is 2.5/3.5, not 2/3.** The correct CSS value is `aspectRatio: "2.5/3.5"`. Using `"2/3"` makes cards appear visibly squashed. Discovered session 14 when duplicates tiles looked wrong vs. the set page. Use this aspect ratio on every new card image surface.

- **`--border-radius-md` (8px) and `--border-radius-lg` (12px) are now defined in `globals.css`.** These CSS custom properties were ghost variables — referenced in several components but not defined anywhere — until session 14. Now canonical. Do not add hard-coded `borderRadius: 8` or `borderRadius: 12` to new components; reference the token.

- **Changing a Postgres function's return type (RETURNS TABLE columns) requires `DROP FUNCTION IF EXISTS` before `CREATE OR REPLACE`.** PostgreSQL rejects `CREATE OR REPLACE` if the new definition adds, removes, or changes column types in `RETURNS TABLE` — even if the function body is otherwise identical. Always lead migration files that change a function signature with `DROP FUNCTION IF EXISTS public.fn_name(arg_types);` then the full `CREATE OR REPLACE`. Discovered 28 May 2026 when adding `set_logo_url` and `rarity` to `get_user_duplicates` (migration `20260528000004`).

- **`MSShell hideTabBar={condition}` is required whenever a page has a fixed bottom action bar.** The app tab bar sits at `bottom: 0` and will fully obscure any `position: fixed; bottom: 0` action bar. Pass `hideTabBar={showingBar}` to the MSShell for that page. The shell shifts the tab bar off-screen when the condition is true. Pattern established on Discover; applied to the duplicates page selection bar in session 14. Any future page with a fixed bottom CTA must do the same.

- **PostgREST cannot reliably order by a nested/aliased embed column — sort client-side.** Attempting `ORDER BY embed_alias.column` in a PostgREST query either errors or is silently ignored depending on the join type. For any surface that needs sorted results from a multi-table query, sort in JavaScript after fetching. `useMemo` with a dependency array on the sort key is the standard pattern used throughout this app. Applies to all new list surfaces that need custom sort orders.

- **Rarity ranking is centralised in `lib/rarity.js` — import, don't copy.** `rarityBucket(rarity, subtypes, cardNumber, setPrintedTotal)` and `BUCKET_ORDER` (33-entry array, index 0 = Common, index 32 = Promo) live in `lib/rarity.js`. The set page originally had its own copy; it was replaced with an import in session 14. Any future surface that needs rarity sort or display must import from `lib/rarity.js`. `rarityRankOf(rarity)` pattern: `const idx = BUCKET_ORDER.indexOf(rarityBucket(rarity, [], 0, 0)); return idx === -1 ? 999 : idx;` — passing `([], 0, 0)` for the variant args gives the base bucket, which is adequate for sort purposes.

- **Faceted filter narrowing pattern:** when building a multi-select filter where options narrow dynamically, each section's available options must be computed from the data filtered by the OTHER sections only — never its own selection. Computing a section's options including its own filter collapses it to the selected value(s) and breaks multi-select within that section. Implemented on the duplicates filter panel (`setOptions`/`rarityOptions`/`priceOptions` each exclude their own filter from the deps). Reusable if faceted filtering appears elsewhere.

- **eBay OAuth tokens are 7200s — refresh at ~6300s (105 min).** The Client Credentials grant (`POST /identity/v1/oauth2/token`) returns `expires_in: 7200`. Cache the token in a module-scope Map keyed by app:cert pair (dev/prod safe). Refresh before the 7200s expiry; 6300s leaves a comfortable margin. Implemented in `lib/ebay/auth.js`.

- **eBay Browse API returns `itemAffiliateWebUrl` pre-tagged — no manual `mkrid` mapping needed.** Pass `X-EBAY-C-ENDUSERCTX: affiliateCampaignId=YOUR_ID` as a request header; the API includes `itemAffiliateWebUrl` in the response with all EPN params already injected (correct `mkrid` for the marketplace, `mkevt`, `mkcid`, etc.). Use `item.itemAffiliateWebUrl ?? item.itemWebUrl` as `listingUrl`. When `EBAY_EPN_CAMPAIGN_ID` is not set, omit the header, log a one-time warning, and fall back to bare `itemWebUrl`. Never manually construct EPN URLs from a `mkrid` table.

- **eBay Browse API default quota is 5,000 calls/day for new production apps.** Newly approved production applications start at 5k calls/day. Can be increased substantially after passing eBay's Application Growth Check. The 1h cache TTL (PART 2 data model) is what keeps usage well under this limit — do not bypass the cache for freshness without doing the maths first. Quota is visible in the eBay Developer Portal → Analytics API (`GET /developer/analytics/v1_beta/rate_limit`).

- **Real eBay search results include non-card items — matching logic must denylist.** A search for "Charizard 4/102 Pokemon TCG" returns posters, pins, metal cards, binder pages, and other merchandise alongside actual cards. PART 2 matching logic must drop any result whose title doesn't parse to a confident (set_id, card_number) pair that resolves to a real printing in our DB. Better to show zero listings than wrong ones.

- **The same card_number can exist in multiple sets — matching must resolve set explicitly.** Example: card number 4/102 exists in both Base Set and Celebrations Classic Collection (reprint). A search returning "4/102" with no set context would be ambiguous. The matching query (card_name + set_name + card_number) must constrain to a specific set, and the match must confirm the resolved printing_id belongs to the requested set. Never match on card_number alone.

- **Verify what a commit actually contains before documenting it.** When writing a handover entry that attributes work to a specific commit, run `git show --stat <hash>` first to confirm the file is actually in that commit's tree. The session-14 top-up attributed profile dashboard Stage 2 to `e5ddd7e` (the select-to-trade commit) based on context, but the file was never in that commit's tree. The work sat uncommitted for ~24 hours and was discovered only when a later `git status` flagged the uncommitted diff. Always verify, never reconstruct commit contents from memory.

- **PostgREST FK-ambiguity on nested embeds: two-query split is the safe pattern.** When a table has a foreign key to a target table that another table in the join also references (e.g. `printings → sets` but `cards` also has `cards → sets` via the same FK name), PostgREST cannot resolve which FK to follow and silently returns `[]` or errors. Never use a nested `.select("..., set:sets(total)")` on `printings` — it's ambiguous. Instead, run two separate queries: first fetch the `printings` row, then fetch the `sets` row by `set_id`. This is now the canonical pattern for any embed where FK ambiguity is possible. See `lib/marketplace/refresh.js` for the implementation.

- **eBay Browse API `condition` field catches graded listings that pass the title matcher.** Listings like "TCG 10 Charizard" have no grading service name token in the title (TCG 10 is not PSA/BGS/etc.), so Rule 3 passes. But eBay's structured `condition` field for that listing is `"Graded"`. Always apply a belt-and-braces check: after title matching passes, drop any listing where `(listing.condition || "").toLowerCase() === "graded"`. Without this, raw PSA-style listings would flow into the upsert table. Implemented as the second filter in `lib/marketplace/refresh.js` after `matchListing` returns a truthy result.

- **A derived array used as a `useMemo` dep must itself be stable (also memoised), or downstream memos re-run on every render.** In Discover, `filtered` was a plain `.filter()` call — a new array reference every render. The `mergedTiles` useMemo depended on it, so it reshuffled every time any state changed (including overlay open/close). Fix: memoize `filtered` with `useMemo([cards, filterSet, minValue, currency])` so it only changes when the filter inputs actually change. When filtering was later removed entirely, `mergedTiles` depended directly on `cards` (a stable state ref) — no intermediate memoization needed. Rule: if a `useMemo` depends on a derived value rather than a state/prop directly, that derived value must be either a stable ref (state/prop) or itself memoised.

- **Fisher-Yates shuffle inside `useMemo` is correct — runs once per data change, not per render.** The shuffle fires when `cards` or `marketplaceListings` changes (the deps), not on unrelated state changes (overlay open/close). This gives a feed that feels alive on navigate-back (fresh shuffle on new data load) but stays stable during a single visit. Don't move the shuffle outside useMemo or it re-runs on every render pass.

- **eBay's creative pack ships only composed badges (logo on solid colour background) — no transparent SVG or standalone wordmark PNG.** The R5+B1 variant (red wordmark on light blue) is the standard "eBay on colour" badge for partner surfaces. Future logo updates require picking a new pre-composed variant from the pack, not assembling a custom one. Also: filenames from eBay's zip contain `+` characters (`R5+B1_ebay_logo_rgb.png`) — rename before placing in `public/` since `+` encodes as `%2B` in URLs and will 404 if left as-is.

- **Currency conversion belongs at the API boundary, not in tile components.** `FriendDupeTile` initially accepted a `currency` prop and did its own USD→AUD conversion using a local RATES table. This was removed: friend-dupe tiles are about identification and action intent, not value display. Marketplace tiles show price because buyers need it to decide whether to click through; friend-dupe tiles show set name for card identification. If currency conversion is ever re-added to a tile, it belongs in the data shape returned by the API, not in the presentational component.

- **Canonical affiliate disclosure copy lives in `components/FindOnline.jsx` line 135.** When adding affiliate disclosures to new surfaces, use: "Master Setter may earn a commission from purchases made through [this link / links on this page]. This does not affect the price you pay." — adapting "on this page" vs "through this link" depending on whether the surface shows one link or many. Do not invent new wording per-surface.

- **Fisher-Yates on a flat array clusters popular items at the top of feeds; round-robin by group key (e.g. printingId) gives genuine diversity.** When a feed mixes multiple types of items (here: friend dupes + multiple marketplace listings per printing), pure random shuffle can put 3 listings of the same card adjacent at the top of the feed (real bug seen in Discover during session 17 testing). The fix: group items by a stable key, sort *within* each group (here: friend dupes first, then marketplace cheapest-first), shuffle the *order of groups* (not items), then round-robin walk — one item from each group per pass until exhausted. First N tiles (where N = unique groups) are guaranteed diverse; repeats only appear after every unique group has been shown once. Implemented in `app/discover/page.js`'s `mergedTiles` useMemo. Note: items that LOOK identical to a user but have different group keys (e.g. holofoil vs reverse-holofoil of the same Pokemon) will still appear "duplicated" visually — this is correct behaviour since they ARE different printings with different prices, but worth knowing.

- **`a6b5c5e` is the real PART 3 commit (9 files, +685/-259); `86b3621` is round-robin-shuffle-only despite a misleading commit message body that re-describes the full PART 3 scope.** When auditing PART 3 history, the diff is the source of truth, not the message body.

- **Set identity belongs in the top-left of card tiles, not bottom-middle.** When a card art is the dominant visual (Pokemon TCG card front fills the tile), small bottom text is hard to read against varied backgrounds. A small set logo image in a translucent pill at top-left mirrors the convention used by physical TCG packaging and gives strong set identity at a glance. Implemented in MarketplaceTile and FriendDupeTile in session 17 follow-up.

- **Prefix-matching in path-based tab derivation needs full segment boundaries.** `pathname.startsWith("/set")` matches both `/sets` AND `/settings` — a classic prefix collision. The correct check is `pathname.startsWith("/sets") || pathname.startsWith("/set/")` to require either the plural OR a slash-suffix. Caught in session 18 when /settings was incorrectly highlighting "Sets" in the bottom nav. Fixed in `components/chrome/MSShell.jsx`'s `deriveTab()`. Same risk exists for any future route starting with `/set` (e.g. `/setup`, `/setlist`).

- **Nested `<a>` tags are invalid HTML; React + Next.js render it silently but accessibility tools break.** When making a whole card tappable that previously had small inner Link buttons, wrap the OUTER container in `<Link>` AND remove the inner `<Link>`s — don't just add an outer wrapper. Replace the inner Links with plain `<span>` elements styled the same way. Pattern used in `/you` friends-card fix.

- **App-wide back button convention is hardcoded destinations, not `router.back()`.** Verified via git grep in session 18: every BackButton in the app passes a hardcoded `href="/..."` except one outlier in `/trade/new`. For new pages needing a back button, match the dominant pattern (hardcoded `href`) for predictable navigation regardless of how the user arrived. `router.back()` is error-prone for PWAs because deep-links and tab-switches break the history stack.

- **Supabase RLS silently returns zero rows; queries succeed with empty data.** When a user runs a `select` against a table where RLS doesn't grant them access, the query does NOT error — it returns an empty result set as if no matching rows exist. This is indistinguishable client-side from "the user genuinely has no data." Caught in session 18 when non-friend preview profiles showed 0 sets / 0 cards / 0 dupes for users who clearly had 1606+ checked entries. Fix pattern: a service-role API endpoint that bypasses RLS and returns aggregated counts only (never raw rows), called explicitly when the client knows it's in a restricted-access state. See `/api/profile/[handle]/public-stats` for the canonical example.

- **Service-role endpoints must return COUNTS or curated fields only — never pass through raw rows.** The service role bypasses all RLS, so anything in the response is exposed regardless of what the requester's auth would normally allow. The public-stats endpoint queries with `count: "exact"` and returns integers only, no row data. If a future endpoint needs to expose derived data (e.g. set names a user owns), explicitly select only the public-safe fields and document why.

- **`CREATE OR REPLACE FUNCTION` does NOT replace across signature changes.** PostgreSQL treats functions with different argument types as DIFFERENT functions, even with the same name. Iterating on an RPC signature creates a new overload alongside the old one — `CREATE OR REPLACE` only updates the matching signature. PostgREST then returns HTTP 300 (Multiple Choices) because it can't pick which overload to call. The user sees an empty result with no error. Fix: explicitly `DROP FUNCTION IF EXISTS function_name(arg_types)` before re-creating with the new signature. Caught in session 19 (commit d59cd33) when `get_marketplace_variety_for_user` had two overloads: one with `exclude_printing_ids uuid[]` and one with `text[]`. Cost: half a day debugging "the RPC works but Discover shows nothing." Always drop explicitly when changing function signatures.

- **`collection_entries` has a 4-column composite primary key: `(user_id, set_id, card_number, printing_id)`.** Migration upserts MUST use `onConflict: "user_id,set_id,card_number,printing_id"` exactly. Using only `"user_id,printing_id"` is not unique (same user can own the same printing_id across different card_numbers in different sets) and silently produces wrong ON CONFLICT behaviour.

- **`collection_entries.duplicate_count` semantic: 0 means 1 copy, N means N+1 copies.** When mapping from an anonymous `quantity` value: `duplicate_count = quantity > 1 ? quantity - 1 : 0`. `checked=true + duplicate_count=0` = exactly one owned card. Never store `quantity` directly as `duplicate_count`.

- **`user_sets` minimal insert shape for migration: `{ user_id, set_id, hidden_at: null }`.** `added_at` defaults to `now()`. `prices_updated_at` and `previous_value` are populated later by the price refresh cron. Do not try to pre-fill prices at migration time — they don't exist yet, and writing zeros would trigger the staleness gate.

- **Local `npm run build` can pass while Vercel build fails.** Turbopack (local) and Webpack (Vercel) handle missing modules differently — Turbopack may lazily resolve imports that Webpack requires at build time. Canonical example from this project: `AnonymousCollectionBlocker.jsx` existed on disk and was imported, so local build passed. Vercel build failed with "Module not found" because the file was never committed to git. Always verify deployment status after push; "local build passes" is not proof.

- **Vercel runtime logs (server-side `console.log` from API routes) are visible at:** Vercel dashboard → project → Logs (or Runtime Logs). Browser DevTools console only shows client-side output. For debugging silent API route failures in production, add a `console.log`, trigger the flow, and check Vercel Logs — not the browser.

- **Push webhook secret must be byte-identical in Vercel env and the Supabase DB trigger.** The `push_notification` trigger passes the secret in its `authorization` header. The `/api/push/notify` route reads `process.env.PUSH_WEBHOOK_SECRET`. If either is set without redeploying Vercel, or if they are rotated out of sync, the webhook 401s silently — no error surfaced to the user, notifications just stop. Any change to the Vercel env var requires a Vercel redeploy to take effect. The trigger is updated via Supabase SQL; both must change atomically. Diagnosed this session: silent 401s for ~2h because the env var was set after the last deploy.

- **Push only reaches installed PWAs (standalone mode).** `Notification.requestPermission()` and `pushManager.subscribe()` are only available in `navigator.standalone === true` or `display-mode: standalone`. Neither is available in Safari browser tabs or non-installed contexts on iOS. `isStandalone()` in `lib/push/support.js` gates all push UI accordingly. EU iOS 17.4+ may also be affected by DMA restrictions.

- **`Notification.permission` and the push dismiss localStorage flag are per-device/per-origin, NOT per-account.** A tester who granted/denied permission or dismissed the prompt under ANY prior account on the same device will not see PushNudge for a new test account. To test as a true new user: delete and reinstall the PWA (wipes localStorage + permission state). Do not diagnose "PushNudge not showing" against a reused test device without clearing this first.

- **The `ms_push_prompt_dismissed` boolean key is now migrated to `ms_push_prompt_state` JSON.** PushNudge reads the legacy key on first load, converts it to `{ dismissCount: 1, lastDismissedAt: epoch }`, removes the old key, and writes the new one. Devices that previously dismissed will get the second-ask prompt once the 3-week window clears (immediately, since epoch is old enough). The migration is idempotent — the old key is consumed and removed on first read.

- **Trade binder membership is defined by `duplicate_count > 0 OR trade_flagged = true` — four read sites must stay in sync.** The binder predicate appears in: (1) `get_user_duplicates` RPC `WHERE` clause, (2) `"anon can read public duplicates"` RLS `USING` clause, (3) `lib/queries/discover.js` friend-entries query, (4) `app/api/profile/[handle]/public-stats/route.js` dupesCount query. Every future change to binder membership semantics must land in all four places atomically in the same migration + commit. The anon RLS policy (2) is the easiest to miss — it is the gate for public/anonymous binder views and lives in SQL not JS. Missing it means anonymous viewers see stale membership. Run `grep -r "duplicate_count" --include="*.{js,sql}"` to audit if you suspect drift.

- **`trade_flagged` semantic: a single owned copy the user is willing to trade. Never collapse to a `duplicate_count` bump.** `checked=true, duplicate_count=0, trade_flagged=true` means "I own exactly one copy and I'll trade it." `checked=true, duplicate_count=1` means "I have a spare." These are meaningfully different — a user who flags their only copy for trade should not show as having a duplicate quantity of 2. The `trade_flagged` column exists precisely to preserve this distinction. Do not "simplify" by incrementing `duplicate_count` instead.

- **`collection_entries` ↔ `user_sets` are independent tables with no FK between them.** A `collection_entries` row can exist for a set not present in `user_sets` — this is intentional for the trade-binder loose-cards design (Stage 2+: AI-scan or manual-add of cards without adding the full set). Such entries appear in the trade binder (via `get_user_duplicates`) but NOT in MY SETS (which gates on `user_sets`). Do not add a FK from `collection_entries.set_id` to `user_sets` — it would break this design. Also, this means any feature that writes `collection_entries` rows for a set the user wants to SEE in MY SETS must ALSO upsert a `user_sets` row. See the existing `user_sets` minimal insert shape gotcha above.

- **`RETURNS TABLE(col_name type)` column names become in-scope variables inside the function body.** When a PL/pgSQL function has `RETURNS TABLE(printing_id text, is_active_set boolean)`, those column names become declared output variables. Any subquery selecting a column of the same name will be ambiguous (`error: column reference "printing_id" is ambiguous`). Fix: alias the subquery column to something distinct. Example: change `SELECT printing_id FROM user_owned` to `SELECT printing_id AS owned_id FROM user_owned`, then use `owned_id` everywhere. Caught in session 19 (commit 812f45b's follow-up).

---

## 18. RECOMMENDED NEXT-SESSION ORDER

When picking this back up, suggested sequence:

0. ~~**Fix the marketplace cron — DONE 3 Jun 2026.**~~ Root cause: cron-job.org job header had only `Bearer` with no token value. `CRON_SECRET` in Vercel was correct throughout. Fix: re-added full `Bearer <CRON_SECRET>` to cron-job.org header. BATCH_SIZE dropped 12 → 10 (commit `243e371`). Test run confirmed: 200 OK, `{"refreshed":10,"errors":0,"durationMs":26549}`. Deferred from this item: remove `.github/workflows/marketplace-pool-refresh.yml`; pool rebalance toward modern sets; me4 pricing (blocked on PokeScope).

0a. **Trade Binder Stage 2 — flag from current sets.** Toggle `trade_flagged = true/false` per card from within the set-page grid. Allows users to flag a single copy of any tracked card for trade without needing a duplicate. Single-row UPDATE with full PK (`user_id, set_id, card_number, printing_id`). UI note: binder should visually distinguish "spare" (`duplicate_count > 0`) from "flagged single" (`trade_flagged = true, duplicate_count = 0`).

0b. **Trade Binder Stage 3 — loose-card reconciliation.** When a user later adds a set they have loose trade-flagged cards in (AI scan → Stage 4 or manual), prompt to prefill and clarify "keep in trade binder" vs "clear the flag." Deferred until Stage 4 lands and real loose cards exist.

0c. **Trade Binder Stage 4 — AI photo-scan.** Take binder page photos → AI identifies cards → confirm-and-correct list → adds as `trade_flagged` loose cards (no `user_sets` row required — see `collection_entries ↔ user_sets` gotcha in §17). Reuses `app/api/trade/[tradeId]/verify-photo/route.js` plumbing: `claude-sonnet-4-5` client, base64 transport, JSON-regex parsing, `livePhoto` + `cardVisible` gates. Needs a new open-ended identification prompt (vs the current confirmation prompt) and higher `max_tokens` (~1024). The confirm-and-correct UI is load-bearing — accuracy on bulk binder-page photos is ~60–70%, so user review is not optional.

1. ~~**Complete pattern variant pricing (item 12, Problem 2) — zsv10pt5 re-refresh.**~~
   **DONE 22 May 2026 (session 8).** sv8pt5 verified, rsv10pt5 fully priced, sv10
   cleaned up. zsv10pt5 re-refresh complete: 72/82 pokeball + 72/74 masterball.
   Remaining 10 null-priced rows are `_pb`-suffix IDs — known limitation, zero ticks,
   no action needed unless a user complains (see item 36d).

2. ~~**Wire Sentry (item 3) — DONE 25 May 2026 (commits `e5f12e0`, `6d459f1`, `940c7ca`).**~~

3. ~~**Block (item 6) — DONE 24 May 2026.**~~ ~~**Admin queue (item 7) — DONE 26 May 2026.**~~ Both queues shipped and gate fixed. Diagnosis: `notFound()` in `useEffect` is a no-op — throws inside async Promise nobody catches. Fixed with `router.replace("/you")` + `checking` state guard (commit `e2003b4`). See §17 for the `notFound()` client gotcha entry.

4. ~~**PPT API plan upgrade (item 10a) — DONE 25 May 2026.**~~

5. ~~**Phase 4 Door A + Door B — DONE 2 Jun 2026.**~~ Both anonymous acquisition funnels live on production. Door A: anonymous Trade Binder view → message intent → auth → message thread. Door B: anonymous catalog browse → localStorage collection → signup/signin migration → restored real collection. End-to-end verified on production (test7, 15 cards migrated to me4). Next focus: real-traffic observation, deferred polish (items 43–45), and marketing plan.

**⚠️ Beta tester note — 26 May 2026:** Alex showed the app to a card-shop visitor who requested early access. Beta testers are now relevant. Practical implications: Sentry will start capturing real user errors (not just dev errors); `user_reports` and `card_reports` queues will receive real submissions; first-time user experience and friend-add flow are now on the critical path before wider access.

**⚠️ Sentry follow-up — 26 May 2026:** Check homepage and friends page p95 load time in Sentry approximately 24h after the 26 May 2026 perf pushes (commits `6934068` + `38423af`). Expecting a visible reduction from baseline (~7.3s homepage, ~3.1s friends). If no improvement, the bottleneck is elsewhere (data volume, mobile network, etc.) and warrants a fresh audit before further perf work.

5. **Price pipeline — Problem 1 (ME-set cross-check) and Problem 3 (E-Card
   auto-detect).** Both ~1–2 hours. Problem 1: ptcgio secondary verification for
   ME sets, log and skip prices diverging >20%. Problem 3: auto-detect rule for
   sets with zero non-holofoil printings → use `normal` key for holofoil rows.
   See item 12 for decision details.

6. **UI polish items** — suggested-match language (item 10), address-reveal
   nudge (item 8). Quick wins.

7. Then deferred items — 2FA, help system, browse feed, etc.

**Note — @admin duplicates test data is already seeded (28 May 2026):** 30 duplicate entries across 5 sets (151, Ascended Heroes, Black Bolt, Perfect Order, Prismatic Evolutions), 9 rarities (Common through SIR), and all 6 price buckets ($0–1 through $150+). Persistent in the DB — no re-seeding needed. Use `/duplicates/admin` to test any future duplicates-page work.

**Deferred items (not blocking, prioritised below UI polish and price pipeline):**
- **Refresh-prices UX:** The user-triggered refresh job runs 15–20s with no progress indication. A silent long-running operation looks like a broken feature to a beta tester. Three options: (A) fire-and-forget background job with a completion notification (~3 hours); (B) persistent progress bar or spinner during the wait (~1 hour); (C) a brief warning message before the request fires ("This takes up to 20 seconds…", ~15 min). Option C is the cheapest and ships the right signal immediately. Option A is the correct long-term fix. Do not leave this as-is once beta testers are using the refresh button regularly.
- **Sentry walkthrough session:** When accumulated production traffic gives meaningful Performance and Issues data (a few days of real beta traffic), do a guided tour of the Sentry dashboard — check for recurring errors, slow transactions, and any surprises from the first real users. ~30 min, low-stakes, schedule opportunistically.
- **Discover page performance:** Structurally constrained — the 3 remaining serial barriers are all genuinely dependent (auth → user ID → discovery query). No quick wins left. Skip unless usage patterns reveal a specific bottleneck users are hitting.
- **Marketplace — no PART 4 planned for the on-demand "find on eBay" from set/card pages.** Decision (session 17): keep the two surfaces separate. The existing FindOnline button on set/card pages does an outbound search to eBay's native site scoped to the user's country — costs no API calls, doesn't go through our matching pipeline, gives the user the full eBay search experience. Discover does the cached, matched, confident-printing-resolved BIN feed. Doubling up would confuse the two value props (e.g. same card showing two different prices on two surfaces). Reactive items only from here: monitor API budget vs 5,000/day cap, possibly EPN enrolment (Alex's parallel admin task — non-blocking), possibly a real region picker on `profiles.country` if/when the localStorage currency convention proves too limiting.
- **Nav-bug pass:** three known highlights issues — `/duplicates` dead tab-highlight (no tab is active); friend-set page tab mis-highlight; Profile→Settings highlight mystery (needs device repro to diagnose). Group into a single nav-polish pass.
- **`/friend/[handle]/favourites` route is now orphaned** — the Hunting strip on the ProfileView replaced the link that pointed here. The page still works by URL. Either wire it back in somewhere (e.g. a "See all" link from the Hunting strip) or accept reachable-by-URL-only for now.
- **Remove /settings avatar test UI** once a real `/profile` edit page exists. The avatar upload currently lives in /settings as a test surface. The permanent home is a dedicated profile-edit page; strip the settings route once that lands.
- **Empty Hunting strip nudge** — new users with no starred cards see a blank strip with no call-to-action. Add a "Star cards you're chasing" prompt when `favourites.length === 0`.
- **DUPES vs DUPLICATES stat label** — the stats row on the dashboard shows "DUPES" (lime, taps to /duplicates). Kept as-is. Revisit the label only if users find it unclear.
- **Trade Binder feature (next session's headline work)** — Rename "Duplicates" to "Trade Binder" across the app and make it a publicly shareable artifact for viral acquisition. Multi-commit scope: (1) Public access: anonymous (non-logged-in) users can view `/duplicates/[handle]` — the marketing plan is "post your binder link on Discord/Reddit, viewer signs up to message." Requires RLS exception on collection_entries (read access for duplicate_count > 0 rows only, no auth required), plus making the duplicates page handle anonymous visitors gracefully (no trade-proposal buttons, no "your" actions, login prompt for interaction). (2) Rename "Duplicates" → "Trade Binder" across all UI text, page headers, tile labels. URL choice TBD (rename `/duplicates/[handle]` → `/binder/[handle]` with redirect, or keep URL and only rename UI). (3) Broader trade-binder semantics: today "duplicates" means `collection_entries WHERE duplicate_count > 0`. Trade Binder concept includes cards you have but aren't actively collecting (pulled but not your set focus). Requires either a new `tradeable` flag column on collection_entries, or a separate `trade_binder` table. Migration + UI to toggle tradeability per card. (4) Share UX: "Share my Trade Binder" button on /you, copyable URL, Open Graph metadata for Discord/Twitter previews. Make the Dupes tile on preview profiles tappable once (1) lands — currently rendered as a non-tappable `<div>` in preview mode because the page itself requires friendship. Privacy model going forward: stats public, trade binder public, full collection (sets/checked cards) stays friend-only. Be careful with RLS — anonymous access opens a real attack surface if mis-scoped.

**Pending minor items (no dedicated session needed — handle when adjacent work touches these files):**
- **Picking modal** is duplicated inline in `app/friend/[handle]/favourites/page.js` and `app/friend/[handle]/[setId]/page.js`. Standard pattern — extract to a shared component on the third use site only.
- **`marketplace_pool.printing_id` is TEXT, but most other printing references are UUID.** Inconsistency caught in session 19 during RPC iteration (commit d59cd33). All printing column types should be reviewed and aligned in a single migration. Workaround: when writing RPCs touching `marketplace_pool`, cast `printings.id::text` and use `text[]` parameters. Not blocking but bites future RPC authors.

**Done since last handover (30 May 2026, session 18):**

- **Collapsible Pending Sent + Friend Requests at top of /friends** (commit `8f090db`): The /friends page now shows two collapsible sections at the top — one for pending requests you've sent and one for incoming requests — instead of the previous flat list. Both sections are hidden when empty. Improves legibility when a user has multiple outstanding requests in either direction.

- **Friends search redesign + preview profile mode** (commits `05fda1c`, `d185df5`): Four-part feature. (1) New `GET /api/friends/search` endpoint: auth-gated, sanitises the `q` param, queries profiles via ILIKE, excludes self and blocked users, enriches each result with `friendship_status` (`friends | pending_received | not-friends`), omits `pending_sent` users from results entirely. (2) `/friends` search bar redesigned: debounced dropdown calls the new endpoint, each suggestion navigates to `/friend/[handle]`, "Search" button routes to `/friends/search?q=…`. (3) New `/friends/search` page: full-page results up to 50, Avatar + status badges, auto-runs on mount when `q` param is present, required Suspense boundary for `useSearchParams()`. (4) `/friend/[handle]` preview mode: removed the "not-friends" hard wall — non-friends now see a preview with real stats (via service-role `GET /api/profile/[handle]/public-stats`), locked Hunting strip placeholder showing count only, Add Friend CTA in the `afterStats` slot with optimistic `localPendingFromMe` state, mutual-friends count (no names, service-role computed). `ProfileView` extended with `isPreview`, `afterStats`, and `publicHuntingCount` props. Root cause of the prior 0/0/0 stats: Supabase RLS silently returns empty rows for non-friends; fixed by the service-role endpoint which returns aggregate counts only, never raw rows.

**Done since last handover (1 June 2026, session 19):**

- **Friend request flow polish** (commits `4aceec7` and `96ae29b`): Three related fixes. (1) Friend request notifications now deep-link to `/friend/[senderHandle]` instead of `/friends` — recipient lands on the requester's preview profile where they can see stats, mutual friends, and Accept/Decline inline. (2) Incoming friend request rows in `/friends` now wrap the requester's name in a `<Link>` to their preview profile. Accept/Decline icon buttons remain separately tappable. (3) Preview profile (`/friend/[handle]`) now detects `isPendingFromThem` — friendship row where viewer is `user_b` with `status === "pending"` — and shows Accept/Decline buttons in the `afterStats` slot instead of Add Friend CTA. Accept does `UPDATE friendships SET status='accepted'` then page reload; Decline does `DELETE` then routes to `/friends`. (4) Notifications page friend_request rows restructured into a tappable content area + Accept/Decline action row. Post-action shows `Accepted ✓` (lime) or `Declined` (dim) pill via local `resolvedRequests` state keyed by `notif.id`. (5) Preview-mode stats flicker fixed using PATTERN 1: stats row, mutual line, and `afterStats` slot all gated on `publicHuntingCount !== null` (the public-stats fetch having resolved). Ghost skeleton preserves layout height via `color: transparent` text — no layout shift when real numbers arrive.

- **Comprehensive notification gap closure** (commits `eab939f` and `40f82fb`): Five high/medium gaps identified via a full audit of notification surfaces and closed in one commit. Plus a follow-up that fixed visibility of viewer's own feed posts.

  Schema: added `notifications.metadata JSONB DEFAULT '{}'` for structured notification data (likers list, event references, future use cases).

  App-code notifications added:
  - Friend-request accepted: all 3 accept handlers (`/friends` list, `/friend/[handle]` preview, `/notifications` inline) now insert `friend_accepted` notification to original requester with `/friend/[acceptorHandle]` deep-link.
  - Trade declined: `/api/trade/[tradeId]/decline` inserts `trade_declined` notification to proposer.
  - Trade stage-2 mutual accept: `/api/trade/[tradeId]/accept` inserts `trade_accepted` notifications to both parties when both have completed verification.

  DB triggers (new):
  - `notify_feed_event_comment`: AFTER INSERT on `feed_event_comments`, inserts `feed_comment` notification to event owner with `/feed#event-[id]` deep-link. Self-comment skipped via guard.
  - `notify_feed_event_like`: AFTER INSERT on `feed_event_likes`, inserts or STACKS a `feed_like` notification. Stacking rule: if an unread `feed_like` notification for this event exists and is less than 7 days old, UPDATE its metadata to include the new liker and regenerate title/body ("alex and beth liked...", "alex, beth and 3 others liked..."). Otherwise INSERT new. Dedup guard prevents double-stacking on rapid taps. Self-like guard skips owner's own actions.

  UI: `/feed` reads `window.location.hash` on mount, smooth-scrolls to `#event-[uuid]` if present. Each `FeedEventCard` wrapper has `id="event-<uuid>"` for the target.

  Follow-up (`40f82fb`): `get_feed_events` RPC modified to include events where `actor_user_id = viewer` in addition to existing friend-author criteria. Previously the feed was friends-only, so notification deep-links to your OWN post landed on a /feed view that didn't contain that post (impossible to reply to a comment on your own feed). Now /feed is "your network and you." Self-like UX oddity (you can heart your own post) is a separate polish item; the trigger correctly skips self-actions so no notification spam.

- **Discover performance + variety overhaul** (commits `6dfcfff`, `ba2b4ed`, `6edee95`, `d59cd33`, `812f45b`): Five-commit arc addressing eBay marketplace tiles loading 1.5-4s slower than friend trade tiles, plus a fundamental variety pool problem that surfaced once the perf issue was resolved.

  Commit 1 (`6dfcfff`) — Render gate fix: removed `marketplaceSettled` from the page's "show grid" condition. Friend tiles previously held hostage by marketplace fetch — they now paint as soon as `cards` resolves (~300ms). Removed the 5s timeout fallback.

  Commit 2 (`ba2b4ed`) — Cache-only route: deleted `refreshStaleForUser` (~115 lines) which made live eBay Browse API calls inline with user requests. The `/api/marketplace/listings` route is now a pure cached DB read. GitHub Actions cron (every 10 min, 20 cards per batch, ~24h full cycle) remains the sole eBay refresh path. Trade-off: user requests are fast (~200-500ms) but listings can be up to 24h old. Acceptable for MVP given the variety wins.

  Commit 3 (`6edee95`) — Variety + dynamic count + pull-to-refresh: Three intertwined changes. New RPC `get_marketplace_variety_for_user(viewer, marketplace_id, exclude_printing_ids, limit)`. Returns missing-active-set cards with warmed pool entries. Route rewritten to support GET (initial load) AND POST (pull-to-refresh with excludeIds and tradeCount in body). Tile count formula: `max(8, round(36 - tradeCount * 1.5))` — 0 trades → 36 eBay tiles, 10 trades → 21, 20 trades → 8, always min 8. 20% favourite quota max, 80% variety. Client-side pull-to-refresh: container-level touch handlers (non-passive touchmove for `preventDefault`), lime spinner with rotation progress tracking pull distance, 80px threshold to trigger refresh. `seenPrintingIds` ref accumulates across refreshes (capped at 200). MSShell `<main>` got `data-scroll-container="true"` and `overscroll-behavior-y: contain` to suppress iOS native gesture conflict.

  Commit 4 (`d59cd33`) — Fix HTTP 300 from overload collision: see §17 lesson above. Iterating the RPC's signature from `uuid[]` to `text[]` left both overloads in place, causing silent empty responses.

  Commit 5 (`812f45b`) — Widen variety pool + parallelize: Initial variety pool was limited by an "active sets only" restriction, yielding 13 candidates for Alex of which 9 had fresh listings — pull-to-refresh exhausted on first pull. Diagnosis: Alex had 2,533 missing cards WITH fresh listings across all sets (vs 9 in active sets only). RPC rewritten to consider all missing cards, with `is_active_set` boolean as a sort key so active-set cards still appear first within the broader pool. Route's sequential DB queries (auth → favourites → price-filter → variety RPC → listings) parallelized via Promise.all on the favourites and variety flows. ~200-500ms saved.

  End state for Discover: ~24-30 eBay tiles on initial load (was 0-9 before), active-set cards prioritized at top, broader variety fills rest. Pull-to-refresh draws new cards from a pool of 2,533 rather than exhausting after one pull. Initial load is significantly faster.

**Done since last handover (30 May 2026, session 17):**

- **Set logos in tile top-left** (commit `facacce`): MarketplaceTile and FriendDupeTile now render the set logo image (sets.logo_url) in the top-left corner with a translucent pill background, replacing the prior bottom-middle set name text on FriendDupeTile (MarketplaceTile had no set identity before). eBay logo remains top-right on marketplace tiles. Data layer updated: `lib/marketplace/listings-for-user.js` now fetches `set_id` from printings and joins to `sets(id, name, logo_url)` to enrich listings; `lib/queries/discover.js` now includes `logo_url` in the sets JOIN and maps it to `setLogoUrl` in the result shape. Falls back to set name text when sets.logo_url is null. Improves set identity at a glance against varied card art backgrounds.

- **Navigation polish across /you, /friends, /settings** (commit `3f1dd9e`): Five small fixes from real PWA usage. (1) `/you` friends card is now fully tappable — wrapped the whole block in `<Link href="/friends">`, removed nested `<Link>` elements that were causing invalid HTML. (2) `/friends` back button now returns to `/you` instead of `/`. (3) `/settings` now has a back button (was missing entirely) using the existing BackButton component with `href="/you"`. (4) Bottom nav `MSTabBar` now correctly highlights "You" on `/settings` instead of "Sets" — root cause was a prefix collision in `deriveTab()` where `pathname.startsWith("/set")` matched both `/sets` and `/settings`. Fixed by tightening to `/sets` and `/set/` prefixes only. Resolves one of the three known highlight issues from §18. (5) Issue flagged for product: there are two settings entry points on `/you` (header gear icon + Settings row in account menu). Confirmed intentional — mirrors iOS pattern (quick-tap header affordance + contextual menu item). No code change.

- **Marketplace listings PART 3** (commit `a6b5c5e`): Discover redesign + eBay feed integration. Nine files. End-user result: Discover is now a single flat scrolling grid of friend-dupe tiles and eBay buy-it-now tiles, interleaved via a round-robin-by-printing shuffle (commit `86b3621`) so every unique card is shown before any repeats — no same-card clustering at the top of the feed, with single-tap actions per tile type. `components/marketplace/MarketplaceTile.jsx` — card-art tile (`cards.image_large`, never seller photo), official eBay wordmark badge top-right (`public/marketplace/ebay-logo.png`, R5+B1 from eBay's creative pack), soft blue glow shadow, price overlay, 2.5/3.5 aspect. `components/marketplace/MarketplaceDetailOverlay.jsx` — slide-up detail panel (mirrors duplicates filter panel: `createPortal`, double-rAF, Escape, body overflow lock, 260ms close), shows seller's listing photo (the one card-art-only exception), condition, seller + feedback %, price, affiliate disclosure (canonical copy from FindOnline: "Master Setter may earn a commission from purchases made through this link. This does not affect the price you pay."), "View on eBay" with `rel="noopener noreferrer sponsored"`. `components/marketplace/FriendDupeTile.jsx` — parallel tile with lime-green ArrowLeftRight trade badge; no price (Discover is acquisition intent, not price discovery); set name only in bottom overlay; 2.5/3.5 aspect (uplifts the legacy 2/3). `components/marketplace/FriendDupeActionSheet.jsx` — slide-up action sheet with handle-specific labels: "Trade with @handle", "Message @handle", "View @handle's profile"; trade URL built from duplicates page source of truth. `lib/marketplace/currency-to-marketplace.js` — client-side `getUserMarketplaceId()` reads `localStorage["po:currency"]` and maps to eBay marketplaceId (AUD→EBAY_AU etc.), mirrors `lib/ebay.js` convention. `lib/marketplace/listings-for-user.js` — variety selection (up to 3 per printing, prefer different sellers then price-varied) + two-query printings→cards JOIN for card art + name. `app/api/marketplace/listings/route.js` — auth-gated GET, reads `?marketplaceId=` param (default EBAY_AU), calls `refreshStaleForUser` + `getListingsForUser`, returns enriched listing array. `app/discover/page.js` — heavy redesign: removed @handle section headers, multi-select, sticky action bar, MSShell hideTabBar, filter dropdowns, currency state, RATES, filtered useMemo, allSets. Added marketplace parallel fetch, merged+shuffled useMemo, two overlays. 200 lines → 120. **Two breaking UX changes:** (1) Discover multi-select removed — multi-card trade construction lives on `/duplicates/[handle]`; (2) Discover filters (set, min-value) removed — the page is a pure scrolling feed; filtering available on `/duplicates/[handle]` where the filter panel still exists. **eBay logo:** `public/marketplace/ebay-logo.png` — original filename `R5+B1_ebay_logo_rgb.png` renamed to avoid `+` characters breaking URL encoding. EPN not yet enrolled; `listing_url` is bare `itemWebUrl` and will auto-upgrade to `itemAffiliateWebUrl` once `EBAY_EPN_CAMPAIGN_ID` is set (no code change needed).

**Done since last handover (30 May 2026, session 16):**

- **Marketplace listings PART 2.1** (commit `373e319`): Data model + title-matching + refresh pipeline. Migration `20260529000000_create_marketplace_listings.sql` — table with PK `(source, source_listing_id)`, indexes on `(printing_id, fetched_at DESC)` and `(set_id, card_number, fetched_at DESC)`, RLS SELECT policy for authenticated users (service-role writes bypass RLS). `lib/marketplace/match.js` — `matchListing(title, candidatePrintings)`: Rule 1 card-name substring, Rule 2 slash-pattern `\b(\d+)\s*/\s*(\d+)\b` vs `(card_number, set_total)`, Rule 3 grading-service denylist `PSA|BGS|CGC|TAG|BCCG|SGC|ACE|HGA|ISA|PCG`, Rule 4 non-card denylist (poster, pin, playmat, etc.). `lib/marketplace/refresh.js` — `refreshListingsForPrinting(printingId, marketplaceId)`: two-query approach (printings, then sets) to avoid PostgREST FK-ambiguity; belt-and-braces condition check drops listings where `condition.toLowerCase() === "graded"`; upsert on `(source, source_listing_id)`; stale delete pass removes rows not in the latest fetch. Smoke-tested on real eBay AU data: 26/50 matched, graded listings caught and dropped at both the title-matcher and condition-filter layers.

- **Marketplace listings PART 2.2** (commit `066406b`): Cache check + per-user refresh-stale + new-user random fill. `lib/supabase/service.js` — `getServiceClient()` shared service-role client (avoids re-instantiating on every call). `lib/marketplace/fetch.js` — `getFreshListingsForPrintings(printingIds, { marketplaceId, maxAgeMinutes=480 })` pure cache read, returns `{ fresh, stalePrintingIds }`; `refreshStaleForUser(userId, { ..., minPriceUsd=5, randomFillCount=20, randomFillMinUsd=10, randomFillMaxUsd=100 })` favourites path (SELECT from favourites LIMIT 6, price-filter at `price_usd >= $5`, mode `"favourites"`) + random-fill path for new users (SELECT 200 master-tier printings `price_usd BETWEEN $10 AND $100`, JS-shuffle, take first 20, mode `"random"`); throttled Promise pool at `maxConcurrent=3`; returns `{ mode, targetPrintingIds, refreshed, skipped, errors }`. `lib/ebay/browse.js` default limit raised 50 → 200. `lib/marketplace/refresh.js` updated to import from shared `getServiceClient`. Verified schema before building: `marketplace_listings` rows confirmed in DB, `printings.price_usd` and `printings.collection_tier` confirmed present, `favourites.printing_id` confirmed correct.

**Done since last handover (29 May 2026, session 15):**

- **eBay production keyset approved** via eBay's exemption path (no eBay user data persisted — app only reads public listing data). Cert ID / Dev ID swap in the env file corrected. Production Browse API confirmed working end-to-end.

- **Marketplace listings PART 1** (commit `01f1c06`): eBay API client foundation. `lib/ebay/auth.js` — Client Credentials OAuth, module-scope token cache, 105-min refresh. `lib/ebay/browse.js` — `searchBuyItNow({ query, marketplaceId, limit })`, filters to `FIXED_PRICE`, passes `X-EBAY-C-ENDUSERCTX` for EPN when `EBAY_EPN_CAMPAIGN_ID` is set, returns normalised source-agnostic shape (`sourceListingId`, `title`, `price`, `imageUrl`, `listingUrl`, `seller`, `condition`), `listingUrl` is `itemAffiliateWebUrl ?? itemWebUrl`. `app/api/marketplace/search/route.js` — auth-gated GET handler, 400/401/502 handling. Smoke-tested through the auth-gated route: real eBay AU listings returned, prices in AUD, correct normalised shape. EPN not yet enrolled — `listingUrl` is bare `itemWebUrl` as expected.

**Done since last handover (28 May 2026, session 14):**

- **eBay domestic filter** (commit `78c83ae`): Added `&LH_PrefLoc=1` to the eBay search URL so Find Online results are restricted to listings located in the user's market, not just ones that ship there. Works across all 5 markets because `lib/ebay.js` already swaps the domain per locale — one-line fix at the URL construction site.

- **Avatar upload system** (commits `6f89e01`, `98f7467`): End-to-end profile pictures. Migration added `profiles.avatar_url` + a public-read `avatars` Storage bucket with 4 RLS policies scoping writes to the owner's folder (`{user_id}/avatar.webp` via `storage.foldername`). `lib/avatar.js` does client-side processing: `createImageBitmap` → center-crop square → `canvas` 400×400 → WebP 0.85 → upload (upsert) → cache-busted public URL → persist. Upload UI first landed on /settings as a test surface; now also on /you via the dashboard redesign. Read-surface pass then wired `avatar_url` through every render site: `get_feed_events` (had been returning `NULL::text` since the column didn't exist at M3 time), `FeedEventCard` comment authors, /friends search, /messages inbox + thread. Friend pages already worked via `select("*")`. HEIC on iPhone confirmed working (Safari decodes natively).

- **Duplicates storefront** (commits `0de383c`, `3228951`, `7e19085`, `c2d7d80`): New `/duplicates/[handle]` page — a user's spare cards (`duplicate_count > 0`, master-tier) as a trade shop window. `SECURITY DEFINER get_user_duplicates(target_user, viewer)` returns the target's dupes enriched with `hunted_by_viewer` (does the viewer favourite this printing). Privacy: non-friends hard-blocked before any fetch. One flat route serves both own view and friend view. Three device-found fixes followed the initial ship: card images use `cards.image_large` not the always-NULL `printings.image_url`; the `--border-radius-md`/`--border-radius-lg` CSS tokens were ghost variables (defined in briefs but not in `globals.css` — silently resolved to 0); card aspect ratio corrected to `2.5/3.5`.

- **Profile dashboard** (commits `86a5a28` Stage 1, `bb49561` Stage 2): `/you` went from a settings menu to a collector dashboard via a new shared `ProfileView` component (`components/profile/ProfileView.jsx`) with `footer` and `headerAction` slots. Stage 1 (`86a5a28`) introduced the component and its use on both `/you` and `/friend/[handle]`; Stage 2 (`bb49561`) wired `/you`'s specific slots (gear icon link to `/settings`, friends face-pile, account menu with Sign out). Stage 2 was authored same-day as Stage 1 but missed the commit pass — recovered from the working tree on 29 May 2026 with no logic changes. Both views: own view has gear icon + friends face-pile + account menu; friend view has ⋯ overflow with Report/Block + speech-bubble message icon, mutual friends, inline set list. Hero = the Hunting strip (favourited cards as card images, price-sorted). Stats row: Sets / Cards / DUPES (lime, → `/duplicates/[handle]`). Friend page rewrite preserved the `is_blocked` safety gate, Report/Block modals, and the paginated set-list pipeline verbatim. `/friends` gained a per-row speech-bubble icon linking to `/messages/[handle]`.

- **Duplicates select-to-trade** (commit `e5ddd7e`): The storefront became interactive — tap cards to multi-select (green outline border), a fixed bottom bar ("N selected → Propose Trade", with `MSShell hideTabBar` so it isn't obscured by the tab bar) builds the same `?with=&requests=` param shape that Discover uses. Verified against `/trade/new`'s `requests` parser — identical encoding (`encodeURIComponent(JSON.stringify([{printingId, cardName, setName, setId, imageUrl, priceUsd}]))`). Hunting/favourited cards get a soft gold glow (distinct from green selection outline). The large Propose Trade + Message buttons were removed from the profile hero in favour of the top-right speech-bubble + ⋯ overflow pattern.

- **Navigable duplicates** (commit `c974c0a`): Set logo badge per tile (from `set_logo_url` now returned by `get_user_duplicates`); sort pills (Price ↓/↑ toggle, Name, Rarity — rarity via `lib/rarity.js`, extracted from the set page so both share one ranking); set filter chips (shown only when dupes span 2+ sets); eyebrow+title header (`MSPageTitle sub={@handle}` for friend view). Sort and filter compose in a single `useMemo`; selection survives both (keyed by `printing_id`, filtering is a view not a deselect). `rarityBucket` + `BUCKET_ORDER` extracted to `lib/rarity.js` as single source of truth — set page updated to import from there, no divergent copies.

- **Advanced duplicates sort + filter** (commit `f27cd0c`): Replaced the sort pills + set chips with a Sort dropdown (Price ↓/↑, Name A–Z/Z–A; rarity moved out of sort) and a slide-in faceted Filter panel (right side, `createPortal`, `translateX` slide, mirrors `OverflowMenu` portal/backdrop/ESC structure). Three collapsible multi-select sections — Set, Rarity, Price (buckets `$0–1` through `$150+` via `priceBucketOf`, `[min,max)` rule). Faceted dynamic narrowing: each section's options are computed from the dupes filtered by the OTHER two sections only, so multi-select within a section keeps siblings visible while sections still narrow each other. Zero-result options disappear. Rarity options ordered via `lib/rarity.js`; price in bucket order. Filter (N) active badge, "Showing N of M" subtitle, "No cards match" empty state with clear affordance, "Show N results" / "Clear all" in panel footer. Filter composes with sort; selection-for-trade reads the raw `duplicates` array so it survives filtering. Tested against seeded @admin data (30 dupes, 5 sets, 9 rarities, all 6 price buckets).

**Done since last handover (27 May 2026, session 13):**

- **Refresh-prices helper text** (commit `7e990bc`): Pre-flight "Takes up to ~20 seconds per set." line under the Refresh Prices button on the home page. Shipped before the deeper navigation-survival issue was understood; kept because it still adds value as first-tap context. See §17 Gotchas for the lesson about misreading a brief.

- **Refresh-prices state survives navigation (A1)** (commit `d74c802`): `RefreshPricesProvider` Context lifts refresh state out of HomePage to `app/layout.js`. Slim global indicator bar in MSShell shows progress / completion / errors / hard-reload-recovery from any route during refresh. Tappable to return home. `sessionStorage`-backed recovery state for 30s after hard reload mid-refresh. Existing rich home-page progress UI preserved unchanged. +391 / -99 lines across 4 files. Deferred: A2 (PWA close / app switch mid-refresh — would need a Supabase-backed `refresh_jobs` table).

- **Sentry follow-up from session 12 closed:** Homepage perf win confirmed in Sentry (p95 7.3s → 2.66s, ~64% improvement). `/friends` p95 inconclusive due to single-session sample; revisit when beta traffic accumulates. Zero new errors post-deploy. Cron monitor `trade-handover-prompts` healthy. Two stale Sentry example-page issues remain unresolved in the dashboard (boilerplate from initial wiring, not real errors) — manual resolve when convenient.

- **17a audit:** Discovered the session 9 "proposer-offered-skip" feature is separate from 17a's mutual-consent design. 17a is NOT closed; all 5 sub-decisions remain unresolved. Deferred post-beta; the asymmetry of session 9 may turn out to be a feature (forces explicit suggestion, dampens social-pressure drift). Revisit if beta testers report friction.

- **M3 design locked:** Full v1 design captured in §19 Milestone 3. Three jobs only: notify, prompt duplicates, celebrate milestones. No mini-screen (handover option D rejected for v1). `set_started` at 10%, milestone suppression during 30-min bulk-add window, 5-min settle on `set_completed`. CTA on Feed `set_started` cards routes viewer to their own `/set/[id]` if they collect the same set.

- **M3 events layer SHIPPED** (commit `28d5faf`): Full pipeline working in production. See §19 Milestone 3 for status detail. PART 4 (Feed UI render) deferred to next session.

- **2 HANDOVER.md commits during session** (commit `eb08048` for 17a + M3 design lock, plus this commit for the session 13 retrospective).

- **First HANDOVER.md retrospective commit** (commit `a496802`): Captured M3 events + A1 + 17a audit + 8 §17 lessons. First doc commit of the session.

- **M3 PART 4 Feed UI SHIPPED** (commit `1d4032f`): Feed page replaces coming-soon placeholder. Renders friend `set_started` events with Variant B card layout. Two new tables (feed_event_likes, feed_event_comments) with composite-key likes and uuid+soft-delete comments. `get_feed_events` SECURITY DEFINER function aggregates counts server-side. Optimistic likes with rollback. Inline-expand comments with real-time updates. Conditional lime CTA "Own duplicates for this set? Let people know" routes to viewer's own set page.

- **Three fixes from device test** (commit `79538f0`): Card body now taps to friend's profile (the card is about that friend); CTA-only routes to viewer's own set. CTA copy updated to "Own duplicates for this set? Let people know" — tells the user why they're being routed. BackButton added to `/friend/[handle]` profile page (was the only friend page without one — sessions 11/12 polished set-detail and favourites but missed profile).

- **BackButton on set page** (commit `e0d38d6`): Set page was reachable from Feed CTA, home page, /sets, friend's set list — none provided a back affordance. Inlined as first child of the set hero row, mirrors the friend-page pattern. router.back() handles all entry paths correctly.

- **Second HANDOVER.md retrospective commit** (this commit): Captured M3 PART 4 + back-button work + 3 more §17 lessons.

**Done since last handover (26 May 2026, session 12):** UI polish (BackButton extraction), serial waterfall perf fixes, and messages inbox correctness fix shipped.

- **BackButton component extracted** (commit `4b2cf2e`): Shared `components/BackButton.jsx` replaces all inline ArrowLeft back buttons. `href` prop → renders `<Link>`; no href → `router.back()`. Hover state via Tailwind `hover:text-[var(--po-green)]`. Refactored callers: `messages/[handle]`, `trade/new`, `friends` pages. `trade/new` uses a `<div style={{ marginBottom: 8 }}>` wrapper to preserve the pre-existing gap before the heading.
- **Friend set-detail + favourites identity row polish** (commits `5288d67`, `00aeb22`): Removed tappable chevron-right identity rows on both pages. BackButton inlined as first child inside the flex identity row (same horizontal axis as Avatar + name/handle). No more stacked layout.
- **Homepage serial waterfall perf fix** (commit `6934068`): Collapsed 5 serial barriers to 3. Old: auth → profile → [user_sets + entries] → [sets + counts] → prefs. New: auth → [profile + user_sets + entries + prefs] → [sets + counts]. Profile and prefs now fetch in parallel with the data they were gating.
- **Friends page serial waterfall perf fix** (commit `38423af`): Collapsed 3 serial barriers to 2. Profile fetch now runs in `Promise.all` alongside `loadFriendships(user.id)`. `setAuthChecked(true)` called after the batch resolves.
- **Messages inbox 1000-row data loss fix** (commits `56d1649` + `8759861`): The unbounded `messages` query + client-side `threadMap` loop was silently truncated at 1000 rows — old conversations could disappear from the inbox. Fixed via new `get_inbox_threads(viewer uuid)` SECURITY DEFINER RPC (migration `20260526214808`): uses `DISTINCT ON (LEAST/GREATEST peer pair)` + unread CTE, returns one row per conversation. Client replaced with `supabase.rpc("get_inbox_threads", { viewer: userId })`. `threadMap` loop deleted. Field names updated throughout JSX (`unread_count`, `latest_sender_id`, `latest_body`, `latest_created_at`, `peer_id`).
- **Friend set-detail collection_entries pagination** (commit `d0e7a91`): The entries query for a friend's set had no `.range()`, risking silent 1000-row truncation on large sets. Extracted `fetchFriendEntries(supabase, friendId, sid)` as a module-level async function using the canonical PAGE=1000 loop with `.range(from, from + PAGE - 1)`. Slot in `Promise.all` unchanged; destructuring updated from `{ data: entriesData }` to plain `entriesData` (helper returns raw array).

**Done since last handover (25 May 2026, session 11):** Friend-view polish + favourites feature shipped end-to-end. Verified on device.

- **Friend set-detail hero polish** (commit `3496418`): Removed redundant text-rendered set name from the hero (set name already in MSPageTitle). Added tappable affordance to identity row: `ChevronRight`, `flex-1` on text div, `rounded-xl p-2 -mx-2 hover:bg-[var(--po-bg-soft)] active:bg-[var(--po-border)] transition-colors`.
- **Avatar on friend profile page header** (commit `34d4de9`): Added shared `Avatar` component (size=56) to the friend profile page identity section between the page title and the set list. `Avatar` component location: `components/Avatar.jsx`. Props: `profile`, `size` (default 40), `themePrimary` (default `#b9ff3c`). Renders `<img>` if `profile.avatar_url`, else letter-placeholder div. No `themePrimary` passed on the profile page — profiles table has no `theme_primary` column (that's sets only). **Future-proof identity slot:** when avatar upload work lands, `Avatar` will render the real image automatically — no consumer-side changes needed. The `<img>` branch is already wired; only `profiles.avatar_url` needs to be populated.
- **`get_friend_favourites` SECURITY DEFINER function** (commit `3746dff`, migration `20260524220000_add_get_friend_favourites_function.sql`): Viewer≠target → block check both directions on `user_blocks` → friendship check (accepted, either ordering) → `SELECT printing_id, created_at FROM favourites WHERE user_id = target`. SECURITY DEFINER pattern used because favourites has a single `*` RLS policy on `auth.uid() = user_id` — modifying it would widen INSERT/DELETE too. Same pattern as `is_blocked` / `get_block_peer_ids`. Verified: self-access, friend-access, non-friend empty, blocked empty.
- **Favourites page at `/friend/[handle]/favourites`** (commit `aa05bde`): Auth → profile fetch → `is_blocked` check → friendship check → `get_friend_favourites` RPC → `selectMasterPrintings().in("id", printingIds)` (order preserved from RPC result). Loading / not-found / not-friends states match other friend pages. 2-col grid of card art, display-only `★` on each card (top:5 right:6 `#FFB830`), number badge. Card tap → picking modal with Propose Trade + Message Directly (no printing-selection step — each favourite IS already a specific printing). Empty state: "They haven't favourited any cards yet."
- **Star indicators on friend set cards + Favourites entry on profile** (commit `0269cb4`): In `app/friend/[handle]/[setId]/page.js`: `friendFavourites` state (Set<string>), `get_friend_favourites` RPC added as 5th call in `Promise.all`, `isCardFavourited` computed in `renderCard`, `<Link href=".../favourites" onClick={stopPropagation}>★</Link>` rendered as absolute overlay. In `app/friend/[handle]/page.js`: `ChevronRight` added to lucide import, Favourites tappable row (★ + label + ChevronRight) inserted between identity section and set list with `borderBottom` separator.
- **Star position fix** (commit `7bf59ba`): Moved star from `top:5 right:6` to `top:5 left:6` after code audit confirmed collision with the partial-collected N/M badge (`absolute top-1 right-1`) and the completion checkmark circle (`absolute top-1 right-1 w-7 h-7`). Top-left corner is empty in all three completion states. Verified on device: no collision.
- **Missing-tab printing-level filter fix** (commit `a309e6b`): Friend set-detail Missing tab was using `isCardOwned` (card-level: any printing owned → excluded) instead of a printing-level check. Cards with some-but-not-all printings owned were wrongly excluded. Discovered during PART 8 device verification on Raff's collection: 403/406 printings showing "They've got everything." Fix mirrors personal view's `missingFilter`: `checkedCount < totalPrints`. See §17 for full lesson.

**Loose threads (acceptable, not blocking):** Picking modal duplicated across `/friend/[handle]/favourites` and `/friend/[handle]/[setId]/page.js` — extract if a third site needs it. `get_friend_favourites` fetched on every friend set-detail load — acceptable N+1 cost at current scale.

**Done since last handover (24 May 2026, session 10):** Pricing pipeline fully resolved (item 12 Problem 1 + item 40). me4 ingested. Feed Milestone 1 shipped end-to-end.

- **me4 (Chaos Rising) ingested** (commit `1d004ea`): 122 cards, 198 printings, themes extracted, `ME_SETS` updated. PokeScope returns 404 for all me4 cards as of 24 May — pricing blocked on upstream indexing (Problem 4, item 12). Re-trigger in a few days.
- **PokeScope promo bleed-through fix** (commits `e87a957`, `f305475`): `tryPokeScope` now detects the "Multiple variants available" block and parses label+price pairs via whitelist, silently skipping stamp promos (Gamestop Stamp, Eb Games Stamp). Single-variant cards hit unchanged else-branch. Secondary fix: variant block window expanded from 1500 → `VARIANT_BLOCK_WINDOW = 3000` after the Holofoil div (4th of 4, offset ~1360) was cut off 1 byte short of its closing `</p>`. Final verified state: me3-50-holofoil $216.08 → $0.56, me3-50-reverse_holofoil $1.00 (unchanged), me3-121/124 holofoil untouched.
- **Staleness gate fix** (commit `bd0be5a`, item 40): `prices_updated_at` now only advances when `updates.length > 0`. Zero-write and failed runs leave the timestamp unchanged so the user can retry immediately. Verified: me4 (zero writes) left timestamp NULL across two consecutive triggers; me3 (real writes) advanced correctly and blocked the immediate second trigger.
- **Feed Milestone 1 — event capture infrastructure** (8 commits, all verified on device):
  - `10fd806` — `feed_events` table, indexes, RLS + friends-only SELECT policy
  - `19d853e` — `user_interactions` table, index, RLS + own-only SELECT policy
  - `613d941` — `set_started` trigger (`trg_feed_set_started` AFTER INSERT ON `user_sets`)
  - `a574792` — `card_favourited` trigger (`trg_feed_card_favourited` AFTER INSERT ON `favourites`, resolves `card_id`/`set_id` from `printings`)
  - `29f83a4` — `friend_added` trigger (`trg_feed_friend_added` AFTER UPDATE ON `friendships` WHEN pending→accepted, inserts 2 rows — one per user)
  - `e250cac` — `set_completed` trigger (`trg_feed_set_completed` AFTER INSERT ON `master_completions`; upsert re-assertions take UPDATE path, trigger does not re-fire — verified)
  - `6b1791e` — `set_milestone` API route (`/api/feed/record-milestone` POST) + fire-and-forget fetch call in `togglePrinting` tick handler after `collection_entries` upsert, tick-only (not untick). Route computes ownership pct server-side from master printings, checks thresholds 50/75/90, idempotency via `feed_events` lookup, inserts via service role client. Returns `{ thresholds_fired, pct }`.
  - `88c66b9` — Race condition fix: partial unique index `feed_events_milestone_unique_idx ON feed_events (actor_user_id, related_set_id, (metadata->>'threshold')) WHERE event_type = 'set_milestone'`; route handles `23505` as silent no-op. Race observed in production (4 parallel ticks, 2 rows 18ms apart). All 5 event types verified on device: each count = 1, idempotency confirmed.
- **All triggers use `SECURITY DEFINER SET search_path = public`** — bypass RLS for `feed_events` INSERT while preventing search-path injection. Established as the convention for all Feed triggers.
- **Commits:** `1d004ea`, `e87a957`, `f305475`, `3c9cfb6`, `a21baa3`, `bd0be5a`, `10fd806`, `19d853e`, `613d941`, `a574792`, `29f83a4`, `e250cac`, `6b1791e`, `88c66b9`.

**Done since last handover (23–24 May 2026, session 9):** Skip-verification trades + post-trade confirmation flow shipped end-to-end.

- **DB migration** (`20260522150000_add_skip_verification_to_trades.sql`): 4 new columns on `trades` (`proposer_offered_skip`, `verification_skipped`, `physical_handover_confirmed_at`, `physical_handover_auto_completed`); CHECK constraint updated with `agreed_pending_handover` and `physically_completed`.
- **Route handlers** (PART 3): `propose/route.js` passes `proposer_offered_skip`; `accept/route.js` handles `no_verification` path (pending → agreed_pending_handover) and `with_verification` path (unchanged); `verify-photo/route.js` guards against verification_skipped trades; new `confirm-handover/route.js` for `completed`/`did_not_happen` confirmation.
- **Proposer UI** (PART 4, `app/trade/new/page.js`): skip-verification toggle with helper text; button label updates dynamically.
- **Acceptor UI** (PART 5a, `components/TradePanel.jsx`): 3-button UI when proposer offered skip (accept-no-verify / accept-with-verify / decline) with trust disclaimer; `handleAccept` now passes `acceptanceMode`; new `handleConfirmHandover`; `agreed_pending_handover` branch with confirm-handover Yes/No UI; `physically_completed` and `cancelled` terminal branches.
- **Card attribution clarity** (PART 5a amend, `app/messages/[handle]/page.js`): "Offer"/"Want" labels replaced with viewer-perspective "You offer"/"They offer" using `isMine`.
- **Real-time trade updates** (PART 5c): `trades`, `trade_verifications`, `trade_events` added to `supabase_realtime` publication via migration `20260523000000_add_trade_tables_to_realtime_publication.sql`. Root cause was missing publication membership — subscription code was already correct. Updates now fire within ~1s across devices.
- **Discover trade-awareness** (PART 5b, `lib/queries/discover.js`): `fetchInFlightKeys()` excludes a proposer's offered cards from Discover results while the trade is active (`pending`/`verification_required`/`agreed_pending_handover`). Keyed per `(friendUserId, printingId)` so the same printing available from a different friend still surfaces. Bug fix in same session: initial implementation incorrectly hid recipient's cards too — fixed to only exclude `side="offer"` items keyed on `proposer_id`.
- **Vercel cron** (PART 6): `vercel.json` created; `app/api/cron/trade-handover-prompts/route.js` — daily at 08:00 UTC, day-7/14 prompt notifications, day-21 auto-complete. Service-role client, fail-closed auth, per-trade error isolation, record-then-mutate idempotency order.
- **proxy.js**: `/api/cron/trade-handover-prompts` added to PUBLIC_PATHS.
- **Deferred items captured**: item 41 (apparent card movement observation — re-verify before acting); item 42 (trade-aware duplicate inventory — decrement `duplicate_count` on proposal, deferred until trade volume warrants).
- **Commits:** `87b1077`, `1fab379`, `667976e`, `8bcdec9`, `7a18110`, `f56e2fe`, `7c66c60`.

*Cross-reference: item 41 (loose thread — apparent ownership transfer, re-verify before acting on it). Item 42 (deferred — proper `duplicate_count` decrement on trade proposal to close concurrency window).*

**Done since last handover (22 May 2026, session 8):** sv8pt5 pattern pricing
verified clean (PPT 100/67 product counts match DB row counts exactly; all
rows priced). Full SV-era pattern landscape audited: sv9 (Journey Together)
confirmed zero patterns on PPT; sv10 (Destined Rivals) confirmed zero patterns
(PokeCottage + PPT probe — 0 of 256 products). Diagnosed why sv10 refresh
returned 0 prices: PPT setId 24269 is correct for Destined Rivals but the set
genuinely has no pattern products. Traced phantom row origin to untracked
direct dashboard SQL. Deleted 286 phantom `printings` rows + 2
`collection_entries` via migration `20260522130000`. Removed sv10 from
`PPT_PATTERN_SET_IDS` (set to null with "Do not re-add" comment). zsv10pt5
re-refresh complete: 72/82 pokeball + 72/74 masterball. Remaining 10 null-priced
rows are `_pb`-suffix IDs from pre-release ingestion — 7 real PPT products
silently skipped due to ID mismatch, zero collection ticks, accepted as known
limitation (item 36d). rsv10pt5 fully priced. Pattern variant pricing (item 12,
Problem 2) fully resolved. Two new discipline rules added to §17 (pattern
variant confirmation gate; migrations-only rule). me2pt5 ball type audit
deferred (item 41). Commits: `4215be5`.

**Done since last handover (22 May 2026, session 7):** User reports feature
(item 5) shipped end-to-end. `user_reports` table + RLS + CHECK constraints
applied (migration `20260522000000_create_user_reports_table.sql`).
`OverflowMenu` bottom-action-sheet primitive built (`components/OverflowMenu.jsx`)
and mounted on friend profile + message thread. `ReportUserForm` built
(`components/ReportUserForm.jsx`) — reason radio rows, details textarea,
submit gating, toast on success, inline error on failure. Verified on device:
both surfaces correct, RLS blocks reported user's SELECT, no notification sent.
Commits: `930935e`, `245ccb5`, `223e156`. Admin queue for `user_reports` deferred
(item 7). Block-prompt follow-up captured as loose thread 39.

**Previously done (22 May 2026, session 6):** Card error reporting
feature completed end-to-end. `card_reports` table, RLS, FAB, and bottom-sheet
form shipped (commits `a5e9318`, `c74eee5`). Email notification pipeline via
Supabase webhook → Vercel route → Resend verified on device (commits `e1538c1`,
`7dfb9f1`, `f41b163`). Set name resolution added (commit `a73ee67`). Admin queue
for `card_reports` remains deferred (item 38).

**Previously done (21 May 2026, session 5):** Data correctness sprint (see
section 3a) — Victini rarity fixes, Archen rarity fix, PRE80 Dudunsparce
subtypes + Master Ball insert, Black Bolt Master Ball coverage audit,
Common/Uncommon phantom holofoil cleanup (22 rows deleted, 8 kept as legitimate
det1, 1 resolved via rarity fix), ID/number mismatch audit (1 isolated artefact
deferred). Pattern variant pricing for sv8pt5 + sv10 shipped (commit `924738e`);
zsv10pt5 + rsv10pt5 pending PPT limit reset (PPT free-tier exhausted — retry
after 00:00 UTC).

Item 12 now has three distinct sub-problems. Problem 2 (pattern variants) is 50%
shipped. Problems 1 and 3 are diagnosed and decided, not yet implemented. The
phantom-row audit across all five categories is fully closed. All privacy/accuracy
must-do items except item 3 (Sentry) are closed.

The legal docs are *live*. The auth surface is *working*. Discover is *live and
real-time*. From here: complete pattern variant pricing (PPT probe after UTC reset),
wire Sentry, add trust-and-safety (items 5-7), address remaining price pipeline
problems, then UI polish and deferred features.

---

## 19. FEED ROADMAP

**Status as of 22 May 2026:** Feed page exists as a coming-soon surface at
`/feed` (commit `64d4fe1`). 5-cell tab bar live. No data layer, no events, no
real feed content. Coming-soon page renders the Claude design mockup.

**Strategic intent:** The Feed is the bridge from "collection tracker" to
"social trading platform." Its killer mechanic is duplicate-aware activity —
when a friend starts a set, the feed surfaces "you have N duplicates that
could help them." This drives the trading economy the app is built around.

### Scope decisions locked

Do not revisit without explicit re-discussion.

1. **Feed is NOT the default home tab at launch.** Promote only after weeks
   of real usage proves value AND empty state is excellent. Existing users
   have Sets muscle memory; brand new users would see an empty Feed.
2. **Friends-only feed scope at launch.** No public feed, no proximity scope.
   Privacy default is conservative.
3. **Block prompt UI (item 39) ships with the Block brief, not with any Feed
   milestone.** Decoupled.
4. **No ML personalisation. Rules-based ranking only.** Heuristic ranking
   captures 80% of the benefit at 5% of the work at current scale.
5. **AI/LLMs are for content (descriptions, summaries, trade suggestions),
   not ranking.** Ranking stays transparent and debuggable.

### Milestone sequence

Nine milestones, roughly one Claude Code session each. Audit-first / stop-gate
discipline applies to every brief (§17 rules). Listed in suggested execution
order (not milestone number order).

**Execution order — optimised for value delivery:**

| # | Milestone | Status | Why this order |
|---|---|---|---|
| 1 | Event capture infrastructure | ✅ DONE 24 May 2026 | Foundation; can't backfill |
| 6 | Privacy controls | **← NEXT** | Ship before broadcast goes live |
| 2 | Basic feed + heuristic ranking | Not started | Highest visible value |
| 3 | Duplicate-match decoration | Not started | The killer mechanic |
| 4 | Real-time updates | Not started | Makes the feed feel alive |
| 5 | Activity batching | Not started | Matters once usage grows |
| 7 | More event types | Not started | Iterate on real data |
| 8 | Promote to default tab | Not started | Only after value is proven |
| 9 | Push notifications | Not started | Late-stage, own complexity |

**Total estimate:** 8–12 Claude Code sessions, 4–8 weeks of part-time solo dev.

---

#### Milestone 1 — Event capture infrastructure *(data foundation)* — ✅ DONE 24 May 2026

**Commits:** `10fd806` (feed_events table), `19d853e` (user_interactions table),
`613d941` (set_started trigger), `a574792` (card_favourited trigger),
`29f83a4` (friend_added trigger), `e250cac` (set_completed trigger),
`6b1791e` (set_milestone API route + tick handler), `88c66b9` (race fix + partial unique index).

All 5 event types verified on device. See session 10 log in §18 for full detail.

**Key learning:** Trigger-based capture is the right pattern for client-side
Supabase operations. The one exception (`set_milestone`) needed an API route
because threshold detection requires server-side computation. The race condition
on the API-route path is solved via a partial UNIQUE INDEX + 23505 handling (see
§17). Established patterns apply to all future Feed event types.

**Goal:** Every meaningful user action writes a row to a new `feed_events`
table. No UI changes. Invisible plumbing.

**Why first:** Events are cheap to add now, expensive to backfill. Start
logging before displaying.

**New tables:**

`feed_events`
- `id` uuid pk
- `actor_user_id` uuid → profiles
- `event_type` text enum (see below)
- `related_set_id` text nullable
- `related_card_id` text nullable
- `related_user_id` uuid nullable → profiles
- `metadata` jsonb (per-event-type extras)
- `created_at` timestamptz default now()
- Indexes: `actor_user_id`, `created_at desc`, `(actor_user_id, created_at desc)`

`user_interactions` *(sibling — added in same milestone)*
- Captures behavioural signals for Layer 2 ranking later (can't be backfilled)
- `id`, `user_id`, `target_type` (profile/set/card), `target_id`,
  `interaction_type` (view/message/etc), `created_at`

**Initial event types:** `set_started`, `set_completed`, `set_milestone`
(50/75/90% in metadata), `card_favourited`, `friend_added`

**RLS:**
- Insert: service role only (events written server-side)
- Select: own events OR events where actor is an accepted friend

**Insert hooks:**
- `user_sets` insert → `set_started`
- `user_sets` hits 100% → `set_completed`
- `user_sets` crosses 50/75/90% → `set_milestone`
- `favourites` insert → `card_favourited`
- `friendships` accepted → `friend_added` for both users

**Verification:** Use the app for a day; watch `feed_events` and
`user_interactions` populate in Table Editor.

**Session 13 update (27 May 2026):** The `set_started` Postgres trigger on `user_sets` INSERT has been DROPPED as part of M3. `set_started` now fires from the `/api/feed/record-milestone` API route at 10% completion (regular printings, GM excluded). The Milestone 1 trigger was the right pattern for that milestone's design, but the M3 redesign moves all set-progression event firing into a single route for consolidation. The four remaining Milestone 1 triggers (`set_completed`, `card_favourited`, `friend_added`, plus the `set_milestone` API route from session 10) are unchanged. The 7 existing dev `set_started` rows from the old trigger were wiped in migration `20260527000000` — safe pre-beta. See HANDOVER §17 Gotchas for the "positive-direction events use routes, negative-direction cleanup uses triggers" architectural principle.

---

#### Milestone 2 — Basic feed + heuristic ranking *(first real feed)*

**Goal:** Replace coming-soon content with a real, ranked feed.

**Scope:**
- Query: events where `actor_user_id IN (accepted friends)`, joined with
  profiles, scored, paginated (~20 per page, cursor-based)
- **Layer 1 heuristic ranking:**
  - Base: recency-weighted with exponential decay
  - +bonus if event involves a set you also collect
  - +bigger bonus if you have duplicates (foreshadows Milestone 3)
  - +bonus by event type (set_completed > set_started > card_favourited)
  - Ranking weights live as named constants — pure function, unit-testable
- Empty state: brand-aligned, "find friends" CTA + "add a set" CTA (most
  important screen for new users — do not phone this in)
- Loading, error + retry states
- Pagination: cursor-based

---

#### Milestone 3 — Set-progression Feed events with duplicate prompt *(v1 design locked 27 May 2026, session 13)*

**Status (27 May 2026, session 13):** Events layer + UI rendering both SHIPPED. Full M3 v1 design is live in production.

**Commits:**
- `28d5faf` — Events layer (set_started, set_milestone, set_completed with pg_cron settle)
- `1d4032f` — Feed page UI with engagement (likes, comments, CTA)
- `79538f0` — Fixes from device test (card body taps friend profile, CTA copy "Own duplicates for this set? Let people know", BackButton on friend profile page)
- `e0d38d6` — BackButton on set page

**Verified end-to-end in production:**
- `set_started` fires at 10%, milestone suppression in 30-min window, `set_completed` settles via pg_cron at next */5 boundary
- Feed page renders friend events with proper card layout (avatar, headline, time, set logo, CTA conditional on viewer collecting same set, like + comment buttons)
- Likes toggle with optimistic UI + real-time updates across sessions
- Comments inline-expand with real-time updates while user composes
- Back buttons present on `/feed → /friend/[handle]`, `/feed → /set/[id]` (via CTA), `/sets → /set/[id]`, `/friends → /friend/[handle]`, plus the existing `/friend/[handle]/[setId]` and `/friend/[handle]/favourites` from sessions 11/12

**Still deferred to future:**
- Real-world smoke testing on beta-tester traffic. Test data was injected via MCP for verification (raffertydall + alex friendship with a synthetic sv8pt5 set_started event). UI was device-verified using this test data but not exercised against multiple real users.
- iOS PWA keyboard behaviour with comment input — not tested. May need `scrollIntoView` on focus if keyboard covers input.
- M4 (Real-time feed updates beyond likes/comments — e.g. new event rows appearing live), M5 (Activity batching), M6+ per HANDOVER §19 roadmap.

**Architectural artifacts shipped:**
- 6 migrations: `20260527000000` (set_started/completed/milestone schema), `20260527000001` (untick cleanup trigger), `20260527000002` (pg_cron flush function + schedule), `20260527000003` (partial unique indexes for race protection), `20260527000004` (feed_event_likes + feed_event_comments + realtime publication), `20260527000005` (get_feed_events SECURITY DEFINER function).
- `lib/feed-progression.js` (computeOwnershipPct JS helper, parity-tied to SQL function).
- `lib/queries/feed.js` (fetchFeedEvents JS wrapper around RPC).
- `app/api/feed/record-milestone/route.js` (extended with set_started, set_completed_pending INSERT, bulk-add debounce).
- `app/feed/page.js` (replaced 286-line coming-soon placeholder with 101-line real Feed).
- `components/feed/FeedEventCard.jsx` (220-line component, all three engagement buttons + inline comment thread).
- `<BackButton />` added to `app/friend/[handle]/page.js` and `app/set/[setId]/page.js`.
- Existing `user_sets` INSERT trigger for `set_started` dropped. The Milestone 1 set_started capture mechanism obsoleted by the route.

**Known operational facts:**
- pg_cron job `flush_pending_completions`, schedule `*/5 * * * *`, runs against production every 5 minutes regardless of deploys.
- Worst-case settle delay observed in production: row crossed 35 seconds before a `*/5` boundary, skipped that cron, picked up by the next — total ~9.5 min user-perceptible delay.
- `feed_event_likes` and `feed_event_comments` are in the `supabase_realtime` publication (required for `useTableRefetch` subscriptions to fire).
- `get_feed_events` returns `actor_avatar_url` as `NULL::text` for all rows — `profiles.avatar_url` column doesn't exist yet; Avatar component falls back to letter-placeholder. When avatar uploads land in a future session, the function needs updating to return the real column.
- `friendships` table uses `user_a` / `user_b` columns (not requester/addressee). Confirmed via audit; query function adjusted accordingly.
- Decision: card body taps go to the friend's profile (about the friend); only the lime CTA button routes to the viewer's own set page (call to action).

**Why no mini-screen (handover option D) — STILL DEFERRED:** The original Milestone 3 brief considered a dedicated "help @friend" mini-screen. Rejected for v1 in favour of routing directly to the viewer's own set page via the CTA. If beta testers report friction with this pattern, the mini-screen returns as a v2 option.

**Guiding principle (Feed v1):** The Feed has three jobs — notify, prompt duplicates, celebrate milestones. Nothing else. This is the scope-defense test for any future Feed feature: if a proposal doesn't do one of those three, defer.

**Goal:** Real Feed events for set progression. Single CTA per event — viewers who collect the same set get a duplicate-logging prompt that routes to their own set page. No new screens.

**Event types:**

`set_started` — Fires at 10% completion of regular printings (Grand Master excluded — GM is a hidden tier and counting it would mean broadcasting against a denominator the user doesn't see). One-time per (user, set) — never re-fires. Triggered via the existing `/api/feed/record-milestone` route, not the `user_sets` INSERT trigger (which gets deleted).

`set_milestone` (50/75/90) — Fires on threshold crossing as today. New behaviour: suppressed for 30 minutes after `set_started` (bulk-add debounce window). During suppression, only the highest currently-crossed threshold fires when the window expires (single bracket-jump). Outside the window, fires immediately. No settle delay — milestones are "rough indicators" by design; a user at 73% who was briefly at 75% is reasonably described as "around 75%."

`set_completed` — Fires at 100% with a 5-minute settle delay. New `set_completed_pending` table holds the intent. On crossing 100%, INSERT a pending row. If the user drops below 100% before settle, DELETE the pending row. A cron running every 2 minutes flushes pending rows older than 5 min whose user is still at 100% to `feed_events`, then deletes the pending rows. Protects against "tick all → broadcast → untick three" without lying to friends.

**Feed CTA on `set_started`:**
- Default card text: "@handle started collecting [Set Name]"
- If the viewer has a `user_sets` row for the same set: additional CTA line "You're collecting [Set Name] — do you have duplicates to help?"
- Tap CTA: `router.push(`/set/${setId}`)` — viewer's own set page. They mark duplicates using existing UI.
- No mini-screen, no new components, no schema additions for the CTA itself.

**Why no mini-screen (handover option D):** Considered and rejected for v1. The Feed's job is to surface events and prompt action — a dedicated "help @friend" screen would be a feature surface, not a notification surface. The existing set page already supports duplicate-logging; routing there preserves the framing without duplicating UI. Mini-screen remains a post-MVP option if friction with the routed-to-set-page pattern is observed in beta.

**Why no settle on milestones:** Per locked decision — milestones are rough indicators. A user at 73% who was briefly at 75% is reasonably "around 75%." Settle infrastructure exists only for `set_completed` because completion is a hard binary claim that can be falsified by a single untick.

**Migrations needed:**
- Drop existing `user_sets` INSERT trigger that fires `set_started`
- Wipe existing dev test rows in `feed_events` WHERE `event_type = 'set_started'` (pre-beta, safe to clean)
- Create `set_completed_pending` table (`user_id`, `set_id`, `crossed_at` — composite primary key on user/set)
- Add `vercel.json` cron entry for `/api/cron/flush-pending-completions` (runs every 2 min)
- Update `proxy.js` `PUBLIC_PATHS` to include the new cron route

**Implementation notes:**
- Folding `set_started` into the milestone API route consolidates progression logic in one place. The route already computes ownership % for milestones; adding the 10% case is mechanical.
- The 30-minute bulk-add window is anchored to the actor's most recent `set_started` event for the set — query `feed_events` for `actor_user_id = me AND event_type = 'set_started' AND related_set_id = X` and check `created_at`.
- The cron pattern follows the session 9 `trade-handover-prompts` precedent: service-role client, fail-closed auth check, per-record error isolation, idempotency via the pending-row-deletion (no double-fires possible because the pending row IS the work item).

**Deferred (not v1):**
- Mini-screen for "help @friend" duplicate-logging interaction
- Settle delay on `set_milestone` events
- Bulk-import mode toggle (e.g. "I'm logging existing inventory")
- Account-age quiet periods for new users
- Special metadata flagging bulk-completed sets

---

#### Milestone 4 — Real-time feed updates

**Goal:** New events appear without manual refresh.

**Scope:**
- Supabase realtime subscription on `feed_events` filtered to friends
- Pattern: same as MSTabBar unread-badge subscription (§1)
- New events insert at top with subtle lime-dot "new" treatment
- "N new" indicator if user is scrolled down

---

#### Milestone 5 — Activity batching

**Goal:** Friend adds 47 cards → one summary card, not 47 events.

**Scope:**
- Events of same type + same actor + same target within 1-hour window collapse
- Probably client-side (post-query) for v1
- Summary cards: "Sarah added 47 cards to Black Bolt"; tap to expand

---

#### Milestone 6 — Privacy controls *(ship before broadcast goes live)*

**Goal:** Settings toggles for per-event-type broadcast opt-out.

**Pre-milestone decision needed:**
Default state per type — current push:
- `set_started`, `set_completed`, `set_milestone` → default ON (low intimacy)
- `card_favourited`, `friend_added` → default ON but easy to toggle off
Confirm before writing the brief.

**Scope:**
- New `user_feed_preferences` table (or extend existing prefs table)
- "Feed visibility" section in `/settings`
- Hard rule: `feed_events` insert checks actor's preferences first — if
  broadcast is off for that event type, skip the insert entirely

---

#### Milestone 7 — More event types *(post-launch, iterate on data)*

**Candidates after seeing real usage:**
- Social-proof aggregates: "3 of your friends are collecting Destined Rivals"
- Trade events: "Alex traded Mega Starmie ex with Sarah" (privacy question)
- App announcements (admin-authored)
- Wants-list events (if wants list ships)
- Collection anniversaries

Half a session per type. Don't plan specifics until you have engagement data.

---

#### Milestone 8 — Promote Feed to default home tab

**Pre-conditions:**
- Empty state excellent
- Real users have used Feed for weeks
- Data shows Feed is delivering value

**Strategy:** New users get Feed by default; existing users opt in via
settings. Confirm A/B approach vs hard switch closer to the time.

Trivial engineering, significant UX decision. Don't rush.

---

#### Milestone 9 — Push notifications *(late-stage)*

"Sarah started Black Bolt and you have 12 duplicates" as a push notification.

Own complexity — Web Push API, per-category opt-in, mute controls, quiet
hours, iOS PWA push restrictions. Budget 2–3 sessions.

---

### AI/LLM integration (separate from ranking, post-launch experiments)

ML personalisation is out of scope (decision 4 above). LLMs add value here
without needing user-base scale:

1. **Smart card descriptions.** One-liner per card featured in the feed.
   Cache per `card_id`.
2. **Trade suggestion copy.** LLM-generated duplicate-match CTA text for
   personality. Cache after first render.
3. **Friend recommendations.** Set-overlap-based "you might know" for new
   users with no friends.

Post-launch experiments. No Feed milestone depends on them.

---

### Rules for every Feed milestone brief

1. Audit-first — Part 1 audit before any code changes (§17).
2. Stop-gates between parts — no chaining migration → code → device-test.
3. Tracked migrations only — no direct dashboard SQL (§17).
4. Privacy checks first — check actor preferences before inserting to
   `feed_events`. Default opt-in for low-risk types only after Milestone 6.
5. RLS confidentiality — `feed_events` select must be scoped to own events
   + accepted friends only.

### Open questions (resolve before their respective briefs)

- **M3:** CTA target — confirm B (pre-filled message) or choose A/C/D.
- **M6:** Default state per event type — confirm push above or revise.
- **M8:** Default-tab promotion strategy — A/B by cohort, hard switch, or
  per-user toggle.
