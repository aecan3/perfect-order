# Master Setter — Todo List

_Last updated: 14 May 2026_

Master Setter is a Pokémon TCG master-set collection tracker with social trading
features. Next.js (App Router), Tailwind v4, Supabase, deployed on Vercel. PWA,
primarily used on iPhone. See the master handover note for full architecture.

---

## Recently shipped (14 May 2026)

- Favourites empty-state copy rewritten
- Favourites page redesigned — 3x2 grid, cap raised 5 to 6, unified bottom sheet
  with actions
- Printings query layer centralised in `lib/queries/printings.js` (master vs all)
- `master_printing_counts()` RPC deployed — fixed the 1000-row pagination cap on
  per-set counts
- Grand Master tier hidden from all counts, values, and feeds (visible only in
  its own set-page section)
- FK hint disambiguation on favourites joins
- Domain `mastersettertcg.com` secured
- Navigation chrome — designed in Claude Create, built and wired across every
  page (bottom tab bar, minimal header, MSShell). Stages 1-3 complete.
- New `/you`, `/notifications`, `/settings` pages
- Bell button wired to `/notifications`
- Duplicate-orphan bug — untick handler now deletes the row, confirm dialog when
  duplicates exist, existing orphan cleaned up
- Variant chips replaced with dot-fill system; consolidated the two bottom sheets
  (`pickingCard` + `dupSheetCard`) into one
- Discover scroller vs detail view inconsistency — fixed (was PostgREST 1000-row
  truncation), added truncation warning tripwires
- `friendships` resolution extracted to shared `lib/queries/friends.js`
  `getFriendIds()`
- Service worker `chrome-extension` scheme-error fix

---

## Bugs to fix

- **White Flare BWR card #174 (Reshiram ex)** — confirm if in DB, add if missing
  via Limitless scraper (`node scripts/patch-limitless.mjs rsv10pt5 WHT 174 174`).
- **Find Online search query** — Kieran 174/131 Black Bolt was searching
  incorrectly. Fix: pass exact collector number string from card object, do not
  reconstruct from separate fields.
- **`/manifest.json` returning 401 on Vercel** — it's Vercel project-level
  Deployment Protection, not a code bug. Resolves on its own once the custom
  domain is connected to production. No action needed before then.

---

## Design & UX

- **Build real `/settings` page** — currently a stub. Should cover: currency
  picker (relocate out of page bodies where it currently lives), country/suburb,
  profile editing (handle, avatar, mailing address), notification preferences,
  location data preferences, account deletion.
- **Audit existing `/friends` page** — it's a full page, not a stub. Confirm it
  covers friends list, pending requests, send-request flow, search, unfriend.
  Fill any gaps.
- **Real-time subscriptions on `/notifications`** — currently fetch-on-mount
  only. Add Supabase realtime so the bell badge and the page update without a
  navigation.
- **Notifications polish** — filter/sort, mark individual as unread,
  swipe-to-dismiss.
- **Discover selection bar** — confirmed working with the hide-tab-bar approach;
  revisit only if it feels off on real use.

---

## Testing checklist (before major releases)

- Landing page — centring, tagline, CTA buttons on real iPhone
- Sign in / forgot password — end to end on real device
- Price refresh — time a full refresh, confirm all sets resolve
- Discover — both buttons appear on card selection (Propose Trade, Message
  Directly)
- Propose Trade from Discover — params carry through to `trade/new`
- Propose Trade from friend set page — legacy single param still works
- Messenger — card preview renders for multi-card trade proposals
- Trade proposal — full happy path on two real devices simultaneously
- Camera — `getUserMedia` on iPhone Safari and Android Chrome, no file upload
  bypass
- Realtime state sync — both parties see state changes without refresh
- Address reveal — does not re-expose on page refresh
- Liability checkbox — server-side guard holds, cannot be bypassed via direct
  API call
- Trade expiry — set `expires_at` to past, confirm 410 response
- Admin event log — 401 unauthenticated, 403 non-admin, correct for admin
- Notifications — friend request, trade proposal, trade accepted all firing
- Dual print detection — card with normal + holofoil shows correctly in Discover
- Favourites — 6-card limit enforced server-side, gold star, auto-remove on
  collect
- Achievement celebration — master (lime) and grand master (amber) both trigger
  and dismiss, set logo appears
- Find Online — portal modal, only on missing/unowned, eBay URL correct with
  campaign ID
- `npm run build` clean, no warnings
- Smoke test on production Vercel URL
- Full chrome on real iPhone — safe areas, blur, tab persistence, portals above
  chrome

---

## Data

- **Grand Master sourcing project** — audit every set against the master/GM line
  (Master = numbered set + in-pack variants RH/PB/MB + secret rares + numbered
  BWR; GM = everything outside packs: sealed-product promos, stamps, parallels).
  Source images and prices for GM sections. White Flare GM section currently has
  no images. Sets needing attention: Prismatic Evolutions, Ascended Heroes,
  Perfect Order, Crown Zenith, White Flare, Black Bolt.
- Re-run PB/MB inserts for Prismatic Evolutions when pokemontcg.io adds remaining
  cards (community reports 181 vs 180). Use `ON CONFLICT DO NOTHING`.
- Monthly data completeness check — DB card count vs community totals per set.

---

## Scaling / query-safety

From the truncation findings on 14 May. None urgent — all safe at current scale
— but capture before the app grows. The PostgREST implicit 1000-row cap
truncates silently with no error.

- `messages/page.js ~L48` — profile fetch via `.in()` unbounded; breaks at 1000+
  message partners
- `friends/page.js ~L41` — friend profile fetch via `.in()` unbounded; breaks at
  1000+ friends
- `favourites/page.js ~L57` — `.in()` on favourited printings; effectively a
  non-issue (capped at 6) but noted
- When any of these matter, use the existing `fetchInBatches()` helper from
  `trade/new/page.js`

---

## Revenue & monetisation

- eBay affiliate live — monitor Partner Network dashboard for first conversions
- Contact Fetch TCG (fetchTCG.com.au) about affiliate/partnership
- Revisit TCGPlayer affiliate when they restore Australian shipping
- Revisit US expansion (eBay.com + TCGPlayer) when user base warrants it

---

## Growth & features

- **Instagram-style Browse feed on Discover** — infinite scroll of duplicate
  cards across friend network. Sort: favourited first, then missing from active
  sets, then nearby, then everything else.
- **Broader network matching engine** — surface wanted/available cards beyond
  direct friend network within proximity.
- Profile stat: "X Grand Master completions"
- Leaderboard: most Grand Master completions across network
- Push notifications when a friend gets a duplicate of one of your favourited
  cards
- Push notifications via PWA notification API

---

## Observability & admin

- Structured JSON logging on price refresh pipeline (per-set and per-refresh
  summary events)
- Set up Axiom via Vercel marketplace for persistent log storage
- Admin dashboard: sets returning `priceSource=none`, refresh durations, error
  rates, per-user refresh activity
- Alert when a set consistently fails across multiple users

---

## App store distribution

- Apple App Store — wrap PWA, prepare listing, screenshots, privacy policy,
  submit
- Google Play Store — TWA wrapper, prepare listing and assets
- Generate app icons at all required sizes (1024x1024 source, 180x180
  apple-touch-icon)
- Decide on wrapper approach — Capacitor vs TWA vs straight PWA

---

## Domain & email

- DONE — Secured `mastersettertcg.com`
- Link domain to Vercel (deferred)
- Set up professional email — `hello@mastersettertcg.com`
- Configure DNS, MX records, SPF/DKIM/DMARC
- Update PWA manifest, meta tags, hardcoded URLs to new domain
- Set up transactional email via Resend or Postmark

---

## Legal & onboarding

- Draft Terms of Service — platform-only disclaimer, trade liability, AI
  verification limitations, data usage, no responsibility for card authenticity,
  location data policy
- ToS acceptance checkbox on sign up
- Location permission explanation screens before OS prompt

---

## Storage

- Verification photos auto-delete on trade resolution — monitor as user base
  grows
- Weekly cleanup function for verification folders older than 30 days where
  trade is resolved

---

## Cleanup

- Update project `README.md` — currently still the default `create-next-app`
  boilerplate
- Move `design_handoff_navigation_chrome/` out of the project root into
  `docs/design/`
- Grep for hardcoded `rgba(244,244,246,0.08)` etc. — replace with the
  `--ms-rule` token for consistency
