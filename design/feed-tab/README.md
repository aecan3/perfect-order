# Handoff: Master Setter — Feed Tab + 5-cell Tab Bar

## Overview

Adds a new top-level surface to Master Setter: a **Feed** tab in the bottom navigation. The page is currently a "coming soon" placeholder that signals intent without committing to a date. The work covers two changes:

1. **Tab bar expands from 4 cells to 5.** Order becomes: Sets · Discover · **Feed** · Messages · You. Feed takes the middle position. New 22px outline icon, same active-state behavior as the rest.
2. **Feed page** — a single static screen showing a statement of intent, three preview cards (the future feature, demoed) inside a dashed `[ PREVIEW ]` container, and a dated closing line. No CTA, no signup, no notify-me.

Eventually the page will surface a live social activity feed: friends' collecting milestones (sets started/completed, favourites), with the killer mechanic — surfacing **which of their activity matches your duplicates** so you know who you can trade with.

## About the Design Files

The files in this bundle are **design references created in HTML/React-on-Babel** — prototypes showing intended look and behavior, not production code to copy directly. Recreate these designs in the Master Setter codebase using its established patterns. The HTML proves the spec; this README is the spec.

## Fidelity

**High-fidelity.** Exact pixel values, hex colors, font weights, letter-spacing, and stroke widths are all specified below. Open `Master Setter - Feed Tab.html` in any browser as a visual reference of last resort.

## Files in this bundle

| File | What it is |
|---|---|
| `Master Setter - Feed Tab.html` | Top-level prototype canvas. Open in a browser to inspect all 4 sections (icon options, tab bar variants, full page in context, justification notes). |
| `feed-tab.jsx` | All new components — the three Feed icon options, the 5-cell TabBar, FeedBody, three FeedCard variants. Lift these into the codebase. |
| `nav-chrome.jsx` | The existing chrome reference (header + 4-cell tab bar + page title pattern). The Feed work extends this — re-use, don't fork. |
| `design-canvas.jsx` | Pan/zoom canvas the prototype runs inside. Ignore for implementation. |
| `Master Setter — Project Context Handover.md` | Full brand + design system context. Read first if you weren't part of the navigation chrome work. |

To preview: open `Master Setter - Feed Tab.html` in any modern browser. No build step.

---

## Design Tokens

These are unchanged from the existing system. Reference only — they should already be in the codebase.

```css
:root {
  --ms-bg:           #07070a;
  --ms-bg-elev:      #0c0c10;
  --ms-ink:          #f4f4f6;
  --ms-dim:          rgba(244, 244, 246, 0.60);
  --ms-faint:        rgba(244, 244, 246, 0.36);
  --ms-rule:         rgba(244, 244, 246, 0.08);
  --ms-rule-soft:    rgba(244, 244, 246, 0.06);
  --ms-accent:       #c8ff4a;
  --ms-accent-ink:   #07070a;
  --ms-danger:       #ff5a6a;

  /* Set/friend tones used by feed cards */
  --ms-set-lime:     #c8ff4a;
  --ms-set-pink:     #f72585;
  --ms-set-amber:    #f5b942;
  --ms-set-cyan:     #5fb6ff;
}
```

Type: IBM Plex Sans (body / titles) + IBM Plex Mono (uppercase meta + numerals). No new fonts introduced.

---

## 1. Feed Tab Icon

**Recommended:** `IconFeedPulse` (heartbeat line). Distinct from `IconRadar` (concentric circles, Discover) and `IconMsg` (speech bubble, Messages). Reads "live activity" without being literal.

**Specs**
- Outer size 22×22, viewBox `0 0 22 22`
- Stroke: 2px, `stroke-linecap: round`, `stroke-linejoin: round`
- Color: `currentColor` so the parent can recolor (dim → accent on active)

**Geometry (Pulse — ship this one)**

```svg
<svg width="22" height="22" viewBox="0 0 22 22" fill="none">
  <path d="M2 11 H6 L8 5 L11 17 L13 9 L15 11 H20"
        stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

Two alternates live in `feed-tab.jsx` if a designer wants to revisit: `IconFeedTimeline` (three dots + stacked lines, reads as "list") and `IconFeedNetwork` (5-node graph, reads as "social"). Both are defensible — Pulse won because it doesn't collide with any existing icon's semantic territory.

---

## 2. Tab Bar — expanded to 5 cells

Order, left to right:

| Position | id | Label | Icon |
|---|---|---|---|
| 1 | `sets`     | Sets     | `IconStack` |
| 2 | `discover` | Discover | `IconRadar` |
| 3 | **`feed`** | **Feed** | **`IconFeedPulse`** |
| 4 | `messages` | Messages | `IconMsg` |
| 5 | `you`      | You      | `IconYou` |

**Specs — everything else is identical to the existing 4-cell bar.**
- Height: 64px + `env(safe-area-inset-bottom, 0px)`
- Background: `var(--ms-bg)` with `backdrop-filter: saturate(140%) blur(12px)`
- Top border: `1px solid var(--ms-rule)`
- Layout: flex row, each cell `flex: 1` (78px wide at 390px viewport)
- Per cell: icon 22px above label, gap 4px, vertically centered
- Label: IBM Plex Mono, 9px, `letter-spacing: 0.08em`, uppercase
  - Inactive: weight 500, color `var(--ms-dim)`
  - Active: weight 600, color `var(--ms-accent)`
- **No background fill on active.** Color change only + the indicator below.

**Active indicator (unchanged from existing pattern)**
- Top edge of the active cell, absolutely positioned
- Width: `cellWidth - 28px` (so 50px at 78px cells)
- 2px lime horizontal line, with tiny 4px inward bracket-notch ticks at each end
- Slides x on tab change, 220ms `cubic-bezier(.4,.2,.2,1)`

Reference SVG (W = cellWidth - 28):

```svg
<svg width="W" height="10" viewBox="0 0 W 10">
  <line x1="1" y1="1" x2="W-1" y2="1" stroke="#c8ff4a" stroke-width="2"/>
  <line x1="1" y1="1" x2="1" y2="5"   stroke="#c8ff4a" stroke-width="2"/>
  <line x1="W-1" y1="1" x2="W-1" y2="5" stroke="#c8ff4a" stroke-width="2"/>
</svg>
```

The animation work that already exists for the 4-cell bar carries over unchanged — the indicator is a single sliding element positioned by `transform: translateX(activeIndex × cellWidth)`. If currently hard-coded to 4 cells, generalize.

---

## 3. Feed Page

A single static screen. Lives inside the existing chrome (header + tab bar). No new chrome.

### 3.1 Page title

Established bracket-hairline pattern.

```
COMING SOON · IN DEVELOPMENT          ← subtitle: IBM Plex Mono, 10px,
                                         0.2em tracking, uppercase, --ms-faint,
                                         margin-bottom 8px
[ FEED ]                              ← heading: IBM Plex Sans 700, 26px,
                                         -0.01em tracking, uppercase, --ms-ink,
                                         flanked by 12×16 hairline brackets
                                         in --ms-accent, 1.5px stroke
```

Container padding: `14px 18px 6px`. Bracket SVG component: `BracketHairline` in `feed-tab.jsx`.

### 3.2 Statement of intent

Two declarative lines, IBM Plex Sans 500, 17px, `-0.005em` tracking, line-height 1.4, color `--ms-ink`:

> See what your circle is collecting.
> See who can finish your sets.

Container padding: `16px 18px 22px`. Use `text-wrap: pretty` so the wrap behaves on small viewports.

### 3.3 PREVIEW container

Wraps the three example cards. Establishes "these are not live data."

- Border: `1px dashed var(--ms-faint)`, radius 4, padding `20px 14px 16px`
- Label above the container, breaking the top border (`background: var(--ms-bg)` on the label so it cuts the dashed line):
  - Position: absolute, top `-8px`, left `14px`
  - Padding: `0 8px`
  - Inline content: small left bracket hairline + `PREVIEW` (IBM Plex Mono, 10px, 700, 0.2em tracking, `--ms-faint`) + small right bracket hairline
- Children: three cards stacked, gap 10px

### 3.4 Three example cards

All three use the established **set-card visual language**:
- Surface: `var(--ms-bg-elev)`, `1px solid var(--ms-rule)`, radius 4, `overflow: hidden`
- **Top-edge tone glow:** 1px line at top in the card's tone color, with `box-shadow: 0 0 14px <tone>` + a 56px gradient fade from `tone14` (8% opacity in hex) to transparent across the top
- Position: relative, so the glow + gradient sit beneath the content

Each card is two padded sections; the lower section (when present) is divided from the upper by `1px solid var(--ms-rule)`.

#### Card A — Set started · cyan tone (`#5fb6ff`)

Upper section, padding `14px 14px 12px`:
- Row 1: 28×28 cyan square avatar with `S` initial (Plex Sans 700, ~13px), gap 10, then meta label `@sarah · STARTED · 2H` (Plex Mono 9px, 0.2em tracking, uppercase, `--ms-faint`)
- Row 2 (mt 8): title `Sarah started Black Bolt` (Plex Sans 700, 16px, `-0.01em`, line-height 1.2, `--ms-ink`)
- Row 3 (mt 4): series `SCARLET & VIOLET · 178 CARDS` (Plex Mono 9px, 0.18em, uppercase, `--ms-dim`)

Lower section, padding `10px 14px 12px`, divider above:
- Flex row, justify space-between
- Left column (flex 1, gap 2):
  - `DUPLICATE MATCH` (Plex Mono 9px, 700, 0.18em, uppercase, `--ms-accent`)
  - `You have 12 of her missing cards` (Plex Sans 500, 13px, `-0.005em`, `--ms-ink`)
- Right: big number `12` (Plex Mono 700, 18px, tabular-nums, 0.02em, `--ms-accent`)

#### Card B — Set completed · lime tone (`#c8ff4a`)

Upper section, padding `14px 14px 12px`:
- Row 1: 28×28 lime square avatar with `A` initial, gap 10, then `@alex · COMPLETED · 14H` (same meta style as Card A)
- Row 2 (mt 8): flex row, gap 8, flex-wrap
  - Title `Alex completed Perfect Order` (Plex Sans 700, 16px, `-0.01em`)
  - `MASTER` chip — inline, no background, Plex Mono 9px, 700, 0.18em, `--ms-accent`
- Row 3 (mt 4): `MEGA EVOLUTION` (series, Plex Mono 9px, 0.18em, uppercase, `--ms-dim`)
- Row 4 (mt 12): flex row, justify space-between, align baseline
  - Left: `124` (Plex Sans 700, 28px, `-0.02em`, tabular-nums, `--ms-ink`) + `/ 124` (Plex Sans, 14px, tabular-nums, `--ms-faint`)
  - Right: `A$4,210` (Plex Mono 700, 16px, tabular-nums, `--ms-accent`)

No progress bar on this card — the set is complete.

#### Card C — Social proof · amber tone (`#f5b942`)

Upper section, padding `14px 14px 12px`:
- Row 1 (gap 12 between avatar group and meta):
  - Avatar group: 3× 28×28 square avatars, overlapped (each except the first has `margin-left: -8px`). Each avatar wrapped in a `box-shadow: 0 0 0 2px var(--ms-bg-elev)` ring so the overlap reads cleanly. Tones: pink (`R`), amber (`K`), cyan (`S`).
  - Meta: `TRENDING · 3 IN YOUR CIRCLE` (same meta style)
- Row 2 (mt 10): title `3 friends are collecting Destined Rivals` (Plex Sans 700, 16px, `-0.01em`)
- Row 3 (mt 4): series `SCARLET & VIOLET · 244 CARDS` (mono meta)

Lower section, same anatomy as Card A's lower section:
- Left: `YOUR DUPLICATES` (accent meta) + `Could help 2 of them` (sans 500, 13px)
- Right: `27` (mono 700, 18px, accent)

### 3.5 Closing line

Outside the PREVIEW container, centered, mt 20:

```
IN DEVELOPMENT · MAY 2026
```

IBM Plex Mono, 10px, 500, 0.2em tracking, uppercase, `--ms-faint`, padding `14px 0 8px`, text-align center.

---

## 4. Avatars (new primitive — small variant)

The 52×52 square avatar already exists. This page introduces a **28×28** variant for inline use in feed cards. Spec:

```jsx
function Avatar({ size = 28, initial, tone = 'var(--ms-accent)', ink = 'var(--ms-accent-ink)' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 4, flexShrink: 0,
      background: tone, color: ink,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 700,
      fontSize: Math.round(size * 0.45), letterSpacing: '-0.02em',
    }}>{initial}</div>
  );
}
```

Tones available: any of the set/friend tone colors. The `ink` (text color) needs adjusting per tone so contrast reads — see `feed-tab.jsx` for the lookups (lime→`#07070a`, pink→`#1a0510`, amber→`#1a1206`, cyan→`#06121a`).

Stack/overlap pattern: subsequent avatars get `margin-left: -8px` and a `box-shadow: 0 0 0 2px <surface-color>` ring to read against the avatar behind.

---

## 5. Behavior

| Surface | Trigger | Behavior |
|---|---|---|
| Tab `feed` | Tap | Navigate to `/feed`, slide indicator to its cell (220ms) |
| Feed page | Tap any preview card | **No-op.** They're previews — make them visibly non-interactive (no hover state, no cursor pointer). Cursor remains default. |
| Feed page | Scroll | Standard page scroll. Header gains its `1px solid var(--ms-rule)` bottom border once `scrollTop > 0` (same pattern as the rest of the app). |

**No live data fetching** for this page. Everything renders from constants in the component.

---

## 6. Accessibility

- The 5th tab is a `<button>` (or `<a>`) inside the existing `<nav aria-label="Primary">`. Set `aria-current="page"` when active.
- Preview cards should be marked `aria-disabled="true"` and have no `role="button"` — they're decorative content, not interactive.
- `PREVIEW` label: include `aria-label="Preview — example content"` on the dashed container so screen readers don't get confused.
- All text meets WCAG AA: lime (`#c8ff4a`) on `#07070a` is 14.4:1; `--ms-dim` (60% white on near-black) is 11.6:1; `--ms-faint` (36%) is 6.9:1.

---

## 7. State Management

Add to whatever holds tab state:

```ts
type Tab = 'sets' | 'discover' | 'feed' | 'messages' | 'you';
```

Feed page itself: no state. Static content.

If the tab bar is currently hard-coded to 4 cells, the generalization is:
1. Lift the array of tabs out as a const.
2. Compute `cellWidth = barWidth / tabs.length` (or rely on CSS `flex: 1`).
3. Position the indicator with `transform: translateX(activeIndex * 100%)` where the indicator's own width is `cellWidth - 28px`.

---

## 8. What NOT to implement

- Live feed data, real-time friend activity, milestone detection — those are future work. This is the placeholder page.
- A notify-me / email-signup form. Intentionally absent.
- Date countdown, ETA banner, progress meter on the build. The page is honest about being in development; that's the whole content.
- Any change to the existing 4 tabs' icons, labels, or behavior.

---

## 9. Files to add / modify

Suggested changes in the codebase (adjust to your structure):

```
src/
  components/
    nav/
      TabBar.tsx              ← modify: add 5th tab; generalize indicator math
      icons/
        IconFeedPulse.tsx     ← new
        (IconFeedTimeline.tsx, IconFeedNetwork.tsx — alternates, optional)
    feed/
      FeedScreen.tsx          ← new
      FeedCard.tsx            ← new (the wrapper with tone glow)
      cards/
        SetStartedCard.tsx    ← new
        SetCompletedCard.tsx  ← new
        SocialProofCard.tsx   ← new
    primitives/
      Avatar.tsx              ← modify: support `size` prop (28 minimum)
      PreviewContainer.tsx    ← new (the dashed container with [PREVIEW] label)
  routes/
    feed.tsx                  ← new route handler → <FeedScreen/>
```

---

## Open questions for the dev

- Is the existing TabBar's active indicator implemented with `position: absolute` + `left/right` percentages, or as a `transform` translate? Either works for the 5-cell update; the latter is cheaper to animate.
- Where does the 28px avatar variant land in the design system? If `<Avatar>` already exists with a hard-coded size, add a `size` prop rather than a new component.
- Does the bottom tab bar already account for `env(safe-area-inset-bottom)`? On models with a home indicator it's critical.

If any of these are open, ping the design team for a quick sync before implementing.
