# Master Setter — Logo Pack

**Direction:** IBM Plex Sans + Square Brackets
**Voice:** calm technical, software-grade, archival
**Pairs with:** lime accent on near-black

---

## 1. Type

| Use | Family | Weight | Tracking | Case |
|---|---|---|---|---|
| Wordmark | IBM Plex Sans | 700 (Bold) | −0.01em | UPPERCASE |
| Tagline / meta | IBM Plex Mono | 500 (Medium) | 0.36em | UPPERCASE |
| UI body | IBM Plex Sans | 400 / 500 / 600 | normal | sentence |

Google Fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap" rel="stylesheet">
```

Two words, stacked. `MASTER` in `--ink`, `SETTER` in `--accent`. Line-height 0.9. Center-aligned within brackets.

---

## 2. Color tokens

```css
:root {
  --ms-bg:       #07070a;   /* near-black, slight cool */
  --ms-bg-pure:  #000000;   /* alt — pure black */
  --ms-ink:      #f4f4f6;   /* primary text */
  --ms-dim:      rgba(244, 244, 246, 0.60);
  --ms-faint:    rgba(244, 244, 246, 0.36);
  --ms-accent:   #c8ff4a;   /* lime — used for SETTER + bracket */
  --ms-accent-ink: #07070a; /* text on accent */
}

/* Mono / inverse variants */
.ms-on-light { --ms-bg: #f4f4f6; --ms-ink: #07070a; --ms-accent: #07070a; }
.ms-on-dark-mono { --ms-accent: #f4f4f6; }   /* white on black, no lime */
```

Contrast: lime on near-black passes WCAG AA Large (≥3:1). Do **not** put lime on white — fails contrast and looks toxic.

---

## 3. Bracket geometry

Per bracket (left mirrors right):

- **Aspect:** width = height × 0.36
- **Stroke:** 3px at 130px height → scale linearly with height (`stroke = round(height × 0.023)`)
- **Inset (top/bottom arm length):** `width × 0.55`
- **Center notch:** 10% of the bracket height, drawn in `--ms-bg` (subtracts from the spine)
- **Center dot:** filled circle, radius = stroke × 0.9, color = `--ms-accent`, positioned on the spine

All brackets are `--ms-accent` colored. The notch + dot are the signature — they reference grading-slab labels and serial markers.

Reference SVG (left bracket, 130px tall):

```svg
<svg viewBox="0 0 47 130" width="47" height="130" overflow="visible"
     xmlns="http://www.w3.org/2000/svg">
  <!-- top arm -->
  <line x1="25.85" y1="1.5" x2="1.5" y2="1.5" stroke="#c8ff4a" stroke-width="3"/>
  <!-- spine -->
  <line x1="1.5" y1="1.5" x2="1.5" y2="128.5" stroke="#c8ff4a" stroke-width="3"/>
  <!-- bottom arm -->
  <line x1="1.5" y1="128.5" x2="25.85" y2="128.5" stroke="#c8ff4a" stroke-width="3"/>
  <!-- center notch (knockout) -->
  <line x1="1.5" y1="58.5" x2="1.5" y2="71.5" stroke="#07070a" stroke-width="5"/>
  <!-- center dot -->
  <circle cx="1.5" cy="65" r="2.7" fill="#c8ff4a"/>
</svg>
```

Right bracket: mirror horizontally (`transform="scale(-1,1) translate(-47,0)"`) or flip the x-coords.

---

## 4. Clear-space & sizing

- **Clear space:** equal to the height of a single letter (the cap height of `MASTER`) on every side. Nothing — type, edges, UI chrome — enters that zone.
- **Minimum size:** primary lockup 88px wide (digital), 22mm wide (print). Below that, use the **mark** (brackets + initials).
- **Bracket-to-wordmark gap:** 16px at 130px bracket height; scale proportionally.

---

## 5. Lockups

### 5.1 Primary — stacked horizontal
The hero version. Brackets enclose a two-line wordmark.

```
[  MASTER  ]
[  SETTER  ]
```

- Use everywhere: app icon-adjacent headers, marketing, splash, about screens.

### 5.2 Inline horizontal
One-line variant. Use when vertical space is tight (nav bars, footers).

```
[ MASTER  SETTER ]
```

Bracket height = cap height × 1.5. Word gap = cap height × 0.4.

### 5.3 Mark only — brackets + initials
For favicons, app icon, social avatar, watermarks.

```
[ MS ]
```

Square frame. `MS` in IBM Plex Sans 700. Bracket height = frame × 0.65.

### 5.4 Mono / single-color
Strip the lime → render brackets and `SETTER` in the same color as `MASTER`. Use for embossing, single-color print, watermark.

### 5.5 Inverted
Light background variant — invert `--ms-bg` and `--ms-ink`, set `--ms-accent` to `#07070a` (no lime on light).

---

## 6. Drop-in React component

```jsx
// MasterSetterLogo.jsx
export function MasterSetterLogo({
  variant = 'stacked',          // 'stacked' | 'inline' | 'mark' | 'mono'
  height = 64,                  // overall lockup height in px
  accent = '#c8ff4a',
  ink = '#f4f4f6',
  bg = '#07070a',
  className,
}) {
  if (variant === 'mark') {
    const s = height;
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" className={className}
           xmlns="http://www.w3.org/2000/svg">
        <Bracket side="left"  x={6}  h={70} y={15} stroke={2.4} color={accent} bg={bg}/>
        <Bracket side="right" x={94} h={70} y={15} stroke={2.4} color={accent} bg={bg}/>
        <text x="50" y="62" textAnchor="middle"
              fontFamily="IBM Plex Sans, sans-serif" fontWeight="700"
              fontSize="38" letterSpacing="-0.5" fill={ink}>MS</text>
      </svg>
    );
  }

  const bracketH = variant === 'stacked' ? height : Math.round(height * 0.78);
  const fontSize = variant === 'stacked' ? Math.round(height * 0.34) : Math.round(height * 0.5);
  const setterFill = variant === 'mono' ? ink : accent;
  const bracketFill = variant === 'mono' ? ink : accent;

  return (
    <span className={className}
      style={{
        display: 'inline-flex', alignItems: 'center',
        gap: Math.round(bracketH * 0.12),
        fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700,
        fontSize, lineHeight: 0.9, letterSpacing: '-0.01em',
        textTransform: 'uppercase', color: ink,
      }}>
      <BracketSVG side="left"  h={bracketH} color={bracketFill} bg={bg}/>
      {variant === 'stacked' ? (
        <span style={{ textAlign: 'center' }}>
          <span style={{ display: 'block' }}>MASTER</span>
          <span style={{ display: 'block', color: setterFill, marginTop: 4 }}>SETTER</span>
        </span>
      ) : (
        <span style={{ display: 'inline-flex', gap: '0.4em' }}>
          <span>MASTER</span>
          <span style={{ color: setterFill }}>SETTER</span>
        </span>
      )}
      <BracketSVG side="right" h={bracketH} color={bracketFill} bg={bg}/>
    </span>
  );
}

function BracketSVG({ side, h, color, bg }) {
  const w = h * 0.36;
  const s = Math.max(2, Math.round(h * 0.023));   // stroke
  const inset = w * 0.55;
  const open = side === 'left';
  const sx = open ? s / 2 : w - s / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}
         xmlns="http://www.w3.org/2000/svg">
      <line x1={open ? inset : w - inset} y1={s/2} x2={sx} y2={s/2}     stroke={color} strokeWidth={s}/>
      <line x1={sx} y1={s/2} x2={sx} y2={h - s/2}                       stroke={color} strokeWidth={s}/>
      <line x1={sx} y1={h - s/2} x2={open ? inset : w - inset} y2={h - s/2} stroke={color} strokeWidth={s}/>
      <line x1={sx} y1={h * 0.45} x2={sx} y2={h * 0.55}                 stroke={bg}    strokeWidth={s + 2}/>
      <circle cx={sx} cy={h / 2} r={s * 0.9}                            fill={color}/>
    </svg>
  );
}

// Mark version — re-uses BracketSVG via a tiny wrapper:
function Bracket({ side, x, y, h, stroke, color, bg }) {
  return <g transform={`translate(${side === 'left' ? x - h * 0.36 / 2 : x - h * 0.36 / 2}, ${y})`}>
    <BracketSVG side={side} h={h} color={color} bg={bg}/>
  </g>;
}
```

Usage:

```jsx
<MasterSetterLogo variant="stacked" height={96}/>
<MasterSetterLogo variant="inline"  height={28}/>     {/* header */}
<MasterSetterLogo variant="mark"    height={32}/>     {/* favicon-size */}
<MasterSetterLogo variant="mono"    height={64} ink="#07070a" bg="#f4f4f6"/>
```

---

## 7. App icon

iOS / Android icon: solid `--ms-bg`, mark variant centered, lime brackets, white `MS`. No gradient, no inner shadow, no shine. Corner radius handled by the OS mask — your SVG fills the full 1024×1024 square edge-to-edge with safe-area inset of 100px.

---

## 8. Do / Don't

**Do**
- Pair lime with near-black or pure black only
- Keep brackets at full opacity — they are the recognition asset
- Let the wordmark center within the brackets exactly (kern manually if needed)
- Animate the brackets sliding in from the edges + dot pulse on first paint

**Don't**
- Don't change the bracket stroke ratio — it breaks at small sizes
- Don't recolor the center dot
- Don't outline the type
- Don't put the lockup on a busy photo without a solid backplate
- Don't substitute the type — Plex Sans is the only wordmark face

---

## 9. File deliverables (what to ship)

```
/brand/
  master-setter-stacked.svg
  master-setter-inline.svg
  master-setter-mark.svg
  master-setter-mark.png         (1024×1024 — app icon source)
  master-setter-mono.svg
  master-setter-on-light.svg
  favicon.ico                    (mark, 16/32/48)
  apple-touch-icon.png           (mark, 180×180)
  og-image.png                   (1200×630 — stacked, centered on bg)
```

All SVGs reference fonts as outlined paths (use FontForge or Figma "Outline stroke" → "Flatten") so the deliverable doesn't depend on font loading. The React component above keeps live type for in-app use.
