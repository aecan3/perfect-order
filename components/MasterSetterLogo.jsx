// MasterSetterLogo.jsx
export function MasterSetterLogo({
  variant = "stacked",
  height = 64,
  accent = "#c8ff4a",
  ink = "#f4f4f6",
  bg = "#07070a",
  className,
}) {
  if (variant === "mark") {
    const s = height;
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" className={className}
           xmlns="http://www.w3.org/2000/svg">
        <Bracket side="left"  x={6}  h={70} y={15} color={accent} bg={bg}/>
        <Bracket side="right" x={94} h={70} y={15} color={accent} bg={bg}/>
        <text x="50" y="62" textAnchor="middle"
              fontFamily="IBM Plex Sans, sans-serif" fontWeight="700"
              fontSize="38" letterSpacing="-0.5" fill={ink}>MS</text>
      </svg>
    );
  }

  const bracketH = variant === "stacked" ? height : Math.round(height * 0.78);
  const fontSize = variant === "stacked" ? Math.round(height * 0.34) : Math.round(height * 0.5);
  const setterFill = variant === "mono" ? ink : accent;
  const bracketFill = variant === "mono" ? ink : accent;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(bracketH * 0.12),
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontWeight: 700,
        fontSize,
        lineHeight: 0.9,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        color: ink,
      }}
    >
      <BracketSVG side="left"  h={bracketH} color={bracketFill} bg={bg}/>
      {variant === "stacked" ? (
        <span style={{ textAlign: "center" }}>
          <span style={{ display: "block" }}>MASTER</span>
          <span style={{ display: "block", color: setterFill, marginTop: 4 }}>SETTER</span>
        </span>
      ) : (
        <span style={{ display: "inline-flex", gap: "0.4em" }}>
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
  const s = Math.max(2, Math.round(h * 0.023));
  const inset = w * 0.55;
  const open = side === "left";
  const sx = open ? s / 2 : w - s / 2;
  const vb = "0 0 " + w + " " + h;
  return (
    <svg width={w} height={h} viewBox={vb} style={{ overflow: "visible" }}
         xmlns="http://www.w3.org/2000/svg">
      <line x1={open ? inset : w - inset} y1={s / 2}      x2={sx}                    y2={s / 2}      stroke={color} strokeWidth={s}/>
      <line x1={sx}                        y1={s / 2}      x2={sx}                    y2={h - s / 2}  stroke={color} strokeWidth={s}/>
      <line x1={sx}                        y1={h - s / 2}  x2={open ? inset : w - inset} y2={h - s / 2} stroke={color} strokeWidth={s}/>
      <line x1={sx}                        y1={h * 0.45}   x2={sx}                    y2={h * 0.55}   stroke={bg}    strokeWidth={s + 2}/>
      <circle cx={sx} cy={h / 2} r={s * 0.9} fill={color}/>
    </svg>
  );
}

function Bracket({ side, x, y, h, color, bg }) {
  const w = h * 0.36;
  const tx = x - w / 2;
  const tf = "translate(" + tx + ", " + y + ")";
  return (
    <g transform={tf}>
      <BracketSVG side={side} h={h} color={color} bg={bg}/>
    </g>
  );
}
