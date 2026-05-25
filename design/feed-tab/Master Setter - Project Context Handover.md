# Master Setter — Project Context Handover

Paste this into Claude when you want it to write a prompt for a new page, screen, or feature. It captures the brand, the audience, the established design system, the navigation chrome, and what already exists, so Claude has the full picture before generating anything new.

---

## 1. The product

**Master Setter** is a mobile-first PWA for hardcore Pokémon TCG collectors. It helps them:

1. **Track master-set completion** — every card in a set, with rarity breakdowns, owned/missing, current AUD value, and duplicate counts.
2. **Browse friends' collections** — see what friends have, what they're missing, who's close to a master set.
3. **Reach goal: trades + discovery** — surface duplicates friends have that you're missing, eventually open trades, offers, and public master-set searching.

Audience: **collectors aged 25–45**, detail-oriented, comfortable with dense data. The product tone sits closer to a Bloomberg terminal crossed with a Pokédex than a typical kids' card-game app. Serious, intentional, restrained.

App was previously called "Perfect Order." Now renamed **Master Setter**.

---

## 2. Brand identity

### Logo

- **Wordmark:** "MASTER SETTER," stacked, two lines, sealed inside grading-style square brackets.
- **Mark only:** brackets enclosing `MS`.
- **Type:** IBM Plex Sans, weight 700, `letter-spacing: -0.01em`, uppercase.
- **Color:** `MASTER` in primary ink, `SETTER` in lime accent. Brackets in lime.
- **Bracket geometry:** width = height × 0.36, stroke ≈ height × 0.023, top/bottom arm length = width × 0.55, center notch (10% of height) drawn in background color to break the spine, filled lime dot of radius = stroke × 0.9 sitting on the center of the spine. This notch + dot is the signature element — it references grading-slab labels.
- Full spec lives in `Master Setter — Logo Pack.md` (in the project). It includes a drop-in `<MasterSetterLogo variant="stacked|inline|mark|mono">` React component.

### Brand voice / aesthetic

- **Serious, restrained, archival.** Sealed-and-authenticated feel, like a graded card slab.
- **Sparse layouts, lots of negative space, strong hierarchy through type and color** — not boxes and dividers.
- **Mono uppercase + wide letter-spacing for meta labels** is a signature element. Use it for series names, section headers, statuses.
- **No emojis. No filled pill backgrounds. No rounded chips.** No web-design tropes.
- **Bracket geometry shows up in the chrome** — page-title hairlines, the active tab indicator — but never forced.

---

## 3. Design tokens

These are the entire palette and type system. Don't invent new colors or fonts.

```css
:root {
  /* Background */
  --ms-bg:           #07070a;     /* near-black, slight cool */
  --ms-bg-pure:      #000000;
  --ms-bg-elev:      #0c0c10;     /* card / elevated surface */

  /* Text */
  --ms-ink:          #f4f4f6;
  --ms-dim:          rgba(244, 244, 246, 0.60);
  --ms-faint:        rgba(244, 244, 246, 0.36);

  /* Lines */
  --ms-rule:         rgba(244, 244, 246, 0.08);
  --ms-rule-soft:    rgba(244, 244, 246, 0.06);

  /* Accent */
  --ms-accent:       #c8ff4a;     /* lime — primary accent */
  --ms-accent-ink:   #07070a;     /* text on lime */

  /* Roles */
  --ms-gold:         #FFB830;     /* favourite stars only */
  --ms-danger:       #ff5a6a;     /* destructive, unread dot */

  /* Per-set theme samples (each set has its own tone) */
  --ms-set-lime:     #c8ff4a;
  --ms-set-pink:     #f72585;
  --ms-set-amber:    #f5b942;
}
```

**Typography**

| Use | Family | Weight | Tracking | Case |
|---|---|---|---|---|
| Body / UI | IBM Plex Sans | 400 / 500 / 600 / 700 | normal | sentence |
| Page titles | IBM Plex Sans | 700 | −0.01em | UPPERCASE |
| Meta / micro-labels | IBM Plex Mono | 500 / 700 | 0.08em – 0.20em | UPPERCASE |
| Numerals (counts, prices, codes) | IBM Plex Mono | 700 | 0.02em | `font-variant-numeric: tabular-nums` |

Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap" rel="stylesheet">
```

**Spacing scale:** `4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 24 · 32`. Inset padding for screens is **16px** left/right.

**Border radius:** `2 · 3 · 4` (never higher).

---

## 4. Navigation chrome (already designed)

### Top header — 52px

- Persistent across all screens. **No page title in the header.**
- Logo on the left (`<MasterSetterLogo variant="inline" height={28}/>`).
- Right side: two icon buttons, 40×40, 8px gap:
  - **Star** (favourites entry), filled gold `#FFB830`.
  - **Bell** (notifications), stroke `--ms-dim`. When unread > 0, 8×8 danger dot in top-right of bell with 2px bg ring.
- No bottom border at rest. Animate in `1px solid --ms-rule` when content scrolls beneath.

### Bottom tab bar — 64px + `env(safe-area-inset-bottom)`

- 4 cells, equal width: **Sets · Discover · Messages · You** (in that order).
- Background `--ms-bg` + `backdrop-filter: saturate(140%) blur(12px)`.
- Top border `1px solid --ms-rule`.
- Each cell: icon (22px outer, 2px stroke, rounded joins) above label (IBM Plex Mono, 9px, 0.08em tracking, uppercase, weight 500 inactive / 600 active).
- **Inactive:** icon + label in `--ms-dim`.
- **Active:** icon + label in `--ms-accent`. **No background fill, no pill.**
- **Active indicator:** at the top edge of the active cell — 2px lime line inset 14px from each side, with tiny 4px inward "tick" notches at each end (the bracket motif). Slides x on tab change (220ms ease).

### Page-title pattern (inside the body, never in the header)

```
[ MY SETS ]
@alex · 12 SETS · A$35,618
```

- Heading: IBM Plex Sans 700, **26px**, `letter-spacing: -0.01em`, uppercase, `--ms-ink`.
- Flanked by tiny 12×16 hairline brackets in lime, 1.5px stroke.
- Subtitle above heading: IBM Plex Mono, 10px, 0.2em tracking, uppercase, `--ms-faint`.

### Icons (the established set)

22px outer, 2px stroke, rounded joins, outline (not filled). Components live in `nav-chrome.jsx`:

- `IconStack` — stacked cards (Sets tab)
- `IconRadar` — radar sweep (Discover tab)
- `IconMsg` — speech bubble (Messages tab)
- `IconYou` — person silhouette, no circle (You tab)
- `IconStar`, `IconBell`, `IconHeart`, `IconFriends`, `IconSettings`, `IconLogout`, `IconChev`, `IconPlus` — supporting

---

## 5. Component vocabulary

The visual language is consistent across screens. When designing a new page, draw from these primitives.

### Set card (the workhorse pattern)

- Surface: `--ms-bg-elev` (#0c0c10), border `1px solid --ms-rule`, radius 4.
- **Top-edge glow:** 1px line in the set's tone color, with a 14px box-shadow glow + a 60px gradient fade from `tone14` to transparent across the top.
- Left: 44×44 logo placeholder, radius 4, inset 1px rule.
- Body: subtitle (mono, 9px, 0.2em tracking, `--ms-faint`) over set name (Plex Sans 700, 17px, -0.01em).
- Bottom: owned/total in big numerals (Plex Sans 700, 24px, tabular) on left + AUD value (Plex Mono 700, 16px, tone color) on right.
- 2px progress bar at bottom using `--ms-rule-soft` track and tone-colored fill with matching glow.

### Section labels

Mono, 10px, 0.2em tracking, uppercase, `--ms-faint`. Sit above a list/grid as a quiet header.

### Pills

- `NEW` pill: lime fill, dark text, Plex Mono 9px, 0.18em tracking, 700 weight, radius 2, padding `4px 7px`.
- `MASTER` chip (set complete badge): no background, just lime text, mono 9px 0.18em 700 — sits inline with the count.

### Dashed-outline button (additive actions)

50px tall, transparent, `1px dashed --ms-faint`, radius 4, color `--ms-dim`. Plex Mono 11px 0.18em uppercase 600. Icon + label, gap 8px. Used for "+ ADD A SET" etc.

### Avatar

When needed: 52×52 square (radius 4), lime fill, dark ink, initials in Plex Sans 700 22px -0.02em. **Not** a circle. (Reinforces the squared/sealed brand language.)

### Card grid (for Pokémon cards)

3-column grid, 10px gap, card aspect `63/88`. Each card: gradient placeholder (two HSL hues), 1px lime border at 33% opacity, radius 3. Number chip bottom-left in mono 8px, 0.1em, on a `rgba(0,0,0,0.7)` plate.

### Bracket hairline (decorative)

Tiny 12×16 SVG bracket — open square shape, 1.5px stroke, used to flank page titles and as section dividers when extra emphasis is needed.

---

## 6. Existing screens

The current app surface, all built into a single iPhone prototype in `Perfect Order.html` (renamed to Master Setter but file name preserved):

1. **Login** — email + password, signed wordmark.
2. **My Sets (home)** — portfolio hero (total value, refresh prices, sparkline), Discover strip, list of set cards, swipe actions on rows.
3. **Set page · Rarity view** — collapsible rarity sections, each with its own tint and progress bar.
4. **Set page · Binder view** — full 2- or 3-column card grid, headered by rarity sections.
5. **Set page · Missing only** — same grid, filtered to missing cards.
6. **Friends list** — your handle + share, add-by-handle form, friend list with view/remove actions.
7. **Friend's set view** — read-only version of a friend's set list, with a "Trade match: 7 cards" hint banner.
8. **Discover** — feed of cards friends own that you're missing, with offer buttons (beta hint).
9. **Add a set** — flow gated to a dashed button.

Tweaks panel exposes: direction (Holo / Vault / Cinematic / Editorial), accent override, background tone, columns (2/3), density, corner radius, type scale, set-color intensity, missing-card treatment.

**The chosen visual direction is IBM Plex Sans + Square Brackets (the "Bracket" direction).** The other directions in the prototype are exploratory — when designing new pages, build on Bracket only.

---

## 7. Cards & data model (so new pages stay consistent)

### A set
```ts
{
  id: string,
  name: string,              // "Twilight Masquerade"
  series: string,            // "SCARLET & VIOLET" — displayed uppercase mono
  owned: number, total: number,
  value: number,             // AUD
  tone: [string, string],    // two hex colors for the per-set gradient
  emblem: string,            // abstract glyph kind (crown, wing, gem, etc.)
}
```

### A rarity
```ts
{
  id: string, name: string,
  tint: string,              // dot + section accent
  total: number, owned: number,
}
```

Rarities used in the prototype: Common, Uncommon, Rare, ex, Mega ex, Illustration Rare, Full Art, Special Illustration Rare, Mega Hyper Rare.

### A card
```ts
{
  num: string,               // "042"
  name: string,
  rarity: string,            // rarity.id
  owned: boolean, dupes: number,
  value: number,             // AUD
  hueA: number, hueB: number,// 0-360 for the placeholder gradient
}
```

### A friend
```ts
{ handle: string, name: string, sets: number, value: number }
```

---

## 8. Files in the project (reference these when prompting)

- `Master Setter — Logo Pack.md` — logo spec + drop-in component.
- `Master Setter - Navigation Chrome.html` + `nav-chrome.jsx` — header + tab bar + 3 in-context screens.
- `Master Setter — Bracket Variations.html` — 10 bracket lockups + 4 lettering specimens (font exploration that landed on IBM Plex).
- `Master Setter — Logos.html` + `logos.jsx` — original 7-direction logo exploration (Bracket = direction 05, the chosen one).
- `Perfect Order.html` (+ `app.jsx`, `screens-1.jsx`, `screens-2.jsx`, `components.jsx`, `tokens.jsx`, `data.js`) — the working 9-screen iPhone prototype with Tweaks panel.
- `design_handoff_navigation_chrome/` — the dev handoff bundle for the chrome.

---

## 9. Rules for any new page

When designing or prompting for a new screen, follow these:

1. **Mobile-first, 390px width** (iPhone 14). Desktop is a stretch goal, not a starting point.
2. **Use the established chrome.** Header at top (52px), tab bar at bottom (64px + safe area). The page lives in the middle, scrollable. Page title goes **inside** the body using the bracket-hairline pattern — never in the header.
3. **Use only the tokens.** Don't introduce new colors, fonts, or radii.
4. **Lean on the mono/uppercase signature** for any metadata, status, or label text.
5. **Real-feeling content** in mocks — no lorem ipsum. Reuse the sample data (sets, rarities, friends) from the prototype if relevant.
6. **No emojis. No filled pill backgrounds for active states. No web tropes** (gradient backgrounds, drop-shadowed cards with rounded corners, hero illustrations of cute mascots, etc.).
7. **Bracket geometry can show up in the chrome** — page-title hairlines, decorative section dividers — but never forced.
8. **Numbers are first-class citizens.** Counts, prices, ratios (180/203), percentages all live in IBM Plex Mono with tabular nums and 0.02em tracking. Lean into them visually.
9. **Show empty states and loading states** in any new page spec — collectors hit a lot of "nothing yet" surfaces.
10. **State trade/social affordances clearly.** The reach goal is trades and public master-set discovery; new pages should consider where those entry points sit.

---

## 10. Boilerplate prompt template

When you ask Claude to design a new page, you can paste this on top of your specific ask:

> I'm designing a new page for **Master Setter**, a mobile-first PWA for hardcore Pokémon TCG collectors. The full project context is in the document above. Brand is IBM Plex Sans + lime accent (#c8ff4a) on near-black (#07070a), with a bracket-geometry signature. The page must use the established design tokens (no new colors or fonts), live inside the existing header + tab bar chrome, and follow the existing component vocabulary (set cards, mono uppercase meta labels, dashed-outline buttons, square avatars, 3-column card grids with 63:88 aspect).
>
> The new page is: **[describe page here]**.
>
> Please produce: page title + subtitle (using the bracket-hairline pattern), full screen mockup at 390px width, every state I should consider (empty, loading, error, success), and any new component primitives needed. No emojis, no filled-pill active states, real-feeling collector content (not lorem).
