// Master Setter — Navigation chrome (bottom tab bar + top header)
// shown across 3 screens. Tokens from the Logo Pack.

const NC = {
  bg: '#07070a', ink: '#f4f4f6',
  dim: 'rgba(244,244,246,0.60)',
  faint: 'rgba(244,244,246,0.36)',
  rule: 'rgba(244,244,246,0.08)',
  ruleSoft: 'rgba(244,244,246,0.06)',
  accent: '#c8ff4a', accentInk: '#07070a',
  gold: '#FFB830', danger: '#ff5a6a',
  pink: '#f72585', amber: '#f5b942',
};
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

// ─── ICONS ──────────────────────────────────────────────────────────────────
// 22px outer, 2px stroke, rounded joins. `c` recolors without re-render.
const Svg = ({ children, s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 22 22" fill="none">{children}</svg>
);

const IconStack = ({ c = 'currentColor' }) => (
  <Svg>
    <rect x="3" y="7" width="16" height="12" rx="1.4" stroke={c} strokeWidth="2"/>
    <path d="M5 5h12M6 3h10" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);
const IconGrid = ({ c = 'currentColor' }) => (
  <Svg>
    <rect x="3"  y="3"  width="5" height="5" rx="0.6" stroke={c} strokeWidth="2"/>
    <rect x="3"  y="14" width="5" height="5" rx="0.6" stroke={c} strokeWidth="2"/>
    <rect x="14" y="3"  width="5" height="5" rx="0.6" stroke={c} strokeWidth="2"/>
    <rect x="14" y="14" width="5" height="5" rx="0.6" stroke={c} strokeWidth="2"/>
    <rect x="8.5" y="8.5" width="5" height="5" rx="0.6" stroke={c} strokeWidth="2"/>
  </Svg>
);
const IconBinder = ({ c = 'currentColor' }) => (
  <Svg>
    <path d="M4 4a1 1 0 011-1h12a1 1 0 011 1v15l-2.5-1.6L13 19l-2-1.6L9 19l-2.5-1.6L4 19V4z"
      stroke={c} strokeWidth="2" strokeLinejoin="round"/>
    <path d="M8 6v6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);
const IconRadar = ({ c = 'currentColor' }) => (
  <Svg>
    <circle cx="11" cy="11" r="7.5" stroke={c} strokeWidth="2"/>
    <circle cx="11" cy="11" r="3.5" stroke={c} strokeWidth="2"/>
    <path d="M11 11L18.2 7" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    <circle cx="11" cy="11" r="1.2" fill={c}/>
  </Svg>
);
const IconCompass = ({ c = 'currentColor' }) => (
  <Svg>
    <circle cx="11" cy="11" r="8" stroke={c} strokeWidth="2"/>
    <path d="M14.8 7.2L12 12.4L6.8 14.8L9.6 9.6z" stroke={c} strokeWidth="2" strokeLinejoin="round"/>
  </Svg>
);
const IconSpark = ({ c = 'currentColor' }) => (
  <Svg>
    <path d="M11 2.5L12.7 8.3L18.5 10L12.7 11.7L11 17.5L9.3 11.7L3.5 10L9.3 8.3z"
      stroke={c} strokeWidth="2" strokeLinejoin="round"/>
  </Svg>
);
const IconMsg = ({ c = 'currentColor' }) => (
  <Svg>
    <path d="M3 6.5A2.5 2.5 0 015.5 4h11A2.5 2.5 0 0119 6.5v7a2.5 2.5 0 01-2.5 2.5H8.5L4.5 19v-3H5.5A2.5 2.5 0 013 13.5z"
      stroke={c} strokeWidth="2" strokeLinejoin="round"/>
  </Svg>
);
const IconYou = ({ c = 'currentColor' }) => (
  <Svg>
    <circle cx="11" cy="7.5" r="3.5" stroke={c} strokeWidth="2"/>
    <path d="M4 19c1.6-3.6 4.4-5.4 7-5.4S16.4 15.4 18 19" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </Svg>
);
const IconStar = ({ c = 'currentColor', s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 22 22" fill={c}>
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
const IconHeart = ({ c = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
    <path d="M11 18.5C5 14.5 3 11.5 3 8.5A4 4 0 0111 6A4 4 0 0119 8.5C19 11.5 17 14.5 11 18.5z"
      stroke={c} strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);
const IconFriends = ({ c = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
    <circle cx="8" cy="8" r="3" stroke={c} strokeWidth="1.8"/>
    <path d="M2.5 18c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="15.5" cy="6.5" r="2.5" stroke={c} strokeWidth="1.6"/>
    <path d="M14 12.5c2.7 0 5 1.4 5.5 4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconSettings = ({ c = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="2.4" stroke={c} strokeWidth="1.8"/>
    <path d="M11 2.5v2.4M11 17.1v2.4M2.5 11h2.4M17.1 11h2.4M5 5l1.7 1.7M15.3 15.3L17 17M5 17l1.7-1.7M15.3 6.7L17 5"
      stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IconLogout = ({ c = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
    <path d="M9 4H6a2 2 0 00-2 2v10a2 2 0 002 2h3M13.5 7.5L17 11l-3.5 3.5M9 11h7.5"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChev = ({ c = 'currentColor' }) => (
  <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
    <path d="M8 5l6 6-6 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconPlus = ({ c = 'currentColor' }) => (
  <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
    <path d="M11 4v14M4 11h14" stroke={c} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// ─── Icon options sheet ─────────────────────────────────────────────────────
function IconSheet({ title, options, family }) {
  const map = {
    sets:     { stack: IconStack, grid: IconGrid, binder: IconBinder },
    discover: { radar: IconRadar, compass: IconCompass, spark: IconSpark },
  }[family];
  return (
    <Sheet title={title} note="22 / 2px stroke / rounded joins">
      <div style={{ flex: 1, display: 'flex', gap: 14 }}>
        {options.map(opt => {
          const I = map[opt.id];
          return (
            <OptionCard key={opt.id} label={opt.label} recommended={opt.recommended}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <span style={{ color: NC.dim, display: 'inline-flex', transform: 'scale(1.7)' }}><I/></span>
                <span style={{ width: 1, height: 30, background: NC.rule }}/>
                <span style={{ color: NC.accent, display: 'inline-flex', transform: 'scale(1.7)' }}><I/></span>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, color: NC.faint,
                letterSpacing: '0.18em', textTransform: 'uppercase' }}>REST · ACTIVE</span>
            </OptionCard>
          );
        })}
      </div>
    </Sheet>
  );
}

function Sheet({ title, note, children }) {
  return (
    <div style={{ width: '100%', height: '100%', padding: 24, background: NC.bg,
      display: 'flex', flexDirection: 'column', gap: 16, color: NC.ink, fontFamily: SANS }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase', display: 'flex', gap: 10, color: NC.dim }}>
        <span style={{ color: NC.accent }}>{title}</span>
        <span>·</span>
        <span>{note}</span>
      </div>
      {children}
    </div>
  );
}

function OptionCard({ label, recommended, children }) {
  return (
    <div style={{
      flex: 1, position: 'relative',
      border: `1px solid ${recommended ? NC.accent : NC.rule}`,
      boxShadow: recommended ? `0 0 0 1px ${NC.accent}` : 'none',
      borderRadius: 4, padding: 18,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14,
    }}>
      {recommended && (
        <span style={{
          position: 'absolute', top: -10, left: 12,
          background: NC.accent, color: NC.accentInk,
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: '0.18em', padding: '3px 7px',
        }}>RECOMMENDED</span>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
        {children[0]}
      </div>
      <div style={{ borderTop: `1px solid ${NC.rule}`, paddingTop: 10,
        display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: NC.ink, fontSize: 13, fontWeight: 600 }}>{label}</span>
        {children[1]}
      </div>
    </div>
  );
}

// ─── Active-tab indicator ───────────────────────────────────────────────────
function ActiveIndicator({ kind = 'A', width = 96 }) {
  const stroke = 2;
  const c = NC.accent;
  if (kind === 'A') {
    // full line with inward bracket notches
    return (
      <svg width={width} height={10} viewBox={`0 0 ${width} 10`}>
        <line x1={1} y1={1} x2={width - 1} y2={1} stroke={c} strokeWidth={stroke}/>
        <line x1={1} y1={1} x2={1} y2={5} stroke={c} strokeWidth={stroke}/>
        <line x1={width - 1} y1={1} x2={width - 1} y2={5} stroke={c} strokeWidth={stroke}/>
      </svg>
    );
  }
  if (kind === 'B') {
    const w = width * 0.46, x = (width - w) / 2;
    return (
      <svg width={width} height={10} viewBox={`0 0 ${width} 10`}>
        <line x1={x} y1={1} x2={x + w} y2={1} stroke={c} strokeWidth={stroke}/>
        <line x1={x} y1={1} x2={x} y2={5} stroke={c} strokeWidth={stroke}/>
        <line x1={x + w} y1={1} x2={x + w} y2={5} stroke={c} strokeWidth={stroke}/>
      </svg>
    );
  }
  return (
    <svg width={width} height={10} viewBox={`0 0 ${width} 10`}>
      <line x1={1} y1={1} x2={width - 1} y2={1} stroke={c} strokeWidth={stroke}/>
    </svg>
  );
}

function ActiveIndicatorSheet() {
  const opts = [
    { k: 'A', t: 'Bracket A · full + notches', r: true },
    { k: 'B', t: 'Bracket B · short + notches' },
    { k: 'C', t: 'Plain underline' },
  ];
  return (
    <Sheet title="ACTIVE INDICATOR" note="TOP EDGE OF TAB CELL · LIME 2PX">
      <div style={{ flex: 1, display: 'flex', gap: 14 }}>
        {opts.map(o => (
          <OptionCard key={o.k} label={o.t} recommended={o.r}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <ActiveIndicator kind={o.k} width={130}/>
              <span style={{ color: NC.accent, display: 'inline-flex' }}><IconStack/></span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: NC.accent,
                letterSpacing: '0.08em', fontWeight: 600 }}>SETS</span>
            </div>
            <span></span>
          </OptionCard>
        ))}
      </div>
    </Sheet>
  );
}

// ─── HEADER ─────────────────────────────────────────────────────────────────
function Header({ notifications = 0, scrolled = false }) {
  return (
    <header style={{
      height: 52, padding: '0 16px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: NC.bg, position: 'relative',
      borderBottom: `1px solid ${scrolled ? NC.rule : 'transparent'}`,
      transition: 'border-color 200ms',
    }}>
      {/* LOGO placeholder — real <MasterSetterLogo variant="inline" height={28}/> slots in here */}
      <div style={{
        height: 28, width: 110,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1px dashed ${NC.faint}`, borderRadius: 2,
        color: NC.faint, fontFamily: MONO, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.16em',
      }}>LOGO 110×28</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <HeaderBtn aria-label="Favourites">
          <span style={{ color: NC.gold, display: 'inline-flex' }}><IconStar/></span>
        </HeaderBtn>
        <HeaderBtn aria-label="Notifications">
          <span style={{ color: NC.dim, display: 'inline-flex', position: 'relative' }}>
            <IconBell/>
            {notifications > 0 && (
              <span style={{
                position: 'absolute', top: -1, right: -1,
                width: 8, height: 8, borderRadius: 999,
                background: NC.danger,
                boxShadow: `0 0 0 2px ${NC.bg}`,
              }}/>
            )}
          </span>
        </HeaderBtn>
      </div>
    </header>
  );
}

function HeaderBtn({ children, ...rest }) {
  return (
    <button {...rest} style={{
      width: 40, height: 40, borderRadius: 4,
      background: 'transparent', border: 0, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: 0, color: 'inherit',
    }}>{children}</button>
  );
}

// ─── TAB BAR ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'sets',     label: 'Sets',     Icon: IconStack },
  { id: 'discover', label: 'Discover', Icon: IconRadar },
  { id: 'messages', label: 'Messages', Icon: IconMsg },
  { id: 'you',      label: 'You',      Icon: IconYou },
];

function TabBar({ active = 'sets', cellWidth = 90 }) {
  return (
    <nav aria-label="Primary" style={{
      height: 64, flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      borderTop: `1px solid ${NC.rule}`,
      background: NC.bg,
      backdropFilter: 'saturate(140%) blur(12px)',
      WebkitBackdropFilter: 'saturate(140%) blur(12px)',
      display: 'flex',
    }}>
      {TABS.map(t => {
        const on = t.id === active;
        const Icon = t.Icon;
        const color = on ? NC.accent : NC.dim;
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
                <ActiveIndicator kind="A" width={cellWidth - 28}/>
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

function TabBarSheet() {
  return (
    <Sheet title="TAB BAR" note="4 CELLS · 64PX + SAFE-AREA-INSET-BOTTOM">
      <div style={{
        width: 390, alignSelf: 'center',
        boxShadow: `inset 0 0 0 1px ${NC.rule}`, borderRadius: 4,
      }}>
        <TabBar active="sets" cellWidth={97}/>
      </div>
      <div style={{
        marginTop: 'auto',
        fontFamily: MONO, fontSize: 9, color: NC.faint,
        letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center',
      }}>
        ICON 22 · STROKE 2 · LABEL 9PX MONO 0.08EM · ACTIVE = LIME + BRACKET INDICATOR
      </div>
    </Sheet>
  );
}

// ─── PAGE TITLE (bracket hairline heading) ──────────────────────────────────
function BracketHairline({ side }) {
  const w = 12, h = 16, c = NC.accent;
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
        fontFamily: MONO, fontSize: 10, color: NC.faint,
        letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8,
      }}>{sub}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BracketHairline side="left"/>
        <h1 style={{
          margin: 0, fontFamily: SANS, fontWeight: 700,
          fontSize: 26, letterSpacing: '-0.01em', textTransform: 'uppercase',
          color: NC.ink, lineHeight: 1,
        }}>{children}</h1>
        <BracketHairline side="right"/>
      </div>
    </div>
  );
}

// ─── SCREEN A · SETS ────────────────────────────────────────────────────────
const SETS = [
  { name: 'Paldea Evolved',      series: 'SCARLET & VIOLET', owned: 399, total: 399, value: 4036, tone: NC.accent },
  { name: 'Twilight Masquerade', series: 'SCARLET & VIOLET', owned: 370, total: 373, value: 2106, tone: NC.pink },
  { name: 'Crown Zenith',        series: 'SWORD & SHIELD',    owned: 162, total: 230, value: 1245, tone: NC.amber },
];

function SetCard({ s }) {
  const pct = (s.owned / s.total) * 100;
  const complete = pct === 100;
  return (
    <div style={{
      position: 'relative', background: '#0c0c10',
      borderRadius: 4, padding: '14px 14px 12px',
      border: `1px solid ${NC.rule}`, overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: s.tone, boxShadow: `0 0 14px ${s.tone}`,
      }}/>
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(180deg, ${s.tone}14, transparent)`,
        pointerEvents: 'none',
      }}/>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 4,
          background: '#15151a', boxShadow: `inset 0 0 0 1px ${NC.rule}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: s.tone, flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 3L19 7.5L11 12L3 7.5z M3 14L11 18.5L19 14"
              stroke={s.tone} strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: NC.faint,
            letterSpacing: '0.2em', textTransform: 'uppercase' }}>{s.series}</div>
          <div style={{
            marginTop: 4, fontFamily: SANS, fontWeight: 700,
            fontSize: 17, color: NC.ink, letterSpacing: '-0.01em', lineHeight: 1.1,
          }}>{s.name}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: SANS, fontWeight: 700, fontSize: 24, color: NC.ink,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1,
          }}>{s.owned}</span>
          <span style={{ color: NC.faint, fontSize: 13,
            fontVariantNumeric: 'tabular-nums' }}>/ {s.total}</span>
          {complete && (
            <span style={{
              marginLeft: 6, fontFamily: MONO, fontSize: 9, color: NC.accent,
              letterSpacing: '0.18em', fontWeight: 700,
            }}>MASTER</span>
          )}
        </div>
        <div style={{
          fontFamily: MONO, fontWeight: 700, fontSize: 16,
          color: s.tone, fontVariantNumeric: 'tabular-nums',
        }}>A${s.value.toLocaleString()}</div>
      </div>
      <div style={{ marginTop: 10, height: 2, background: NC.ruleSoft, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: s.tone,
          boxShadow: `0 0 8px ${s.tone}` }}/>
      </div>
    </div>
  );
}

function SetsBody() {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <PageTitle sub="@alex · 12 SETS · A$35,618">My Sets</PageTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {SETS.map(s => <SetCard key={s.name} s={s}/>)}
      </div>
      <button style={{
        marginTop: 12, width: '100%', height: 50,
        background: 'transparent', border: `1px dashed ${NC.faint}`,
        borderRadius: 4, color: NC.dim, cursor: 'pointer',
        fontFamily: MONO, fontWeight: 600, fontSize: 11,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}><IconPlus/> Add a set</button>
    </div>
  );
}

// ─── SCREEN B · DISCOVER ────────────────────────────────────────────────────
const DISCOVER_CARDS = [
  { user: 'raffertydall', num: '042', price: 22.40, hueA: 320, hueB: 200 },
  { user: 'kenzo.tcg',    num: '188', price: 78.10, hueA: 280, hueB: 60  },
  { user: 'alex2',        num: '012', price: 41.20, hueA: 50,  hueB: 180 },
  { user: 'raffertydall', num: '073', price: 3.80,  hueA: 30,  hueB: 340 },
  { user: 'kenzo.tcg',    num: '114', price: 18.90, hueA: 100, hueB: 300 },
  { user: 'alex2',        num: '028', price: 5.40,  hueA: 200, hueB: 280 },
  { user: 'raffertydall', num: '156', price: 9.20,  hueA: 0,   hueB: 220 },
  { user: 'kenzo.tcg',    num: '201', price: 31.00, hueA: 160, hueB: 40  },
  { user: 'alex2',        num: '066', price: 4.50,  hueA: 240, hueB: 30  },
];

function DiscoverBody() {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '18px 0 14px', display: 'flex',
        alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, padding: '4px 7px', borderRadius: 2,
          background: NC.accent, color: NC.accentInk, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>NEW</span>
        <span style={{
          fontFamily: MONO, fontSize: 11, color: NC.accent,
          letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
        }}>DISCOVER — 12 CARDS YOUR FRIENDS HAVE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {DISCOVER_CARDS.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              aspectRatio: '63/88', borderRadius: 3,
              border: `1px solid ${NC.accent}55`,
              background: `linear-gradient(135deg, hsl(${c.hueA} 55% 26%), hsl(${c.hueB} 50% 14%))`,
              position: 'relative', overflow: 'hidden',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            }}>
              <div style={{
                position: 'absolute', bottom: 5, left: 5,
                background: 'rgba(0,0,0,0.7)', padding: '2px 5px', borderRadius: 2,
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: NC.ink, letterSpacing: '0.1em',
              }}>#{c.num}</div>
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 9, color: NC.dim,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>@{c.user}</div>
            <div style={{
              fontFamily: MONO, fontWeight: 700, fontSize: 13, color: NC.accent,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
            }}>A${c.price.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCREEN C · YOU ─────────────────────────────────────────────────────────
function YouBody() {
  const rows = [
    { id: 'profile',  Icon: IconYou,      label: 'Profile' },
    { id: 'favs',     Icon: IconHeart,    label: 'Favourites', hint: '24' },
    { id: 'friends',  Icon: IconFriends,  label: 'Friends',    hint: '8' },
    { id: 'settings', Icon: IconSettings, label: 'Settings' },
    { id: 'signout',  Icon: IconLogout,   label: 'Sign out', danger: true },
  ];
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '18px 0 14px' }}>
        <div style={{
          padding: '16px', borderRadius: 4,
          background: '#0c0c10', border: `1px solid ${NC.rule}`,
          display: 'flex', alignItems: 'center', gap: 14,
          position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: NC.accent, boxShadow: `0 0 14px ${NC.accent}`,
          }}/>
          <div style={{
            width: 52, height: 52, borderRadius: 4,
            background: NC.accent, color: NC.accentInk,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SANS, fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em',
          }}>AX</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{
                fontFamily: SANS, fontWeight: 700, fontSize: 18, color: NC.ink,
                letterSpacing: '-0.01em',
              }}>@alex</span>
              <span style={{
                fontFamily: MONO, fontSize: 10, color: NC.accent,
                letterSpacing: '0.18em', fontWeight: 600, cursor: 'pointer',
                textTransform: 'uppercase',
              }}>EDIT</span>
            </div>
            <div style={{
              marginTop: 4, fontFamily: MONO, fontSize: 10, color: NC.dim,
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>12 SETS · 3 GRAND MASTERS · 247 CARDS</div>
          </div>
        </div>
      </div>

      <div style={{
        fontFamily: MONO, fontSize: 10, color: NC.faint,
        letterSpacing: '0.2em', textTransform: 'uppercase', padding: '6px 4px',
      }}>ACCOUNT</div>

      <div style={{ marginTop: 4 }}>
        {rows.map((r, i) => {
          const Icon = r.Icon;
          const color = r.danger ? NC.danger : NC.ink;
          const iconColor = r.danger ? NC.danger : NC.dim;
          return (
            <button key={r.id} style={{
              width: '100%', padding: '16px 4px', background: 'transparent',
              border: 0,
              borderBottom: i < rows.length - 1 ? `1px solid ${NC.ruleSoft}` : 'none',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, color,
              textAlign: 'left',
            }}>
              <span style={{ display: 'inline-flex', color: iconColor }}><Icon/></span>
              <span style={{
                flex: 1, fontFamily: SANS, fontWeight: 500, fontSize: 15,
                letterSpacing: '-0.005em',
              }}>{r.label}</span>
              {r.hint && (
                <span style={{
                  fontFamily: MONO, fontSize: 12, color: NC.faint,
                  fontVariantNumeric: 'tabular-nums',
                }}>{r.hint}</span>
              )}
              {!r.danger && <span style={{ color: NC.faint, display: 'inline-flex' }}><IconChev/></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SCREEN WRAPPER ─────────────────────────────────────────────────────────
function Screen({ tab = 'sets', notifications = 0, headerOnly = false, scrolled = false }) {
  if (headerOnly) {
    return (
      <div style={{ width: '100%', height: '100%', background: NC.bg,
        display: 'flex', flexDirection: 'column', fontFamily: SANS, color: NC.ink }}>
        <Header notifications={notifications} scrolled={scrolled}/>
        {scrolled && (
          <div style={{
            padding: '16px', fontFamily: MONO, fontSize: 10,
            color: NC.faint, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>(SCROLLED CONTENT BELOW)</div>
        )}
      </div>
    );
  }

  let body = null;
  if (tab === 'sets')          body = <SetsBody/>;
  else if (tab === 'discover') body = <DiscoverBody/>;
  else                          body = <YouBody/>;

  return (
    <div style={{
      width: '100%', height: '100%', background: NC.bg, color: NC.ink,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: SANS,
    }}>
      {/* Status bar mock */}
      <div style={{
        height: 44, padding: '0 24px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: NC.bg,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: NC.ink }}>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: NC.ink }}>
          {/* signal */}
          <svg width="17" height="11" viewBox="0 0 17 11">
            <rect x="0"    y="6" width="3" height="5"  rx="0.5" fill="currentColor"/>
            <rect x="4.5"  y="4" width="3" height="7"  rx="0.5" fill="currentColor"/>
            <rect x="9"    y="2" width="3" height="9"  rx="0.5" fill="currentColor"/>
            <rect x="13.5" y="0" width="3" height="11" rx="0.5" fill="currentColor"/>
          </svg>
          {/* wifi */}
          <svg width="15" height="11" viewBox="0 0 15 11">
            <path d="M7.5 1C4.7 1 2.2 2 0.3 3.7l1.2 1.2A8.4 8.4 0 017.5 2.6 8.4 8.4 0 0113.5 4.9l1.2-1.2A11.4 11.4 0 007.5 1z" fill="currentColor"/>
            <path d="M7.5 4.5A6 6 0 003.3 6.1l1.2 1.2a4.3 4.3 0 016 0l1.2-1.2A6 6 0 007.5 4.5z" fill="currentColor"/>
            <circle cx="7.5" cy="9" r="1.5" fill="currentColor"/>
          </svg>
          {/* battery */}
          <svg width="25" height="11" viewBox="0 0 25 11">
            <rect x="0.5" y="0.5" width="22" height="10" rx="2.5" stroke="currentColor" strokeOpacity="0.4" fill="none"/>
            <rect x="2"   y="2"   width="18" height="7"  rx="1"   fill="currentColor"/>
            <rect x="23"  y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" fillOpacity="0.4"/>
          </svg>
        </div>
      </div>

      <Header notifications={notifications}/>

      {/* Body — fills remaining space and scrolls within */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {body}
      </div>

      <TabBar active={tab}/>

      {/* Home indicator */}
      <div style={{
        height: 8, background: NC.bg,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{
          width: 139, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.5)',
          marginBottom: 0,
        }}/>
      </div>
    </div>
  );
}

Object.assign(window, {
  Screen, IconSheet, ActiveIndicatorSheet, TabBarSheet,
});
