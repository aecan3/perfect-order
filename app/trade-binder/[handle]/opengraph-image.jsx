import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "edge";
export const alt = "Trade Binder on Master Setter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }) {
  const { handle } = await params;
  const service = getServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("id, handle, display_name")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) {
    return fallback("Trade Binder", "Master Setter");
  }

  const { data: rows } = await service
    .from("collection_entries")
    .select("printing_id, printings!inner(price_usd, card:cards!printings_card_id_fkey(name, image_small))")
    .eq("user_id", profile.id)
    .gt("duplicate_count", 0);

  const topCards = (rows || [])
    .filter((r) => r.printings?.price_usd != null && r.printings?.card?.image_small)
    .sort((a, b) => Number(b.printings.price_usd) - Number(a.printings.price_usd))
    .slice(0, 3)
    .map((r) => r.printings.card);

  const displayName = profile.display_name || `@${profile.handle}`;

  const cardWidth = topCards.length === 1 ? 250 : topCards.length === 2 ? 260 : 220;
  const cardHeight = Math.round(cardWidth * 1.4);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#050507",
          padding: "48px 56px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", marginBottom: 20 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#c8ff4a",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            MASTER SETTER
          </span>
        </div>

        {/* Name + handle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: topCards.length > 0 ? 32 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: topCards.length > 0 ? 48 : 64,
              fontWeight: 800,
              color: "#f4f4f6",
              lineHeight: 1.1,
            }}
          >
            {displayName}&apos;s Trade Binder
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#9ca3af", marginTop: 10 }}>
            @{profile.handle}
          </div>
          {topCards.length === 0 && (
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#4b5563",
                marginTop: 24,
              }}
            >
              Browse their tradeable Pokémon TCG cards on Master Setter
            </div>
          )}
        </div>

        {/* Cards row */}
        {topCards.length > 0 && (
          <div
            style={{
              display: "flex",
              flex: 1,
              gap: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {topCards.map((card, i) => (
              <img
                key={i}
                src={card.image_small}
                width={cardWidth}
                height={cardHeight}
                style={{
                  borderRadius: 12,
                  objectFit: "cover",
                  border: "1px solid rgba(200,255,74,0.15)",
                }}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", marginTop: 24 }}>
          <span style={{ fontSize: 15, color: "#4b5563" }}>master-setter.app</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

function fallback(title, subtitle) {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#050507",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: "#c8ff4a", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 24 }}>
          MASTER SETTER
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#f4f4f6" }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#9ca3af", marginTop: 12 }}>
          {subtitle}
        </div>
      </div>
    ),
    { ...size }
  );
}
