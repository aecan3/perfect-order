function BracketHairline({ side }) {
  const w = 12, h = 16;
  const path = side === "left"
    ? `M${w - 1} 1.5 L1 1.5 L1 ${h - 1.5} L${w - 1} ${h - 1.5}`
    : `M1 1.5 L${w - 1} 1.5 L${w - 1} ${h - 1.5} L1 ${h - 1.5}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={path} stroke="var(--ms-accent)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function MSPageTitle({ children, sub }) {
  return (
    <div style={{ padding: "14px 18px 6px" }}>
      {sub && (
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 10,
          color: "var(--ms-faint)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}>
          {sub}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BracketHairline side="left" />
        <h1 style={{
          margin: 0,
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          color: "var(--ms-ink)",
          lineHeight: 1,
        }}>
          {children}
        </h1>
        <BracketHairline side="right" />
      </div>
    </div>
  );
}
