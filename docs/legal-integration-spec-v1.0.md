# Master Setter — Legal Integration Spec v1.0
*The Terms of Service and Privacy Policy v1.0 are ready to ship. This document tells you what to swap in, what to build before launch, and what's still open.*

---

## PART A — What to do right now

1. **Paste `terms-of-service-v1.0.md` into `content/legal/terms.js`** as the source of truth, replacing the placeholder.
2. **Paste `privacy-policy-v1.0.md` into `content/legal/privacy.js`** as the source of truth, replacing the placeholder.
3. **Insert the publication date** wherever the documents say `[INSERT DATE WHEN PUBLISHED]` — the date you ship.
4. **Insert the governing-law State/Territory** in Section 17.1 of the Terms (the `[REVIEW: ...]` placeholder). Use the state where A E Cann Pty Ltd is registered or principally operates.
5. **Confirm `lib/legalVersions.js` shows `1.0`** for both `TOS_VERSION` and `PRIVACY_VERSION`. If yes, no change needed.
6. **Verify `/terms` and `/privacy` are still in `PUBLIC_PATHS` in `proxy.js`** — they were added; just confirm they survived any recent changes.
7. **Test the user journey end-to-end:**
   - Logged-out access to `/terms` and `/privacy` works
   - Signup checkbox blocks the Create Account button until ticked + country selected
   - Both documents open in a modal that doesn't destroy the half-filled signup form
   - After signup → confirm, the profile row has `country`, `tos_version='1.0'`, `tos_agreed_at`, `privacy_version='1.0'`, `privacy_agreed_at` populated

That's the legal-documents-in-the-app job done.

---

## PART B — Must-do-before-launch list

The documents make specific claims about how the Service handles data and user safety. Some of those claims are already true. **Some require code changes to *become* true before public launch with strangers.** Each item below is one of those.

This list is ordered roughly by importance.

### Privacy / accuracy (these must be done — the docs claim them)

**1. Strip EXIF metadata on all photo uploads.**
The Privacy Policy (Section 2.6) states "Embedded metadata (such as EXIF data, including any GPS information) is stripped from photographs on upload." Confirm whether this is currently done in the upload code path. If not, build it: process every uploaded image to strip EXIF, GPS, camera info, and any other embedded metadata before storing it to Supabase. This is a real privacy leak otherwise — a photo taken at home contains GPS coordinates of the home.

**2. Remove the unused `mailing_address` column from `profiles`** (or confirm it's actually used).
The Privacy Policy says addresses are not stored on profiles. If the `profiles` table still has a `mailing_address` column, either: (a) drop it via migration, or (b) tell Claude that it IS actually used somewhere — in which case the Privacy Policy needs updating.

**3. Wire up Sentry error reporting.**
The Privacy Policy discloses Sentry. Make this true: install `@sentry/nextjs`, configure it with a Sentry project's DSN as an env var, confirm errors are flowing to a Sentry dashboard. Mention region (US vs EU) in the Sentry project setup — the Privacy Policy says "United States or European Union."

**4. Verify Vercel Analytics is correctly configured.**
The Privacy Policy discloses Vercel Analytics. Confirm `@vercel/analytics` is installed and rendering in the app shell, and that it's the basic analytics package, not Vercel Speed Insights only or vice versa. If you want both, add Speed Insights too — and the Privacy Policy should mention it.

### Trust / safety (required because messaging is on at launch)

**5. Build a "Report user" feature.**
Accessible from another user's profile and from a message thread. Should accept a brief reason (dropdown: harassment, scam/fraud, fake cards, inappropriate content, other; optional free-text field). Stores a row in a `user_reports` table — needs to be created (reporter_id, reported_user_id, reason, details, created_at, status). Notifies an admin queue.

**6. Build a "Block user" feature.**
Accessible same surfaces as Report. Effects when A blocks B: A and B cannot see each other in Discover; A cannot receive messages from B; existing message threads are hidden for A; B cannot start a new trade with A. Needs a `user_blocks` table (blocker_id, blocked_id, created_at).

**7. Build an admin moderation queue.**
A simple admin-only view of the `user_reports` table where you (as admin) can see incoming reports, view the reported user's recent activity, and take action (warn, suspend, terminate account, dismiss). Doesn't need to be fancy — a table view with action buttons is enough for launch.

**8. Address-reveal nudge in messages.**
When a user is typing in a message thread and the text matches a pattern that looks like a mailing address (e.g. number + street name + suburb/postcode), show a small one-time inline reminder: "*Reminder: only share your address with someone you trust to send the trade. Master Setter doesn't store or escrow trades.*" Optional polish but explicitly recommended by the reviewers. Goes after the higher-priority items.

### Legal / UI compliance

**9. Affiliate disclosure visible near eBay links.**
The Terms (Section 10.1) say disclosures appear "where they appear" near affiliate links. Add a small visible disclosure adjacent to or beneath the eBay "Find Online" or affiliate-link buttons: "*Affiliate link — Master Setter may earn a small commission.*" One line, plain text, visible.

**10. "Suggested match" / "trade at your own risk" UI language.**
The Terms (Section 4.2) describe matches as "suggestions only, not endorsements." For that legal framing to hold up *operationally*, the UI needs to match: surfaces that show matches should describe them as "suggested" or "possible" matches, and the trade-action surface should include a brief "trade at your own risk" note near the start-trade button. Small wording change, real legal value.

### Bug queue (logged this session, not strictly launch-blocking)

**11. Fix the Discover refresh-after-tick bug.**
Tick a card → return to Discover → that card should disappear from friends' duplicate listings. Currently it remains until something else triggers a refetch. Same shape as today's Discover bug; same general class of "data-model state changed but the reader didn't refresh."

**12. Investigate inflated set-value totals.**
`@alex`'s Perfect Order showing close to A$1000 — suspected too high. Hypothesis: the set-value calculation may not be applying the GM-tier filter (only Master tier should be counted toward set value), or may be summing duplicates incorrectly. Diagnose-first; confirm the calculation matches the locked-in "GM excluded from totals" rule.

---

## PART C — Items intentionally NOT in v1.0

These were considered and deferred — recording them so they don't get lost.

- **Lawyer review.** Both reviewing AIs and this draft acknowledge it's needed. Cost-deferred for launch; revisit before scaling beyond the first 100 users. Realistically a flat-fee startup ToS review is typically a few hundred dollars and is worth the spend before going wide.
- **Per-trade mailing address storage with auto-deletion.** Reviewers' recommendation, but **not needed** because the actual app design has addresses being shared in messages by users themselves — Master Setter never stores them centrally. Cleaner than the reviewers' suggested model. Just need to confirm the `mailing_address` column is gone (item 2 above).
- **The social-media-classification question.** Both AIs flagged it. Genuinely needs a lawyer. The docs include defensive language (Section 2.4 of the Terms) framing Master Setter as a "niche application focused on collection tracking and trading" and reserving the right to update. That's the best we can do without legal advice.
- **GDPR / EU compliance.** Not drafted for. If EU users become a real cohort, both documents need expansion.
- **Marketing email handling.** Not currently sending any. Section 4 of the Privacy Policy notes this and commits to opt-in if it changes.
- **The unused mortgage-broker analytics + the "brother's allied health" comments** that one of the AI reviews mentioned — disregard. Not real, not relevant.

---

## PART D — Get the documents reviewed by more AIs anytime

You've already done one pass (ChatGPT + Gemini). The drafts have been revised in response. If you want another round before publishing, the prompt is:

> "This is the final-for-launch draft of the Terms of Service [or Privacy Policy] for an Australian-operated Pokémon trading-card collection and trading app called Master Setter, operated by A E Cann Pty Ltd. It is written for Australian law, 18+ users only, broader/US-aware. It HAS already been through one round of AI review (ChatGPT + Gemini) and revised. It HAS NOT been reviewed by a lawyer.
>
> Please critique this version specifically. Tell me:
> 1. Anything new you spot that previous reviews missed
> 2. Any clause that's been *introduced* in this revision that you think is risky
> 3. Anything that's still inconsistent between the two documents
> 4. Whether the operational commitments in the documents (EXIF stripping, no GPS storage, suburb-only matching, third-party providers and regions) are clearly and accurately worded
>
> Don't rewrite — critique with reasoning."

That should produce a sharper second-pass review than asking generically.

---

## PART E — Summary checklist

- [ ] Paste v1.0 docs into `content/legal/terms.js` and `content/legal/privacy.js`
- [ ] Insert publication date and governing-law state in the documents
- [ ] Confirm `TOS_VERSION` and `PRIVACY_VERSION` are `1.0`
- [ ] Confirm `/terms` and `/privacy` are in `PUBLIC_PATHS`
- [ ] Smoke-test the signup-to-confirm-to-profile flow with the new docs live
- [ ] Work through Part B (must-do-before-launch) in roughly the order listed
- [ ] When ready to launch publicly: budget for a paid lawyer review pass
