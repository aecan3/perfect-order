// Master Setter — Feed tab + 5-cell tab bar update.
// Lifts tokens, icons, and chrome primitives from nav-chrome.jsx (same project),
// then layers the Feed-specific pieces on top.
//
// What's in this file:
//   1. Three Feed icon options (Pulse, Timeline, Network)
//   2. Updated TabBar5 with 5 cells: Sets · Discover · Feed · Messages · You
//   3. FeedBody — the "coming soon" surface
//   4. FeedScreen — full 390×844 mockup with chrome
//   5. IconOptionsSheet — the comparison card for the canvas
//
// All values match the established design tokens from the Logo Pack + Nav Chrome.

const FT = {
  bg: '#07070a', ink: '#f4f4f6',
  dim: 'rgba(244,244,246,0.60)',
  faint: 'rgba(244,244,246,0.36)',
  rule: 'rgba(244,244,246,0.08)',
  ruleSoft: 'rgba(244,244,246,0.06)',
  accent: '#c8ff4a', accentInk: '#07070a',
  gold: '#FFB830', danger: '#ff5a6a',
  pink: '#f72585', amber: '#f5b942', cyan: '#5fb6ff',
  elev: '#0c0c10',
};
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

// ─── FEED ICON OPTIONS ──────────────────────────────────────────────────────
// All match the established icon system: 22 outer, 2px stroke, rounded joins.

// Option A — Pulse (heartbeat-style)
// Reads as "live activity." Bloomberg-terminal-meets-Pokédex voice.
// Doesn't clash with IconRadar (concentric circles) or IconMsg (bubble).
const IconFeedPulse = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M2 11 H6 L8 5 L11 17 L13 9 L15 11 H20"
      stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Option B — Timeline (three stacked lines of varying length)
// Most literal — "a stream of items." Risk: could read as menu/list.
const IconFeedTimeline = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="4" cy="5" r="1.4" fill={c}/>
    <circle cx="4" cy="11" r="1.4" fill={c}/>
    <circle cx="4" cy="17" r="1.4" fill={c}/>
    <path d="M8 5 H19" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 11 H15" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 17 H17" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Option C — Connected nodes (network / social graph)
// Reads as "your circle." Risk: visually busy at 22px.
const IconFeedNetwork = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M5 5.5 L11 11 L17 5.5 M5 16.5 L11 11 L17 16.5"
      stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="5" cy="5.5" r="2" stroke={c} strokeWidth="2" fill={FT.bg}/>
    <circle cx="17" cy="5.5" r="2" stroke={c} strokeWidth="2" fill={FT.bg}/>
    <circle cx="11" cy="11" r="2" stroke={c} strokeWidth="2" fill={FT.bg}/>
    <circle cx="5" cy="16.5" r="2" stroke={c} strokeWidth="2" fill={FT.bg}/>
    <circle cx="17" cy="16.5" r="2" stroke={c} strokeWidth="2" fill={FT.bg}/>
  </svg>
);

// ─── EXISTING ICONS (lifted from nav-chrome.jsx) ─────────────────────────────
const IconStack = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="3" y="7" width="16" height="12" rx="1.4" stroke={c} strokeWidth="2"/>
    <path d="M5 5h12M6 3h10" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconRadar = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="7.5" stroke={c} strokeWidth="2"/>
    <circle cx="11" cy="11" r="3.5" stroke={c} strokeWidth="2"/>
    <path d="M11 11L18.2 7" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    <circle cx="11" cy="11" r="1.2" fill={c}/>
  </svg>
);
const IconMsg = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M3 6.5A2.5 2.5 0 015.5 4h11A2.5 2.5 0 0119 6.5v7a2.5 2.5 0 01-2.5 2.5H8.5L4.5 19v-3H5.5A2.5 2.5 0 013 13.5z"
      stroke={c} strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);
const IconYou = ({ c = 'currentColor' }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="7.5" r="3.5" stroke={c} strokeWidth="2"/>
    <path d="M4 19c1.6-3.6 4.4-5.4 7-5.4S16.4 15.4 18 19" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconStar = ({ c = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill={c}>
    <path d="M11 2.6L13.5 8.3L19.6 8.9L15 13L16.4 19L11 15.8L5.6 19L7 13L2.4 8.9L8.5 8.3z"
      stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
);
const IconBell = ({ c = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
    <path d="M5.5 16h11l-1.4-2.1V10a4.1 4.1 0 10-8.2 0v3.9L5.5 16z"
      stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M9.4 19a1.8 1.8 0 003.2 0" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

// ─── ACTIVE INDICATOR (bracket-notch variant) ───────────────────────────────
function ActiveIndicator({ width = 50 }) {
  return (
    <svg width={width} height={10} viewBox={`0 0 ${width} 10`}>
      <line x1={1} y1={1} x2={width - 1} y2={1} stroke={FT.accent} strokeWidth={2}/>
      <line x1={1} y1={1} x2={1} y2={5} stroke={FT.accent} strokeWidth={2}/>
      <line x1={width - 1} y1={1} x2={width - 1} y2={5} stroke={FT.accent} strokeWidth={2}/>
    </svg>
  );
}

// ─── UPDATED 5-CELL TAB BAR ─────────────────────────────────────────────────
const TABS_5 = [
  { id: 'sets',     label: 'Sets',     Icon: IconStack },
  { id: 'discover', label: 'Discover', Icon: IconRadar },
  { id: 'feed',     label: 'Feed',     Icon: IconFeedPulse },
  { id: 'messages', label: 'Messages', Icon: IconMsg },
  { id: 'you',      label: 'You',      Icon: IconYou },
];

function TabBar5({ active = 'feed', feedIcon: FeedIconOverride }) {
  // 5 cells in 390px → 78px each. Indicator: cellWidth - 28 = 50px.
  const cellW = 78;
  return (
    <nav aria-label="Primary" style={{
      height: 64, flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      borderTop: `1px solid ${FT.rule}`,
      background: FT.bg,
      backdropFilter: 'saturate(140%) blur(12px)',
      WebkitBackdropFilter: 'saturate(140%) blur(12px)',
      display: 'flex',
    }}>
      {TABS_5.map(t => {
        const on = t.id === active;
        const Icon = (t.id === 'feed' && FeedIconOverride) ? FeedIconOverride : t.Icon;
        const color = on ? FT.accent : FT.dim;
        return (
          <button key={t.id} aria-current={on ? 'page' : undefined} style={{
            flex: 1, height: 64, background: 'transparent', border: 0,
            color, cursor: 'pointer', position: 'relative', padding: 0,
            display: 'inline-flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            {on && (
              <span style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                display: 'inline-flex', justifyContent: 'center',
              }}>
                <ActiveIndicator width={cellW - 28}/>
              </span>
            )}
            <span style={{ display: 'inline-flex', color }}><Icon/></span>
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: on ? 600 : 500,
              letterSpacing: '0.08em', color, textTransform: 'uppercase',
            }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── ICON OPTIONS SHEET ─────────────────────────────────────────────────────
const ICON_OPTIONS = [
  {
    id: 'pulse',  Comp: IconFeedPulse,
    label: 'Pulse',
    recommended: true,
    why: 'Reads "live activity" without being literal. Distinct from radar (concentric circles) and message (bubble). Technical voice matches the brand.',
  },
  {
    id: 'timeline', Comp: IconFeedTimeline,
    label: 'Timeline',
    why: 'Most literal — a stream of items. Risk: could read as a menu / list-view toggle.',
  },
  {
    id: 'network', Comp: IconFeedNetwork,
    label: 'Network',
    why: 'Evokes "your circle." Risk: dense at 22px, and the person silhouette already carries "social" meaning.',
  },
];

function IconOptionsSheet() {
  return (
    <div style={{ width: '100%', height: '100%', padding: 24, background: FT.bg,
      display: 'flex', flexDirection: 'column', gap: 16, color: FT.ink, fontFamily: SANS }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase', display: 'flex', gap: 10, color: FT.dim,
      }}>
        <span style={{ color: FT.accent }}>FEED ICON</span>
        <span>·</span>
        <span>22 / 2PX STROKE / ROUNDED · 3 OPTIONS</span>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 14 }}>
        {ICON_OPTIONS.map(o => {
          const Icon = o.Comp;
          return (
            <div key={o.id} style={{
              flex: 1, position: 'relative',
              border: `1px solid ${o.recommended ? FT.accent : FT.rule}`,
              boxShadow: o.recommended ? `0 0 0 1px ${FT.accent}` : 'none',
              borderRadius: 4, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {o.recommended && (
                <span style={{
                  position: 'absolute', top: -10, left: 12,
                  background: FT.accent, color: FT.accentInk,
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.18em', padding: '3px 7px',
                }}>RECOMMENDED</span>
              )}

              {/* icon row: rest + active */}
              <div style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 22, padding: '8px 0' }}>
                <span style={{ color: FT.dim, display: 'inline-flex', transform: 'scale(1.7)' }}>
                  <Icon/>
                </span>
                <span style={{ width: 1, height: 30, background: FT.rule }}/>
                <span style={{ color: FT.accent, display: 'inline-flex', transform: 'scale(1.7)' }}>
                  <Icon/>
                </span>
              </div>

              <div style={{ borderTop: `1px solid ${FT.rule}`, paddingTop: 10,
                display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ color: FT.ink, fontSize: 13, fontWeight: 600 }}>{o.label}</span>
                <span style={{ color: FT.dim, fontSize: 11, lineHeight: 1.45 }}>{o.why}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB BAR SHEET (5-CELL) ─────────────────────────────────────────────────
function TabBar5Sheet({ feedIcon }) {
  return (
    <div style={{ width: '100%', height: '100%', padding: 24, background: FT.bg,
      display: 'flex', flexDirection: 'column', gap: 18, color: FT.ink, fontFamily: SANS }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase', display: 'flex', gap: 10, color: FT.dim,
      }}>
        <span style={{ color: FT.accent }}>TAB BAR · 5 CELLS</span>
        <span>·</span>
        <span>SETS · DISCOVER · FEED · MESSAGES · YOU</span>
      </div>

      <div style={{
        width: 390, alignSelf: 'center',
        boxShadow: `inset 0 0 0 1px ${FT.rule}`, borderRadius: 4,
      }}>
        <TabBar5 active="feed" feedIcon={feedIcon}/>
      </div>

      <div style={{
        marginTop: 'auto', fontFamily: MONO, fontSize: 9, color: FT.faint,
        letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center',
      }}>
        78PX PER CELL · INDICATOR 50PX · ACTIVE = LIME + BRACKET INDICATOR
      </div>
    </div>
  );
}

// ─── PAGE TITLE (bracket-hairline pattern, lifted from nav-chrome) ──────────
function BracketHairline({ side }) {
  const w = 12, h = 16, c = FT.accent;
  const path = side === 'left'
    ? `M${w-1} 1.5 L1 1.5 L1 ${h-1.5} L${w-1} ${h-1.5}`
    : `M1 1.5 L${w-1} 1.5 L${w-1} ${h-1.5} L1 ${h-1.5}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} stroke={c} strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

function PageTitle({ children, sub }) {
  return (
    <div style={{ padding: '14px 18px 6px' }}>
      {sub && <div style={{
        fontFamily: MONO, fontSize: 10, color: FT.faint,
        letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8,
      }}>{sub}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BracketHairline side="left"/>
        <h1 style={{
          margin: 0, fontFamily: SANS, fontWeight: 700,
          fontSize: 26, letterSpacing: '-0.01em', textTransform: 'uppercase',
          color: FT.ink, lineHeight: 1,
        }}>{children}</h1>
        <BracketHairline side="right"/>
      </div>
    </div>
  );
}

// ─── HEADER (lifted from nav-chrome.jsx) ────────────────────────────────────
function Header({ notifications = 0 }) {
  return (
    <header style={{
      height: 52, padding: '0 16px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: FT.bg, position: 'relative',
    }}>
      <div style={{
        height: 28, width: 110,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1px dashed ${FT.faint}`, borderRadius: 2,
        color: FT.faint, fontFamily: MONO, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.16em',
      }}>LOGO 110×28</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button aria-label="Favourites" style={hdrBtn}>
          <span style={{ color: FT.gold, display: 'inline-flex' }}><IconStar/></span>
        </button>
        <button aria-label="Notifications" style={hdrBtn}>
          <span style={{ color: FT.dim, display: 'inline-flex', position: 'relative' }}>
            <IconBell/>
            {notifications > 0 && (
              <span style={{
                position: 'absolute', top: -1, right: -1,
                width: 8, height: 8, borderRadius: 999,
                background: FT.danger, boxShadow: `0 0 0 2px ${FT.bg}`,
              }}/>
            )}
          </span>
        </button>
      </div>
    </header>
  );
}
const hdrBtn = {
  width: 40, height: 40, borderRadius: 4, background: 'transparent', border: 0,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, color: 'inherit',
};

// ─── FEED PREVIEW CARDS ─────────────────────────────────────────────────────
// Three example feed cards using the established set-card visual language.
// Each card is sized to fit comfortably inside the 390px viewport.

function Avatar({ size = 28, initial, tone = FT.accent, ink = FT.accentInk }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 4, flexShrink: 0,
      background: tone, color: ink,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SANS, fontWeight: 700,
      fontSize: Math.round(size * 0.45), letterSpacing: '-0.02em',
    }}>{initial}</div>
  );
}

function FeedCard({ children, tone = FT.accent, faded = false }) {
  return (
    <div style={{
      position: 'relative', background: FT.elev,
      borderRadius: 4, border: `1px solid ${FT.rule}`,
      overflow: 'hidden', opacity: faded ? 0.85 : 1,
    }}>
      {/* top-edge tone glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: tone, boxShadow: `0 0 14px ${tone}`,
      }}/>
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 56,
        background: `linear-gradient(180deg, ${tone}14, transparent)`,
        pointerEvents: 'none',
      }}/>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

// Card 1 — set started (with duplicate-match call-out)
function CardSetStarted() {
  return (
    <FeedCard tone={FT.cyan}>
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={28} initial="S" tone={FT.cyan} ink="#06121a"/>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: FT.faint,
            letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>@sarah · STARTED · 2H</span>
        </div>
        <div style={{
          marginTop: 8, fontFamily: SANS, fontWeight: 700,
          fontSize: 16, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1.2,
        }}>Sarah started Black Bolt</div>
        <div style={{
          marginTop: 4, fontFamily: MONO, fontSize: 9, color: FT.dim,
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>SCARLET & VIOLET · 178 CARDS</div>
      </div>
      {/* duplicate-match call-out — the killer mechanic */}
      <div style={{
        padding: '10px 14px 12px',
        borderTop: `1px solid ${FT.rule}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: FT.accent,
            letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
          }}>DUPLICATE MATCH</span>
          <span style={{
            fontFamily: SANS, fontWeight: 500, fontSize: 13,
            color: FT.ink, letterSpacing: '-0.005em',
          }}>You have 12 of her missing cards</span>
        </div>
        <span style={{
          fontFamily: MONO, fontWeight: 700, fontSize: 18,
          color: FT.accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        }}>12</span>
      </div>
    </FeedCard>
  );
}

// Card 2 — set completed (MASTER chip, big numerals, no progress bar)
function CardSetCompleted() {
  return (
    <FeedCard tone={FT.accent}>
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={28} initial="A"/>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: FT.faint,
            letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>@alex · COMPLETED · 14H</span>
        </div>
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: SANS, fontWeight: 700,
            fontSize: 16, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1.2,
          }}>Alex completed Perfect Order</span>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: FT.accent,
            letterSpacing: '0.18em', fontWeight: 700,
          }}>MASTER</span>
        </div>
        <div style={{
          marginTop: 4, fontFamily: MONO, fontSize: 9, color: FT.dim,
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>MEGA EVOLUTION</div>

        <div style={{
          marginTop: 12, display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontFamily: SANS, fontWeight: 700, fontSize: 28, color: FT.ink,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1,
            }}>124</span>
            <span style={{ color: FT.faint, fontSize: 14,
              fontVariantNumeric: 'tabular-nums' }}>/ 124</span>
          </div>
          <div style={{
            fontFamily: MONO, fontWeight: 700, fontSize: 16,
            color: FT.accent, fontVariantNumeric: 'tabular-nums',
          }}>A$4,210</div>
        </div>
      </div>
    </FeedCard>
  );
}

// Card 3 — social proof (3 friends collecting, overlapped avatars)
function CardSocialProof() {
  const friends = [
    { initial: 'R', tone: FT.pink, ink: '#1a0510' },
    { initial: 'K', tone: FT.amber, ink: '#1a1206' },
    { initial: 'S', tone: FT.cyan, ink: '#06121a' },
  ];
  return (
    <FeedCard tone={FT.amber}>
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {friends.map((f, i) => (
              <div key={i} style={{
                marginLeft: i === 0 ? 0 : -8,
                boxShadow: `0 0 0 2px ${FT.elev}`,
                borderRadius: 4,
              }}>
                <Avatar {...f}/>
              </div>
            ))}
          </div>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: FT.faint,
            letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>TRENDING · 3 IN YOUR CIRCLE</span>
        </div>
        <div style={{
          marginTop: 10, fontFamily: SANS, fontWeight: 700,
          fontSize: 16, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1.2,
        }}>3 friends are collecting Destined Rivals</div>
        <div style={{
          marginTop: 4, fontFamily: MONO, fontSize: 9, color: FT.dim,
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>SCARLET & VIOLET · 244 CARDS</div>
      </div>
      <div style={{
        padding: '10px 14px 12px',
        borderTop: `1px solid ${FT.rule}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: FT.accent,
            letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
          }}>YOUR DUPLICATES</span>
          <span style={{
            fontFamily: SANS, fontWeight: 500, fontSize: 13,
            color: FT.ink, letterSpacing: '-0.005em',
          }}>Could help 2 of them</span>
        </div>
        <span style={{
          fontFamily: MONO, fontWeight: 700, fontSize: 18,
          color: FT.accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        }}>27</span>
      </div>
    </FeedCard>
  );
}

// ─── FEED BODY (the "coming soon" surface) ──────────────────────────────────
function FeedBody() {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <PageTitle sub="COMING SOON · IN DEVELOPMENT">Feed</PageTitle>

      {/* Statement of intent — one line, IBM Plex Sans 600 ~17px */}
      <div style={{ padding: '16px 18px 22px' }}>
        <p style={{
          margin: 0, fontFamily: SANS, fontWeight: 500,
          fontSize: 17, color: FT.ink,
          letterSpacing: '-0.005em', lineHeight: 1.4,
          textWrap: 'pretty',
        }}>
          See what your circle is collecting.
          See who can finish your sets.
        </p>
      </div>

      {/* PREVIEW container — dashed border, [ PREVIEW ] label above */}
      <div style={{ position: 'relative', marginTop: 2 }}>
        <div style={{
          position: 'absolute', top: -8, left: 14,
          background: FT.bg, padding: '0 8px', zIndex: 1,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <BracketHairline side="left"/>
          <span style={{
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            color: FT.faint, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>Preview</span>
          <BracketHairline side="right"/>
        </div>
        <div style={{
          border: `1px dashed ${FT.faint}`, borderRadius: 4,
          padding: '20px 14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <CardSetStarted/>
          <CardSetCompleted/>
          <CardSocialProof/>
        </div>
      </div>

      {/* Closing line */}
      <div style={{
        marginTop: 20, padding: '14px 0 8px',
        textAlign: 'center',
        fontFamily: MONO, fontSize: 10, fontWeight: 500,
        color: FT.faint, letterSpacing: '0.2em', textTransform: 'uppercase',
      }}>
        IN DEVELOPMENT · MAY 2026
      </div>
    </div>
  );
}

// ─── FULL FEED SCREEN ───────────────────────────────────────────────────────
function FeedScreen({ feedIcon }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: FT.bg, color: FT.ink,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: SANS,
    }}>
      {/* Status bar mock (44px) */}
      <div style={{
        height: 44, padding: '0 24px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: FT.bg,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: FT.ink }}>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: FT.ink }}>
          <svg width="17" height="11" viewBox="0 0 17 11">
            <rect x="0" y="6" width="3" height="5" rx="0.5" fill="currentColor"/>
            <rect x="4.5" y="4" width="3" height="7" rx="0.5" fill="currentColor"/>
            <rect x="9" y="2" width="3" height="9" rx="0.5" fill="currentColor"/>
            <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="currentColor"/>
          </svg>
          <svg width="15" height="11" viewBox="0 0 15 11">
            <path d="M7.5 1C4.7 1 2.2 2 0.3 3.7l1.2 1.2A8.4 8.4 0 017.5 2.6 8.4 8.4 0 0113.5 4.9l1.2-1.2A11.4 11.4 0 007.5 1z" fill="currentColor"/>
            <path d="M7.5 4.5A6 6 0 003.3 6.1l1.2 1.2a4.3 4.3 0 016 0l1.2-1.2A6 6 0 007.5 4.5z" fill="currentColor"/>
            <circle cx="7.5" cy="9" r="1.5" fill="currentColor"/>
          </svg>
          <svg width="25" height="11" viewBox="0 0 25 11">
            <rect x="0.5" y="0.5" width="22" height="10" rx="2.5" stroke="currentColor" strokeOpacity="0.4" fill="none"/>
            <rect x="2" y="2" width="18" height="7" rx="1" fill="currentColor"/>
            <rect x="23" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" fillOpacity="0.4"/>
          </svg>
        </div>
      </div>

      <Header notifications={2}/>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <FeedBody/>
      </div>

      <TabBar5 active="feed" feedIcon={feedIcon}/>

      <div style={{
        height: 8, background: FT.bg,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{
          width: 139, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.5)',
        }}/>
      </div>
    </div>
  );
}

// ─── COPY & JUSTIFICATION PANEL ─────────────────────────────────────────────
function NotesPanel() {
  const notes = [
    { h: 'ICON · PULSE',
      b: 'Reads "live activity" without literally drawing a megaphone, bell, or newspaper. Distinct from IconRadar (concentric arcs) and IconYou (silhouette). Matches the technical/terminal voice the brand already speaks.' },
    { h: 'PREVIEW TREATMENT · DASHED CONTAINER',
      b: 'Picks up the existing dashed-outline language (the "+ ADD A SET" button). An opacity drop alone would just look like a rendering bug; the dashed border plus [ PREVIEW ] label is unmistakably "not live data" and reinforces the system.' },
    { h: 'SUBTITLE · "COMING SOON · IN DEVELOPMENT"',
      b: 'Honest, factual, no implied promise. "BUILDING NOW" was the placeholder — "IN DEVELOPMENT" carries the same weight without the marketing tilt.' },
    { h: 'STATEMENT · TWO HALF-LINES',
      b: '"See what your circle is collecting. See who can finish your sets." — declarative, parallel, ends on the killer mechanic (duplicate matching). Avoids brochure-speak like "place to see."' },
    { h: 'DUPLICATE-MATCH CALL-OUT',
      b: 'Surfaced on two of three preview cards as a divided lower section. This is THE feature; the cards earn their place by demonstrating it. Number stays in mono tabular for instant scanning.' },
    { h: 'AVATARS · SQUARED + TONED',
      b: 'Reuses the 4-radius square avatar primitive at 28px. Tone matches the set\'s tone color so a Sarah/Black Bolt pairing reads as cyan, not generic lime. The Alex/Perfect Order pairing IS lime because Perfect Order\'s tone is lime — coincidence, not exception.' },
    { h: 'CLOSING LINE · "IN DEVELOPMENT · MAY 2026"',
      b: 'Dated, honest, mono. Drops the "check back soon" softness the brief suggested. Collectors are detail-oriented — they get a date, not a promise.' },
    { h: 'NO CTA, NO NOTIFY-ME',
      b: 'Per brief. User is in the app; if they care they\'ll check back. Adding a CTA would dilute the "this is the empty state" intent.' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', padding: 24, background: FT.bg,
      display: 'flex', flexDirection: 'column', gap: 12, color: FT.ink, fontFamily: SANS,
      overflow: 'hidden',
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase', display: 'flex', gap: 10, color: FT.dim, flexShrink: 0,
      }}>
        <span style={{ color: FT.accent }}>NOTES</span>
        <span>·</span>
        <span>JUSTIFICATIONS · ONE LINE EACH</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, overflow: 'auto', minHeight: 0 }}>
        {notes.map(n => (
          <div key={n.h} style={{
            padding: 14, border: `1px solid ${FT.rule}`, borderRadius: 4,
            background: FT.elev,
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700, color: FT.accent,
              letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6,
            }}>{n.h}</div>
            <div style={{
              fontFamily: SANS, fontSize: 12, color: FT.dim, lineHeight: 1.5,
              textWrap: 'pretty',
            }}>{n.b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  FeedScreen, IconOptionsSheet, TabBar5Sheet, NotesPanel,
  IconFeedPulse, IconFeedTimeline, IconFeedNetwork,
});
