# Handoff: Master Setter — Navigation Chrome

## Overview

This handoff covers the **navigation chrome** for Master Setter — a Pokémon TCG master-set tracker PWA. Specifically:

- **Bottom tab bar** — 4 tabs (Sets, Discover, Messages, You), 64px + safe-area inset.
- **Top header** — minimal, 52px, logo left, star + bell right.
- **Active-tab indicator** — 2px lime line with bracket-corner notches at the top of the active tab cell.
- **In-context body** for three screens (Sets list, Discover grid, You menu) so the chrome can be seen framing real content.

The set-tracker cards, Discover cards, You-menu rows, and the logo itself are referenced but not part of this work; they already exist in the codebase.

## About the Design Files

The files in this bundle are **design references created in HTML/React-on-Babel** — prototypes showing intended look and behavior, not production code to copy directly. Your job is to **recreate these designs in the Master Setter codebase** using its established patterns (PWA, React, whatever component primitives are already in use). The HTML proves the spec; it is not the spec.

If the codebase doesn't yet have a component library, React + CSS modules (or Tailwind with these tokens as `theme.extend`) is fine.

## Fidelity

**High-fidelity.** Exact pixel values, hex colors, font families, weights, letter-spacing, and stroke widths are all specified below. The HTML prototype matches the intended look 1:1 — use it as your visual reference of last resort, but lean on this README for measurements.

## Files in this bundle

| File | What it is |
|---|---|
| `Master Setter - Navigation Chrome.html` | Top-level prototype. Open in a browser to see all 5 sections on a pan/zoom canvas. |
| `nav-chrome.jsx` | All navigation components + the three context screens (React + Babel inline-JSX, single file). Lift the chrome components from here. |
| `design-canvas.jsx` | Pan/zoom canvas the prototype runs inside. Not part of the chrome — ignore for implementation. |
| `Master Setter — Logo Pack.md` | The brand & logo spec (referenced for the logo placeholder in the header). |

To preview: open `Master Setter - Navigation Chrome.html` in any modern browser. No build step. Scroll/zoom the canvas, double-click an artboard to focus it fullscreen.

---

## Design Tokens

Drop these into the codebase's token file (CSS variables, Tailwind config, or whatever it uses).

```css
:root {
  /* Background */
  --ms-bg:           #07070a;
  --ms-bg-pure:      #000000;
  --ms-bg-elev:      #0c0c10;            /* card surface */

  /* Text */
  --ms-ink:          #f4f4f6;
  --ms-dim:          rgba(244, 244, 246, 0.60);
  --ms-faint:        rgba(244, 244, 246, 0.36);

  /* Lines */
  --ms-rule:         rgba(244, 244, 246, 0.08);
  --ms-rule-soft:    rgba(244, 244, 246, 0.06);

  /* Accent */
  --ms-accent:       #c8ff4a;            /* lime */
  --ms-accent-ink:   #07070a;            /* text on lime */

  /* Roles */
  --ms-gold:         #FFB830;            /* favourite stars only */
  --ms-danger:       #ff5a6a;            /* notif dot, destructive */

  /* Per-set theme samples (each set has its own tone) */
  --ms-set-lime:     #c8ff4a;
  --ms-set-pink:     #f72585;
  --ms-set-amber:    #f5b942;
}
```

**Typography**

| Use | Family | Weight | Tracking | Case |
|---|---|---|---|---|
| Body / UI labels | IBM Plex Sans | 400 / 500 / 600 / 700 | normal | sentence |
| Page titles | IBM Plex Sans | 700 | −0.01em | UPPERCASE |
| Meta / micro-labels | IBM Plex Mono | 500 / 700 | 0.08em–0.20em | UPPERCASE |
| Numerals (counts, prices) | IBM Plex Mono | 700 | 0.02em | `font-variant-numeric: tabular-nums` |

Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap" rel="stylesheet">
```

**Spacing scale** (used throughout)

`4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 24 · 32`

Inset padding for screens: **16px** left/right.

**Border radius**

`2 · 3 · 4` (never higher — restrained, archival)

---

## 1. Top Header

**Element:** `<header>`
**Height:** 52px (fixed)
**Padding:** `0 16px`
**Background:** `var(--ms-bg)`
**Bottom border:** none at rest. When the body scrolls beneath, animate in `1px solid var(--ms-rule)` (200ms ease).
**Position:** persistent across all screens; never page-specific (no page title here).

**Anatomy**
- **Logo (left).** Slot for `<MasterSetterLogo variant="inline" height={28}/>` from the Logo Pack. Size budget: ~110×28px. In the prototype this is a dashed placeholder labelled `LOGO 110×28`. Real logo lives in the codebase.
- **Action group (right).** Flex row, `gap: 8px`.
  - **Favourites button** — 40×40 hit area, no background, icon centered. Star icon, fill `var(--ms-gold)` (#FFB830). Tapping it goes to the favourites screen.
  - **Notifications button** — 40×40 hit area, no background. Bell icon, stroke `var(--ms-dim)`. When there are unread notifications, render an 8×8 circle, `var(--ms-danger)` fill, top-right corner of the bell, with a 2px ring of `var(--ms-bg)` around it (so it reads against the bell glyph regardless of bg).

**Icons** — outline, 20px outer, 1.8px stroke, rounded joins. See `nav-chrome.jsx` for `IconStar` and `IconBell` source.

---

## 2. Bottom Tab Bar

**Element:** `<nav aria-label="Primary">`
**Height:** `64px + env(safe-area-inset-bottom, 0px)`
**Background:** `var(--ms-bg)` with `backdrop-filter: saturate(140%) blur(12px)` so scrolling content tints through subtly.
**Top border:** `1px solid var(--ms-rule)`
**Layout:** Flex row, 4 equal-width cells (each `flex: 1`). Tap target = full cell × full bar height.

**Tabs (in this exact order)**

| Position | id | Label | Icon (recommended) |
|---|---|---|---|
| 1 | `sets`     | Sets     | Stacked cards (`IconStack`) |
| 2 | `discover` | Discover | Radar sweep (`IconRadar`) |
| 3 | `messages` | Messages | Speech bubble (`IconMsg`) |
| 4 | `you`      | You      | Person silhouette, no circle (`IconYou`) |

Two alternate icon options for Sets (9-pocket grid, binder spine) and Discover (compass, sparkle) live in `nav-chrome.jsx` as `IconGrid` / `IconBinder` / `IconCompass` / `IconSpark` if a designer wants to swap.

**Cell anatomy** (each cell is a `<button>` with `aria-current="page"` when active)
- Vertical flex, `gap: 4px`, centered.
- Icon: 22px outer, 2px stroke, rounded joins.
- Label: IBM Plex Mono, **9px**, weight **500** (inactive) or **600** (active), `letter-spacing: 0.08em`, uppercase.
- **Inactive color:** `var(--ms-dim)` for both icon and label.
- **Active color:** `var(--ms-accent)` for both icon and label.
- **No background fill on active.** No pill. No rounded chip. Just color change + the indicator below.

**Active indicator** — drawn at the **top edge** of the active cell, absolutely positioned:
- 2px lime horizontal line, inset `14px` from each side of the cell.
- Tiny inward vertical "tick" at each end (4px tall, same 2px stroke, lime).
- This is the bracket motif from the brand showing up in the chrome.

Reference SVG (cell width is N, indicator drawn inside the cell):
```svg
<svg width="N-28" height="10" viewBox="0 0 W 10">
  <line x1="1" y1="1" x2="W-1" y2="1" stroke="#c8ff4a" stroke-width="2"/>
  <line x1="1" y1="1" x2="1"   y2="5" stroke="#c8ff4a" stroke-width="2"/>
  <line x1="W-1" y1="1" x2="W-1" y2="5" stroke="#c8ff4a" stroke-width="2"/>
</svg>
```

**Behavior**
- Tap a tab → navigate to that route, animate the indicator slide-x to the new cell (220ms cubic-bezier(.4,.2,.2,1)).
- Long-press a tab → no special behavior (do not steal the gesture).
- The bar is **always visible** when a top-level screen is active. Hide it on full-screen modals (card detail, trade flow, etc.) — slide down 200ms.

---

## 3. Status bar & home indicator

The prototype includes mock iOS status bar (44px) and home indicator (8px) so the chrome can be judged in context. In the real PWA these are handled by the system — your job is to honor the safe areas:

- Top: pad the header with `env(safe-area-inset-top)` if it sits at the very top of the viewport.
- Bottom: the tab bar handles this via `padding-bottom: env(safe-area-inset-bottom)`.

---

## 4. Page Title pattern (used in the body, not the header)

Page titles live **inside** the page body, never in the top header. The pattern:

```
[ MY SETS ]
@alex · 12 SETS · A$35,618
```

- Heading: IBM Plex Sans 700, **26px**, `letter-spacing: -0.01em`, uppercase, `var(--ms-ink)`.
- Flanked left & right by a tiny hairline bracket: 12×16, 1.5px stroke, `var(--ms-accent)`. (See `BracketHairline` in `nav-chrome.jsx`.)
- Subtitle above: IBM Plex Mono 10px, uppercase, `letter-spacing: 0.2em`, `var(--ms-faint)`, `margin-bottom: 8px`.
- Container padding: `14px 18px 6px`.

---

## 5. Screens (in context — body content references existing components)

The HTML shows three screens with the chrome in place. The **body content** is illustrative; do not re-implement these from this handoff. Wire the chrome to the existing screens.

### Screen A — Sets
- Sets cards stack vertically, gap **10px**, full width minus 16px insets.
- Below the list: a dashed "+ ADD A SET" button (50px tall, IBM Plex Mono, 11px, 0.18em tracking).

### Screen B — Discover
- Mono-label header row: `NEW` lime pill + `DISCOVER — N CARDS YOUR FRIENDS HAVE` in lime mono.
- 3-column grid, gap **10px**, card aspect 63:88.
- Each card: thin 1px lime border @ 33% opacity, gradient placeholder, `#NUM` chip bottom-left.
- Below each card: `@username` (IBM Plex Mono, 9px, dim) and price (IBM Plex Mono 700, 13px, lime, tabular).

### Screen C — You
- Profile card: 16px padded, accent top-line + glow, 52×52 lime avatar with initials, handle + EDIT link + meta line.
- `ACCOUNT` section label.
- Menu rows: 16px y-padding, icon + label + optional hint + chevron. Separators: `var(--ms-rule-soft)`. "Sign out" row has no chevron and uses `var(--ms-danger)` color.

---

## Interactions & Behavior

| Surface | Interaction | Spec |
|---|---|---|
| Tab cell | Tap | Navigate, slide indicator (220ms ease) |
| Tab cell | Press-hold | None — pass through |
| Star button | Tap | Navigate to `/favourites` |
| Bell button | Tap | Open notification sheet (separate work) |
| Bell button | When `unreadCount > 0` | Render danger dot |
| Header border | When scroll > 0 | Fade in 1px rule, 200ms |
| Tab bar | On modal open | Slide down 200ms |

---

## Accessibility

- Each tab is a `<button>` (or `<a>` if routes are URLs). Set `aria-current="page"` on the active one.
- `<nav aria-label="Primary">` wraps the tab bar.
- Header buttons get `aria-label`: "Favourites", "Notifications".
- Notification dot needs an SR-only count: `<span class="sr-only">3 unread notifications</span>`.
- Hit targets are full cell (≥48×48 minimum); never reduce.
- Don't rely on color alone — the active state changes color AND adds the indicator line, so colorblind users still see it.
- All interactive elements get a visible focus ring (lime 2px outline at 2px offset is fine).

---

## State Management

Minimal:
- `activeTab: 'sets' | 'discover' | 'messages' | 'you'` — derive from route if possible.
- `unreadCount: number` — drives the bell dot.
- `headerScrolled: boolean` — derive from scroll listener on the main scroll container (not window).
- `tabBarVisible: boolean` — for modal hide/show.

No data fetching is needed for the chrome itself.

---

## Drop-in component sketch

```jsx
// MasterSetterShell.jsx — wrap any screen
import { MasterSetterLogo } from './MasterSetterLogo';
import { TabBar } from './TabBar';
import { IconStar, IconBell } from './icons';

export function Shell({ activeTab, unreadCount, children }) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = e => setScrolled(e.currentTarget.scrollTop > 0);

  return (
    <div className="ms-shell">
      <header className="ms-header" data-scrolled={scrolled}>
        <MasterSetterLogo variant="inline" height={28}/>
        <div className="ms-header-actions">
          <button aria-label="Favourites" className="ms-icon-btn">
            <IconStar/>
          </button>
          <button aria-label="Notifications" className="ms-icon-btn">
            <IconBell/>
            {unreadCount > 0 && (
              <>
                <span className="ms-notif-dot" aria-hidden/>
                <span className="sr-only">{unreadCount} unread</span>
              </>
            )}
          </button>
        </div>
      </header>
      <main className="ms-main" onScroll={onScroll}>
        {children}
      </main>
      <TabBar active={activeTab}/>
    </div>
  );
}
```

CSS:
```css
.ms-shell {
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  background: var(--ms-bg);
  color: var(--ms-ink);
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}
.ms-header {
  height: 52px; padding: 0 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid transparent;
  transition: border-color 200ms;
}
.ms-header[data-scrolled="true"] { border-color: var(--ms-rule); }
.ms-header-actions { display: flex; gap: 8px; }
.ms-icon-btn {
  width: 40px; height: 40px; border: 0; background: transparent;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; border-radius: 4px;
  color: var(--ms-dim);
  position: relative;
}
.ms-icon-btn:focus-visible { outline: 2px solid var(--ms-accent); outline-offset: 2px; }
.ms-notif-dot {
  position: absolute; top: 7px; right: 7px;
  width: 8px; height: 8px; border-radius: 9999px;
  background: var(--ms-danger);
  box-shadow: 0 0 0 2px var(--ms-bg);
}
.ms-main { flex: 1; overflow: auto; min-height: 0; }
```

The `<TabBar>` and `<MasterSetterLogo>` components — lift the geometry and icons directly from `nav-chrome.jsx` and the Logo Pack md, respectively.

---

## What NOT to implement from this bundle

- The set-tracker cards on the Sets screen (already exist)
- The favourites grid (already exists)
- The Messages thread UI (already exists)
- The logo itself (already exists — Logo Pack md is reference only)

Implement only the **chrome** (header + tab bar + indicator + page-title pattern) and wire it around the existing screens.

---

## Open questions for the dev

- Does the codebase already have a router? If so, use it for active-tab derivation; don't lift state to a parent.
- Is the safe-area `env()` already wired in the PWA manifest / viewport meta? If not, add `viewport-fit=cover`.
- Where do notifications live? The bell button needs to know where to navigate.

If any of these are open, the design team is reachable for a quick sync.
