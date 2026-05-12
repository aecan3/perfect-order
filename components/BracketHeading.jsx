export function BracketHeading({ children, className }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35em",
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
      }}
    >
      <BracketMark side="left" />
      <span>{children}</span>
      <BracketMark side="right" />
    </span>
  );
}

function BracketMark({ side }) {
  const h = 28;
  const w = Math.round(h * 0.36);
  const s = Math.max(2, Math.round(h * 0.023));
  const inset = Math.round(w * 0.55);
  const open = side === "left";
  const sx = open ? s / 2 : w - s / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", flexShrink: 0 }}>
      <line x1={open ? inset : w - inset} y1={s / 2} x2={sx} y2={s / 2} stroke="#c8ff4a" strokeWidth={s} strokeLinecap="square"/>
      <line x1={sx} y1={s / 2} x2={sx} y2={h - s / 2} stroke="#c8ff4a" strokeWidth={s}/>
      <line x1={sx} y1={h - s / 2} x2={open ? inset : w - inset} y2={h - s / 2} stroke="#c8ff4a" strokeWidth={s} strokeLinecap="square"/>
      <line x1={sx} y1={h * 0.45} x2={sx} y2={h * 0.55} stroke="#07070a" strokeWidth={s + 2}/>
      <circle cx={sx} cy={h / 2} r={s * 0.9} fill="#c8ff4a"/>
    </svg>
  );
}
