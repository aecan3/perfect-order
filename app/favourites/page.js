"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import { FindOnline } from "@/components/FindOnline";
import { selectAllPrintings } from "@/lib/queries/printings";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { RATES, CURRENCY_OPTIONS, CURRENCY_TO_COUNTRY } from "@/lib/currency";

const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

const collectorNum = (card, set) => {
  if (!card?.number) return "";
  return set?.total
    ? `${String(card.number).padStart(3, "0")}/${String(set.total).padStart(3, "0")}`
    : String(card.number).padStart(3, "0");
};

export default function FavouritesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("AUD");
  const [activeCard, setActiveCard] = useState(null);
  const [mounted, setMounted] = useState(false);
  const userCountry = CURRENCY_TO_COUNTRY[currency] || "AU";

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);

      const { data: favData } = await supabase
        .from("favourites")
        .select("printing_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!favData || favData.length === 0) { setLoading(false); return; }

      const printingIds = favData.map((f) => f.printing_id);
      const { data: printingData, error: printingError } = await selectAllPrintings(supabase, "*, card:cards!printings_card_id_fkey(id, name, number, rarity, image_large, image_small, set_id), set:sets!printings_set_id_fkey(id, name, code, logo_url, total, theme_primary)")
        .in("id", printingIds);
      if (printingError) console.error("favourites fetch error:", printingError);

      const orderedItems = printingIds.map((pid) => printingData?.find((p) => p.id === pid)).filter(Boolean);
      setItems(orderedItems);
      setLoading(false);
    })();
  }, [router, supabase]);

  const removeFav = useCallback(async (printingId) => {
    if (!user) return;
    setItems((prev) => prev.filter((p) => p.id !== printingId));
    setActiveCard(null);
    await supabase.from("favourites").delete().eq("user_id", user.id).eq("printing_id", printingId);
  }, [user, supabase]);

  if (loading) {
    return (
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  const SLOTS = 6;
  const slots = [
    ...items,
    ...Array(Math.max(0, SLOTS - items.length)).fill(null),
  ].slice(0, SLOTS);

  const sheet = activeCard && mounted && createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.72)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={() => setActiveCard(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#111113", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto", paddingBottom: 40 }}
      >
        <div style={{ width: 40, height: 4, background: "rgba(244,244,246,0.18)", borderRadius: 2, margin: "16px auto 0" }} />

        {activeCard.card?.image_large && (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 20px 0" }}>
            <img
              src={activeCard.card.image_large}
              alt={activeCard.card.name}
              style={{ width: 200, height: "auto", borderRadius: 10, display: "block" }}
            />
          </div>
        )}

        <div style={{ padding: "16px 24px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--po-text)", marginBottom: 4 }}>
            {activeCard.card?.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--po-text-dim)", marginBottom: 2 }}>
            {activeCard.set?.name}
            {collectorNum(activeCard.card, activeCard.set) ? ` · ${collectorNum(activeCard.card, activeCard.set)}` : ""}
          </div>
          <div style={{ fontSize: 12, color: "var(--po-text-faint)", fontFamily: '"IBM Plex Mono", monospace' }}>
            {activeCard.printing_label}
            {activeCard.price_usd ? ` · ${fmtMoney(activeCard.price_usd * (RATES[currency]?.rate || 1), currency)}` : ""}
          </div>
        </div>

        <div style={{ padding: "20px 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex" }}>
            <FindOnline
              cardName={activeCard.card?.name || ""}
              collectorNumber={collectorNum(activeCard.card, activeCard.set)}
              rarity={activeCard.card?.rarity}
              userCountry={userCountry}
              setId={activeCard.set?.id}
              inline
            />
          </div>

          <Link
            href={`/set/${activeCard.set?.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "13px 16px",
              background: "rgba(244,244,246,0.06)",
              border: "1px solid rgba(244,244,246,0.14)",
              borderRadius: 12,
              color: "var(--po-text)",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View in Set
          </Link>

          <button
            onClick={() => removeFav(activeCard.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "13px 16px",
              background: "transparent",
              border: "1px solid rgba(248,113,113,0.28)",
              borderRadius: 12,
              color: "rgba(248,113,113,0.85)",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Remove from favourites
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <MSShell>
      <MSPageTitle>Favourites</MSPageTitle>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px" }}>
        <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "var(--po-text-faint)", margin: 0 }}>
          Star up to 6 cards you&apos;re chasing.
        </p>
        <select
          value={currency}
          onChange={(e) => { setCurrency(e.target.value); localStorage.setItem("po:currency", e.target.value); }}
          className="text-[10px] uppercase tracking-widest px-2 py-1.5 border border-[var(--po-border)] rounded-lg bg-[var(--po-bg-soft)] cursor-pointer"
          style={{ color: "var(--po-text-dim)" }}
        >
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: "0 16px 16px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {slots.map((printing, i) => {
            if (!printing) {
              return (
                <div key={`empty-${i}`}>
                  <div
                    style={{
                      aspectRatio: "2/3",
                      borderRadius: 12,
                      border: "2px dashed var(--ms-faint)",
                      background: "rgba(0,0,0,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 22, color: "var(--ms-faint)", lineHeight: 1 }}>+</span>
                  </div>
                </div>
              );
            }

            const card = printing.card;
            const set = printing.set;
            if (!card || !set) return null;

            const cn = collectorNum(card, set);
            const price = printing.price_usd
              ? fmtMoney(printing.price_usd * (RATES[currency]?.rate || 1), currency)
              : null;

            return (
              <div
                key={printing.id}
                onClick={() => setActiveCard(printing)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ position: "relative", aspectRatio: "2/3", borderRadius: 12, overflow: "hidden" }}>
                  {card.image_large ? (
                    <img
                      src={card.image_large}
                      alt={card.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: `${set.theme_primary || "#c8ff4a"}22`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 10, color: set.theme_primary || "#c8ff4a", fontWeight: 700 }}>
                        {String(card.number).padStart(3, "0")}
                      </span>
                    </div>
                  )}
                  <span
                    style={{
                      position: "absolute",
                      top: 5,
                      right: 6,
                      fontSize: 15,
                      color: "#FFB830",
                      lineHeight: 1,
                      filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))",
                      pointerEvents: "none",
                    }}
                  >
                    ★
                  </span>
                </div>

                <div style={{ padding: "5px 2px 0", overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--po-text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.3,
                    }}
                  >
                    {card.name}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--ms-dim)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.4,
                      marginTop: 1,
                    }}
                  >
                    {set.name}{cn ? ` · ${cn}` : ""}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--ms-dim)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontFamily: '"IBM Plex Mono", monospace',
                      lineHeight: 1.4,
                      marginTop: 1,
                    }}
                  >
                    {printing.printing_label}{price ? ` · ${price}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sheet}
    </MSShell>
  );
}
