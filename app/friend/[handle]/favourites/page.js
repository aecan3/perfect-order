"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronRight, X, MessageCircle, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { selectMasterPrintings } from "@/lib/queries/printings";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { Avatar } from "@/components/Avatar";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const valueOf = (priceUsd, currency) => (priceUsd || 0) * (RATES[currency]?.rate || 1);
const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

export default function FriendFavouritesPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const handle = params.handle;

  const [friend, setFriend] = useState(null);
  const [items, setItems] = useState([]);
  const [currency, setCurrency] = useState("AUD");
  const [pickingItem, setPickingItem] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!friendProfile) { setStatus("not-found"); return; }

      const { data: blocked } = await supabase.rpc("is_blocked", { viewer: user.id, target: friendProfile.id });
      if (blocked) { setStatus("not-found"); return; }

      setFriend(friendProfile);

      const { data: friendship } = await supabase
        .from("friendships")
        .select("id")
        .or(
          `and(user_a.eq.${user.id},user_b.eq.${friendProfile.id}),and(user_a.eq.${friendProfile.id},user_b.eq.${user.id})`
        )
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();

      if (!friendship) { setStatus("not-friends"); return; }

      const { data: favData } = await supabase.rpc("get_friend_favourites", {
        viewer: user.id,
        target: friendProfile.id,
      });

      if (!favData || favData.length === 0) {
        setStatus("ok");
        return;
      }

      const printingIds = favData.map((f) => f.printing_id);
      const { data: printingData } = await selectMasterPrintings(
        supabase,
        "*, card:cards!printings_card_id_fkey(id, name, number, rarity, image_large, set_id), set:sets!printings_set_id_fkey(id, name, code, total, theme_primary)"
      ).in("id", printingIds);

      // Preserve favourite order from favData
      const orderedItems = printingIds
        .map((pid) => (printingData || []).find((p) => p.id === pid))
        .filter(Boolean);

      setItems(orderedItems);
      setStatus("ok");
    })();
  }, [handle, router, supabase]);

  if (status === "loading") {
    return (
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  if (status === "not-found") {
    return (
      <MSShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "0 16px", textAlign: "center" }}>
          <p className="text-[var(--po-text-dim)] mb-3">No user with handle @{handle}.</p>
          <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Back to friends</Link>
        </div>
      </MSShell>
    );
  }

  if (status === "not-friends") {
    return (
      <MSShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "0 16px", textAlign: "center" }}>
          <p className="text-[var(--po-text-dim)] mb-3">You&apos;re not friends with @{handle} yet.</p>
          <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Send them a request</Link>
        </div>
      </MSShell>
    );
  }

  return (
    <MSShell>
      <MSPageTitle sub={`@${friend.handle}`}>Favourites</MSPageTitle>

      <div
        className="px-4 pt-0 pb-4 max-w-md mx-auto"
        style={{ borderBottom: "1px solid var(--po-border)" }}
      >
        {/* Identity row */}
        <Link
          href={`/friend/${handle}`}
          className="flex items-center gap-3 rounded-xl p-2 -mx-2 hover:bg-[var(--po-bg-soft)] active:bg-[var(--po-border)] transition-colors"
        >
          <Avatar profile={friend} size={40} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-tight truncate text-[var(--po-text)]">
              {friend.display_name || friend.handle}
            </div>
            <div className="text-[10px] text-[var(--po-text-dim)] truncate">@{friend.handle}</div>
          </div>
          <ChevronRight size={16} className="text-[var(--po-text-dim)] flex-shrink-0" />
        </Link>
      </div>

      <div className="px-3 py-4 max-w-md mx-auto">
        {items.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            They haven&apos;t favourited any cards yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((printing) => {
              const card = printing.card;
              const set = printing.set;
              if (!card || !set) return null;
              const primary = set.theme_primary || "#b9ff3c";
              return (
                <div
                  key={printing.id}
                  onClick={() => setPickingItem(printing)}
                  className="flex flex-col cursor-pointer select-none active:scale-[0.98] transition-transform"
                >
                  <div className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md">
                    {card.image_large ? (
                      <img
                        src={card.image_large}
                        alt={card.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center px-2 text-center"
                        style={{ background: `linear-gradient(135deg, ${primary}33, #0a0e0a)` }}
                      >
                        <div className="text-[11px] font-bold leading-tight line-clamp-3" style={{ color: primary }}>
                          {card.name}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                      {String(card.number).padStart(3, "0")}
                    </div>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pickingItem && (() => {
        const card = pickingItem.card;
        const set = pickingItem.set;
        const tradeParams = new URLSearchParams({
          with: handle,
          request: pickingItem.id,
          requestName: card?.name || "",
          requestSet: set?.name || "",
          requestSetId: set?.id || "",
          requestImage: card?.image_large || "",
          requestPrice: pickingItem.price_usd || "",
          requestLabel: pickingItem.printing_label || "",
        }).toString();
        return (
          <div
            className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setPickingItem(null)}
          >
            <div
              className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-2xl w-full max-w-sm p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold leading-tight">
                  {card?.name}
                  <span className="text-[var(--po-text-dim)] font-normal ml-1">
                    #{String(card?.number).padStart(3, "0")}
                  </span>
                </h2>
                <button
                  onClick={() => setPickingItem(null)}
                  className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="py-3 px-4 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg mb-4">
                <div className="font-bold text-sm">{pickingItem.printing_label}</div>
                {pickingItem.price_usd && (
                  <div className="text-[10px] text-[var(--po-text-dim)] tabular-nums mt-0.5">
                    {fmtMoney(valueOf(pickingItem.price_usd, currency), currency)}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Link
                  href={`/trade/new?${tradeParams}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-black po-glow-green"
                  style={{ background: "var(--po-green)" }}
                  onClick={() => setPickingItem(null)}
                >
                  <ArrowLeftRight size={14} />
                  Propose Trade
                </Link>
                <Link
                  href={`/messages/${handle}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm uppercase tracking-widest border border-[var(--po-border)] text-[var(--po-text)] hover:border-[var(--po-green)] transition-colors"
                  onClick={() => setPickingItem(null)}
                >
                  <MessageCircle size={14} />
                  Message Directly
                </Link>
                <button
                  onClick={() => setPickingItem(null)}
                  className="w-full py-2 text-xs text-[var(--po-text-dim)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </MSShell>
  );
}
