import { getServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { MSShell } from "@/components/chrome/MSShell";
import { FindOnline } from "@/components/FindOnline";

function fmtPrice(priceUsd) {
  const val = Number(priceUsd) * 1.53;
  if (!priceUsd || val <= 0) return null;
  return `A$${val < 10 ? val.toFixed(2) : Math.round(val)}`;
}

export default async function WantListPage({ params }) {
  const { slug } = await params;
  const service = getServiceClient();

  const { data: list } = await service
    .from("want_lists")
    .select("id, created_at, title, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!list) notFound();

  const [{ data: profile }, { data: cards }] = await Promise.all([
    service.from("profiles").select("handle, display_name").eq("id", list.user_id).maybeSingle(),
    service.from("want_list_cards").select("id, set_id, card_number, printing_id, edition_label").eq("want_list_id", list.id).order("id"),
  ]);

  if (!cards) notFound();

  const printingIds = [...new Set(cards.map(c => c.printing_id))];
  const { data: printings } = await service
    .from("printings")
    .select("id, price_usd, card:cards(image_large, name)")
    .in("id", printingIds);

  const printingMap = Object.fromEntries((printings || []).map(p => [p.id, p]));

  const enriched = cards.map(c => ({
    ...c,
    image_url: printingMap[c.printing_id]?.card?.image_large ?? null,
    price_usd: printingMap[c.printing_id]?.price_usd ?? null,
    card_name: printingMap[c.printing_id]?.card?.name ?? null,
  }));

  const dateStr = new Date(list.created_at).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
  const ownerName = profile?.display_name || profile?.handle || "Someone";
  const returnTo = encodeURIComponent(`/wants/${slug}`);

  return (
    <MSShell hideTabBar>
      {/* Anon CTA */}
      <div style={{ padding: "10px 16px 0" }}>
        <a
          href={`/welcome?returnTo=${returnTo}`}
          style={{
            display: "block", padding: "10px 16px",
            background: "rgba(200,255,74,0.06)", border: "0.5px solid rgba(200,255,74,0.2)",
            borderRadius: "var(--border-radius-md)",
            fontSize: 12, textDecoration: "none",
            color: "var(--po-text-dim)",
          }}
        >
          Track your Pokémon collection ·{" "}
          <span style={{ color: "var(--po-green)", fontWeight: 700 }}>Sign up free →</span>
        </a>
      </div>

      <div style={{ padding: "16px 16px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--po-text)", marginBottom: 4, lineHeight: 1.2 }}>
            {ownerName}&apos;s Want List
          </h1>
          <p style={{ fontSize: 13, color: "var(--po-text-dim)" }}>
            {enriched.length} missing card{enriched.length !== 1 ? "s" : ""} · {dateStr}
          </p>
        </div>

        {/* Card grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {enriched.map(card => {
            const price = fmtPrice(card.price_usd);
            return (
              <div
                key={card.id}
                style={{
                  position: "relative",
                  borderRadius: "var(--border-radius-md)",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.4)",
                  aspectRatio: "2.5/3.5",
                }}
              >
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.card_name || `#${card.card_number}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 8, textAlign: "center",
                    fontSize: 8, color: "var(--po-text-faint)", lineHeight: 1.3,
                  }}>
                    {card.card_name || `#${card.card_number}`}
                  </div>
                )}

                <FindOnline
                  cardName={card.card_name || `#${card.card_number}`}
                  collectorNumber={String(card.card_number)}
                  userCountry="AU"
                />

                {/* Bottom overlay */}
                <div style={{
                  position: "absolute", inset: "auto 0 0",
                  padding: "28px 6px 6px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, color: "var(--po-green)",
                    marginBottom: 1, lineHeight: 1.2,
                  }}>
                    {card.edition_label}
                  </div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.5)" }}>
                    #{card.card_number}
                  </div>
                  {price && (
                    <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                      {price}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MSShell>
  );
}
