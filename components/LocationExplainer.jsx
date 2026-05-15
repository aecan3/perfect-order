"use client";

export function LocationExplainer({ onEnable, onNotNow }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 300,
        padding: "0 0 env(safe-area-inset-bottom)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onNotNow(); }}
    >
      <div
        style={{
          background: "var(--po-bg-soft)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid var(--po-border)",
          padding: "28px 24px 36px",
          width: "100%",
          maxWidth: 480,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 26 }}>📍</span>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              color: "var(--po-text)",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}
          >
            Find a card shop nearby
          </h2>
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--po-text-dim)",
            lineHeight: 1.6,
            marginBottom: 14,
            fontFamily: '"IBM Plex Sans", sans-serif',
          }}
        >
          Master Setter will ask for your{" "}
          <strong style={{ color: "var(--po-text)" }}>precise location</strong> to
          search for card shops within 10km.
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 24px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {[
            "Used only to find nearby card shops",
            "Never stored or saved to your account",
            "Never shared with other users",
            "Never used for advertising",
            "Revoke access any time in device settings",
          ].map((item) => (
            <li
              key={item}
              style={{
                fontSize: 13,
                color: "var(--po-text-dim)",
                fontFamily: '"IBM Plex Sans", sans-serif',
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ color: "var(--po-green)", flexShrink: 0, fontWeight: 700 }}>✓</span>
              {item}
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onEnable}
            style={{
              width: "100%",
              padding: "14px",
              background: "var(--po-green)",
              color: "#000",
              border: "none",
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}
          >
            Enable location
          </button>
          <button
            onClick={onNotNow}
            style={{
              width: "100%",
              padding: "12px",
              background: "transparent",
              color: "var(--po-text-dim)",
              border: "1px solid var(--po-border)",
              borderRadius: 12,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}
          >
            Not now — search by suburb instead
          </button>
        </div>
      </div>
    </div>
  );
}
