"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { FindOnline } from "@/components/FindOnline";
import { selectAllPrintings } from "@/lib/queries/printings";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

export default function FavouritesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("AUD");
  const userCountry = { AUD: "AU", USD: "US", GBP: "UK" }[currency] || "AU";

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
        .order("created_at", { ascending: false });

      if (!favData || favData.length === 0) { setLoading(false); return; }

      const printingIds = favData.map((f) => f.printing_id);
      const { data: printingData, error: printingError } = await selectAllPrintings(supabase, "*, card:cards!printings_card_id_fkey(id, name, number, rarity, image_large, image_small, set_id), set:sets!printings_set_id_fkey(id, name, code, logo_url, total, theme_primary)")
        .in("id", printingIds);

      const orderedItems = printingIds.map((pid) => printingData?.find((p) => p.id === pid)).filter(Boolean);
      setItems(orderedItems);
      setLoading(false);
    })();
  }, [router, supabase]);

  const removeFav = async (printingId) => {
    setItems((prev) => prev.filter((p) => p.id !== printingId));
    await supabase.from("favourites").delete().eq("user_id", user.id).eq("printing_id", printingId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header
        className="sticky top-0 z-20 backdrop-blur px-4 pt-3 pb-3"
        style={{ background: "rgba(5,5,7,0.92)", borderBottom: "1px solid var(--po-border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--po-border)] bg-[var(--po-bg-soft)]"
            style={{ color: "var(--po-text-dim)" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "#FFB830",
              fontWeight: 700,
            }}
          >
            ★ FAVOURITES
          </div>
          <select
            value={currency}
            onChange={(e) => { setCurrency(e.target.value); localStorage.setItem("po:currency", e.target.value); }}
            className="text-[10px] uppercase tracking-widest px-2 py-1.5 border border-[var(--po-border)] rounded-lg bg-[var(--po-bg-soft)] cursor-pointer"
            style={{ color: "var(--po-text-dim)" }}
          >
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
        <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "var(--po-text-faint)" }}>
          Star up to 5 cards you're chasing. They'll show up first in your discovery feed when friends have them spare.
        </p>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div style={{ fontSize: 32, marginBottom: 12 }}>☆</div>
            <p className="text-[var(--po-text-dim)] text-sm mb-1">No favourites yet.</p>
            <p className="text-[var(--po-text-faint)] text-xs">
              Tap the ☆ on any card you&apos;re hunting.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((printing) => {
              const card = printing.card;
              const set = printing.set;
              if (!card || !set) return null;
              const themePrimary = set.theme_primary || "#c8ff4a";
              const collectorNumber = card.number && set.total
                ? `${String(card.number).padStart(3, "0")}/${String(set.total).padStart(3, "0")}`
                : card.number ? String(card.number).padStart(3, "0") : "";
              const price = printing.price_usd
                ? fmtMoney(printing.price_usd * (RATES[currency]?.rate || 1), currency)
                : null;

              return (
                <div
                  key={printing.id}
                  className="flex gap-3 rounded-xl border border-[var(--po-border)] bg-[var(--po-bg-soft)] overflow-hidden"
                  style={{ borderLeft: `3px solid #FFB830` }}
                >
                  {/* Card thumbnail */}
                  <Link
                    href={`/set/${set.id}`}
                    className="flex-shrink-0 w-16 h-[90px] relative"
                  >
                    {card.image_large ? (
                      <img
                        src={card.image_large}
                        alt={card.name}
                        className="w-full h-full object-cover grayscale opacity-55"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: `${themePrimary}22` }}
                      >
                        <span style={{ fontSize: 10, color: themePrimary, fontWeight: 700 }}>
                          {String(card.number).padStart(3, "0")}
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 py-2 pr-2 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-sm truncate">{card.name}</div>
                      <div
                        className="text-[11px] truncate"
                        style={{ color: "var(--po-text-dim)" }}
                      >
                        {set.name}
                        {collectorNumber ? ` · ${collectorNumber}` : ""}
                      </div>
                      <div
                        className="text-[10px] mt-0.5"
                        style={{ color: "var(--po-text-faint)", fontFamily: '"IBM Plex Mono", monospace' }}
                      >
                        {printing.printing_label}
                        {price ? ` · ${price}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <FindOnline
                        cardName={card.name}
                        collectorNumber={collectorNumber}
                        rarity={card.rarity}
                        userCountry={userCountry}
                        inline
                      />
                      <button
                        onClick={() => removeFav(printing.id)}
                        style={{
                          fontSize: 10,
                          fontFamily: '"IBM Plex Mono", monospace',
                          color: "rgba(248,113,113,0.8)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px 0",
                          flexShrink: 0,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
