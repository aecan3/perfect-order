# Master Setter — Handover Note

*Updated end of session, 19 May 2026. Single source of truth for the next session.*
*Supersedes the previous handover note from 16 May.*

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

1. **Strip EXIF metadata on all photo uploads.** Privacy Policy 2.6 claims
   this. Likely NOT happening currently. A photo taken at home contains GPS
   coordinates of the home — a real leak. Process every uploaded image to
   strip EXIF, GPS, and camera info before storing to Supabase.

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

5. **Build "Report user" feature.** Accessible from another user's profile
   AND from a message thread. Reason dropdown (harassment, scam/fraud, fake
   cards, inappropriate content, other) + optional details field. Stores
   into a `user_reports` table (needs creating: reporter_id,
   reported_user_id, reason, details, created_at, status).

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

### Legal / UI compliance

9. **Affiliate disclosure visible near eBay links.** Small "Affiliate link —
   Master Setter may earn a small commission" text near actual eBay buttons,
   not just in the ToS.

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

12. **Inflated set values across the app — price ingestion bug (DIAGNOSED
    16 May 2026, not fixed).** Originally logged as "Perfect Order showing
    close to A$1000, suspected too high." The original three hypotheses
    (GM filter, duplicate multi-counting, unticked summing) were all
    **wrong**. Real bug, diagnosed via SQL + external price-source check:

    **The price-refresh job is writing wrong prices to `printings.price_usd`.**
    Specifically, when a card has a high-value promo variant alongside
    regular pack-pulled printings, the promo's price is being written to
    the regular Holo and Reverse Holo printings.

    **Worked example — Gengar #50 (`me3-50`), Perfect Order:**
    - `me3-50-holofoil` price in DB: **$220.73 USD** (updated 16 May)
    - `me3-50-reverse_holofoil` price in DB: **$187.62 USD** (updated 16 May)
    - Actual market price (per packmagik/PriceCharting, May 2026):
      regular Holo and Reverse Holo are ~$2–3 USD each
    - The GameStop/EB Games Exclusive promo variant of Gengar #50 is the
      $270 USD card — that's a separate printing not currently in our DB.
    - The promo's price is being mapped onto the regular printings.

    **Magnitude:** Removing just the Gengar over-pricing from @alex's
    Perfect Order total drops it from US$570 (~A$878) to ~US$162 (~A$250) —
    matches the user's gut-check estimate of A$200. So the bug is almost
    entirely concentrated in a small number of mis-priced "chase" cards
    per set, not a broad scaling error.

    **Scope:** Likely app-wide. Any set with a promo variant of a card
    (GameStop exclusives, EB Games exclusives, Build & Battle promos,
    pre-release promos, etc.) is at risk. Note the related observation
    under item 24: Prismatic Evolutions has been flagged at 181 vs 180
    community-reported cards — same likely cause (promo printings
    missing from our `printings` table, prices bleeding into existing
    rows). Worth investigating these together.

    **Next-session investigation plan:**
    1. Find the price-refresh code. Likely a scheduled job, a script in
       `scripts/`, or an API route. Source is `pokemontcg.io`.
    2. Inspect the raw pokemontcg.io API response for `me3-50` (or
       whatever their ID format is). The API returns a `tcgplayer.prices`
       object with sub-keys (`holofoil`, `reverseHolofoil`, `normal`,
       and likely variant entries for promos). Determine whether the
       ingestion is picking the wrong sub-key, taking a max across all
       variants, or matching by card-id rather than by printing-specific
       key.
    3. **Schema decision:** should promo variants get their own
       `printings` row (e.g. `me3-50-promo-gamestop`)? Currently they
       don't, and the price is leaking. If yes, the migration is small
       but the ingestion logic needs to know how to create new rows from
       API responses, not just update existing ones.
    4. Once fixed, re-run the price refresh against ALL sets to correct
       existing wrong prices. This is a data backfill, not just a code
       fix.

    **What this bug is NOT:**
    - Not a calculator bug. The set-value math is faithfully summing
      whatever prices it's given.
    - Not a GM-tier filter bug. Perfect Order has zero GM-tier printings
      (every printing in the set has `collection_tier = 'master'`).
    - Not a duplicate-counting bug. Query confirmed zero hidden duplicate
      rows for @alex's Perfect Order entries.
    - Not a currency bug. Conversion rate is plausible (~0.65 AUD/USD).

    **Related minor finding worth capturing:** `collection_entries.duplicate_count`
    is almost entirely unused (3 across 193 rows for @alex's Perfect Order).
    Vestigial column, like `mailing_address` was. Worth a future audit
    pass — either start populating it via the UI or drop it. Not urgent.

    **SQL diagnostic queries used to find this** are captured in this
    session's chat — re-run them on other affected sets to confirm scope
    before fixing.

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

## 4. LOOSE THREADS FROM EARLIER WORK

14. **Location explainer is currently triggered only from `TradePanel`
    ("Card Shop Nearby").** It should fire whenever ANY location-using
    feature is first hit. Refactor into a reusable `requestLocation()`
    hook/helper that any feature (Discover proximity matching, Find Online
    geo-filtering, etc.) can call. The component exists; just needs to
    become the standard entry point. AI reviewers flagged this kind of
    just-in-time consent is privacy-best-practice.

15. ~~**Password minimum length consistency.**~~ **DONE 17 May 2026 (commit `15a12f9`).** Bumped to 8 in both signup (`app/login/page.js`) and reset-password (`app/reset-password/page.js`). Supabase Auth dashboard also set to 8 (manual config). Both layers enforce.

16. **The 800ms timer in `/auth/confirm`.** Tested and works, but never
    explicitly confirmed it's a cosmetic post-success delay and not a race
    against verifyOtp/getSession. Thirty-second check next time you're in
    that file, given our project history with 800ms timers.

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

28. **Update project `README.md`** — still default create-next-app
    boilerplate.

29. **Move `design_handoff_navigation_chrome/` to `docs/design/`.**

30. **Grep hardcoded `rgba(244,244,246,0.08)` etc → replace with
    `--ms-rule` token.**

31. **Service worker offline fallback cleanup.** The SW's navigate fallback
    serving cached `/` masked routing bugs repeatedly in this project. It
    should serve a proper offline page / real 404 instead. Genuine footgun.

32. ~~**`/manifest.json` 401 on Vercel**~~ **DONE 17 May 2026 (no commit — verification only).** Returns 200 with `application/json` content type to anonymous curl against `mastersettertcg.com`. Resolved when custom domain went live.

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

---

## 18. RECOMMENDED NEXT-SESSION ORDER

When picking this back up, suggested sequence:

1. **Strip EXIF metadata on photo uploads (item 1).** Privacy Policy 2.6
   claims this — it's currently not happening. GPS coordinates of a user's
   home are a real leak. Highest-priority privacy item remaining.
2. **Wire Sentry (item 3).** Quick install, gets real error visibility,
   makes the policy true.
3. **The trust & safety block — Report / Block / Admin queue (items 5-7).**
   Required before opening to strangers. Build data model first (`user_reports`,
   `user_blocks`), then UI, then admin queue.
4. **UI polish items** — affiliate disclosure (item 9), suggested-match
   language (item 10), address-reveal nudge (item 8). Quick wins.
5. **Price ingestion bug (item 12).** Promo-variant prices bleeding into
   regular printings inflating set values significantly. Diagnose the
   ingestion code before fixing.
6. Then deferred items — 2FA, help system, browse feed, etc.

**Done since last handover (19 May 2026):** items 11, 13 (Discover stale),
13e (thread scroll), plus drag-to-reorder sets (new feature). Item 12 (price
ingestion) is the only active bug remaining.

The legal docs are *live*. The auth surface is *working*. Discover is *live
and real-time*. From here: close the privacy doc / code gap (items 1, 3),
add trust-and-safety (items 5-7), fix the price ingestion bug (item 12), then
polish and deferred features.
