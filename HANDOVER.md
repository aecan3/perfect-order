# Master Setter — Handover Note

*Updated end of session, 22 May 2026 (session 7). Single source of truth for the next session.*
*Supersedes the previous handover note from session 6.*

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
  `/favicon.ico`. Plus prefix checks for `/icons/` and `/brand/`.
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

3. **Wire up Sentry error reporting.** Privacy Policy 2.8b discloses Sentry.
   Install `@sentry/nextjs`, configure with a Sentry project DSN as env var,
   confirm errors flow to a dashboard. Note region (US or EU) — the policy
   says either.

4. ~~**Verify Vercel Analytics is correctly configured.**~~ **DONE 17 May 2026 (commit `9d3b8a2`).** `@vercel/analytics` v2.0.1 installed and `<Analytics />` mounted in root layout. Page-view collection only — no Speed Insights.
   **Follow-up:** Verify page-view events appearing in Vercel dashboard within ~24h of deploy.

### Trust & safety (required because messaging is on at launch)

5. ~~**Build "Report user" feature.**~~ **DONE 22 May 2026 (commits `930935e`, `245ccb5`, `223e156`).** `user_reports` table created with 10 columns, 4 indexes, 2 CHECK constraints (`no_self_report`, `details_required_when_other`), RLS insert + select-own policies. `OverflowMenu` component (`components/OverflowMenu.jsx`) — iOS-style bottom action sheet (portal, ESC, focus trap, return-focus-to-trigger). Takes `targetHandle` + `items` array; built for extensibility when Block adds a second row. `ReportUserForm` component (`components/ReportUserForm.jsx`) — portal bottom sheet matching `ReportCardForm` gold standard (ESC, focus trap, form reset, aria-modal). Reason as tappable radio rows; details always visible with dynamic optional/required label; submit gated on reason + details-when-other. On success: self-contained toast "Thanks — we'll review this report." On error: sheet stays open, inline message. Mounted on `app/friend/[handle]/page.js` (context='profile', hidden on own profile via `currentUserId !== friend.id`) and `app/messages/[handle]/page.js` (context='thread'). **This is the T&S data-corrections funnel — entirely separate from `card_reports` (data corrections).** Verified: row insertion correct on both surfaces, RLS blocks reported user from seeing the row, no notification sent to reported user. Admin queue (item 7) is unbuilt — separate future session.
   **Follow-up (loose thread 39):** When Block ships (item 6), the report form success state should upgrade from a toast to an inline "Would you like to block @{handle} as well?" prompt with [Block] and [Not now] buttons. UI flow decided 22 May 2026 but deliberately deferred so the Report brief ships clean.

6. **Build "Block user" feature.** Same surfaces as Report. Effects: blocker
   and blocked can't see each other in Discover; blocker doesn't receive
   messages from blocked; existing threads hidden; can't initiate new
   trades. Needs `user_blocks` table.

7. **Admin moderation queue.** Admin-only view of the `user_reports` table
   with action buttons (warn, suspend, terminate, dismiss). Doesn't need
   to be fancy — a table view is enough for launch.

8. **Address-reveal nudge in messages.** When a user types something that
   looks like a mailing address into a message thread, show a one-time
   inline reminder ("only share your address with someone you trust... etc").
   Optional polish but explicitly flagged by AI reviewers.

### Pricing infrastructure (required before soft launch)

10a. **Upgrade PPT API plan to $9.99/mo (20,000 credits/day).** Free tier
    (100 credits/day) will be exhausted immediately under multi-user load.
    Worst-case pattern-variant pricing costs ~24 PPT credits per full 4-set
    refresh cycle — fine for single-user dev, catastrophic at launch.
    Account: PokemonPriceTracker.com → Settings → Plans / Billing.
    **Do this before soft launch — soft launch is not single-user.**

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

    **Problem 1 — ME-set promo bleed (Gengar me3-50 example)**
    PokeScope scrapes one HTML market price per card and applies a 0.85×
    reverse-holo multiplier with no cross-check against any second source.
    The $221 Gengar price on the regular holofoil is PokeScope reading the
    GameStop/EB Games promo's market value rather than the pack-pulled card.
    Magnitude: removing just the Gengar mis-pricing drops Perfect Order from
    US$570 (~A$878) to ~US$162 (~A$250).
    *Fix decided:* Use ptcgio as a secondary verification pass for ME sets;
    log and skip prices that diverge >20% from ptcgio's value. ~1–2 hours.
    **Not yet implemented.** Defer to next pricing session.

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
    of whether ptcgio succeeded. sv8pt5 (PPT setId 23821) and sv10 (PPT setId
    24269) are wired. zsv10pt5 and rsv10pt5 have `null` placeholders pending
    a PPT probe.
    **Pending — PPT free-tier daily limit resets at 00:00 UTC. Run these
    probes next time at the computer:**
    ```powershell
    $key = "pokeprice_free_084011e9d0f4f2a5eb86b0b27cb5d33adcc42e680af21da0"
    # zsv10pt5 (Black Bolt) — TCGPlayer product 642450
    $r = Invoke-RestMethod -Uri "https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=642450" `
         -Headers @{ Authorization = "Bearer $key"; Accept = "application/json" }
    Write-Host "zsv10pt5 setId: $($r.data.setId)"
    Start-Sleep -Seconds 3
    # rsv10pt5 (White Flare) — TCGPlayer product 642118
    $r = Invoke-RestMethod -Uri "https://www.pokemonpricetracker.com/api/v2/cards?tcgPlayerId=642118" `
         -Headers @{ Authorization = "Bearer $key"; Accept = "application/json" }
    Write-Host "rsv10pt5 setId: $($r.data.setId)"
    ```
    Hardcode both values in `PPT_PATTERN_SET_IDS` (lines 28–29 of
    `app/api/refresh-prices/route.js`), commit, push, trigger one refresh per
    set, verify pattern rows populate. me2pt5 is untouched — still PokeScope.

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

39. **Block prompt after report submit.** When item 6 (Block user) ships, the `ReportUserForm` success state should change from a plain toast to an inline "Would you like to block @{handle} as well?" prompt with [Block] and [Not now] buttons. The toast-only path ships now so Report is clean and self-contained. The inline prompt is the right final UX but depends on Block existing first. UI flow decided 22 May 2026. File to modify: `components/ReportUserForm.jsx` — the `handleSubmit` success branch.

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
    building.** Idea raised 16 May: let both parties in a trade agree to
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

22. **Push notifications** — friend gets a duplicate of your favourited
    card; PWA notification API.

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

### Gotchas — 30-second fixes that took 20 minutes to find

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

- **Pattern variant inclusion rule (sv8pt5 / sv10 / zsv10pt5 / rsv10pt5):**
  Pokéball = non-ex Pokémon (C/U/R) + Trainers (C/U). Master Ball = non-ex Pokémon
  (C/U/R) only. Trainers do NOT get Master Ball variants. Confirmed against Cardrake
  community consensus and verified via Black Bolt coverage audit.

- **me2pt5 (Ascended Heroes) uses a different pokeball pricing path.** PokeScope's
  `default` case prices `pokeball_reverse_holofoil` as `marketPrice` directly (no
  multiplier). 140/140 priced ($0.18–$3.50 range). No Master Ball variants exist in
  me2pt5. ME-set logic must NOT be touched by future pricing fixes — `tryPptPatterns`
  already guards this with `!ME_SETS.has(setId)`.

---

## 18. RECOMMENDED NEXT-SESSION ORDER

When picking this back up, suggested sequence:

1. **Complete pattern variant pricing (item 12, Problem 2).**
   PPT free-tier daily limit resets at 00:00 UTC. Run the two setId probes
   (PowerShell commands in item 12), hardcode `zsv10pt5` and `rsv10pt5` values
   in `PPT_PATTERN_SET_IDS` (lines 28–29 of `app/api/refresh-prices/route.js`),
   commit, push, and trigger one refresh per set to verify pokeball/masterball
   rows get prices. This is a 15-minute task once the limit resets — do it
   before anything else. (sv8pt5 and sv10 are already wired and shipping.)

2. **Wire Sentry (item 3).** Last open privacy-doc / code gap. Gets error
   visibility in place before adding new T&S surface area — the ordering is
   deliberate. **Do this first at the start of a full session:** create the Sentry
   account/project and grab the DSN before opening Claude Code. That's
   account-creation work, not coding. Once you have the DSN, Claude Code can
   do the install-and-wire-up in one focused pass.

3. **The trust & safety block — Block + Admin queue (items 6-7).**
   Report (item 5) is now done. Block and Admin queue are required before
   opening to strangers. Budget a full session per piece. Block first
   (`user_blocks` table, effects on Discover/messages/trades), then Admin
   queue. When Block ships, also update `ReportUserForm` success state to
   show the block prompt (loose thread 39).

4. **PPT API plan upgrade (item 10a) — already captured as a launch blocker
   in §2. Repeated here for sequencing only.**

5. **Price pipeline — Problem 1 (ME-set cross-check) and Problem 3 (E-Card
   auto-detect).** Both ~1–2 hours. Problem 1: ptcgio secondary verification for
   ME sets, log and skip prices diverging >20%. Problem 3: auto-detect rule for
   sets with zero non-holofoil printings → use `normal` key for holofoil rows.
   See item 12 for decision details.

6. **UI polish items** — suggested-match language (item 10), address-reveal
   nudge (item 8). Quick wins.

7. Then deferred items — 2FA, help system, browse feed, etc.

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
