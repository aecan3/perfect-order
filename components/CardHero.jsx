"use client";

// CardHero — the card image with a lime glow + drop-shadow wrapper, centred.
// Used by TradeRequestModal. Image source is cards.image_large (printings.image_url
// is the known-NULL column). Falls back to the card name when no image.
export function CardHero({ imageUrl, name }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
      <div
        style={{
          position: "relative",
          width: 150,
          aspectRatio: "2.5 / 3.5",
          borderRadius: 10,
          overflow: "hidden",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(200,255,74,0.35)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.6), 0 0 22px rgba(200,255,74,0.35)",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name || "Card"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 8, textAlign: "center",
              fontSize: 11, lineHeight: 1.3, color: "var(--po-text-faint)",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}
          >
            {name || "Card"}
          </div>
        )}
      </div>
    </div>
  );
}
