"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Check, MessageCircle, ArrowLeftRight } from "lucide-react";
import { createClient } from "@/lib/supabase";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "Â£"  },
};

const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

const cardKey = (card) => `${card.printingId}:${card.friendHandle}`;

export default function DiscoverPage() {
  const router = useRouter();
  const supabase = createClient();
  const [cards, setCards] = useState(null);
  const [currency, setCurrency] = useState("AUD");
  const [filterSet, setFilterSet] = useState("all");
  const [minValue, setMinValue] = useState(0);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      const { data: fships } = await supabase
        .from("friendships")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq("status", "accepted");

      if (!fships?.length) { setCards([]); return; }

      const friendIds = fships.map((f) => f.user_a === user.id ? f.user_b : f.user_a);

      const [{ data: friendEntries }, { data: myMissing }] = await Promise.all([
        supabase
          .from("collection_entries")
          .select("user_id, printing_id, card_number, set_id, duplicate_count, printing:printings(price_usd, image_url, card:cards(name, image_large)), set:sets(name, code)")
          .in("user_id", friendIds)
          .eq("checked", true),
        supabase
          .from("collection_entries")
          .select("printing_id, set_id, card_number")
          .eq("user_id", user.id)
          .eq("checked", false),
      ]);

      // Group friend entries by (user_id, set_id, card_number) to count total copies
      // across all printings — catches the case where a user owns e.g. one normal
      // and one holo of the same card (neither shows duplicate_count > 0 alone).
      const cardTotals = {};
      for (const entry of (friendEntries || [])) {
        const key = `${entry.user_id}:${entry.set_id}:${entry.card_number}`;
        cardTotals[key] = (cardTotals[key] || 0) + 1 + (entry.duplicate_count || 0);
      }

      // A printing is tradeable if its card's total across all printings > 1
      const tradeableEntries = (friendEntries || []).filter((entry) => {
        const key = `${entry.user_id}:${entry.set_id}:${entry.card_number}`;
        return cardTotals[key] > 1;
      });

      const missingPrintingIds = new Set((myMissing || []).map((e) => e.printing_id).filter(Boolean));
      const missingKeys = new Set((myMissing || []).map((e) => `${e.set_id}:${e.card_number}`));

      const friendProfileIds = [...new Set(tradeableEntries.map((d) => d.user_id))];
      const { data: friendProfiles } = friendProfileIds.length > 0
        ? await supabase.from("profiles").select("id, handle").in("id", friendProfileIds)
        : { data: [] };
      const profileMap = Object.fromEntries((friendProfiles || []).map((p) => [p.id, p]));

      const results = tradeableEntries
        .filter((entry) =>
          (entry.printing_id && missingPrintingIds.has(entry.printing_id)) ||
          missingKeys.has(`${entry.set_id}:${entry.card_number}`)
        )
        .map((entry) => ({
          printingId: entry.printing_id,
          cardNumber: entry.card_number,
          setId: entry.set_id,
          duplicateCount: entry.duplicate_count,
          friendHandle: profileMap[entry.user_id]?.handle || "unknown",
          priceUsd: entry.printing?.price_usd || 0,
          imageUrl: entry.printing?.image_url || entry.printing?.card?.image_large || null,
          setName: entry.set?.name || "",
          setCode: entry.set?.code || "",
          cardName: entry.printing?.card?.name || "",
        }))
        .sort((a, b) => b.priceUsd - a.priceUsd);

      setCards(results);
    })();
  }, [router, supabase]);

  const allSets = cards
    ? [...new Map(cards.map((c) => [c.setId, { id: c.setId, name: c.setName }])).values()]
    : [];

  const filtered = (cards || []).filter((c) => {
    if (filterSet !== "all" && c.setId !== filterSet) return false;
    if (c.priceUsd * (RATES[currency]?.rate || 1) < minValue) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, card) => {
    if (!acc[card.friendHandle]) acc[card.friendHandle] = [];
    acc[card.friendHandle].push(card);
    return acc;
  }, {});

  // The friend whose cards are currently selected (only one friend at a time)
  const selectedCards = filtered.filter((c) => selected.has(cardKey(c)));
  const selectedFriend = selectedCards[0]?.friendHandle ?? null;

  const toggleCard = (card) => {
    // Block selection of cards from a different friend
    if (selectedFriend && card.friendHandle !== selectedFriend) return;
    const key = cardKey(card);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Select All only selects within the currently active friend (or first friend if none)
  const selectAll = () => {
    const targetFriend = selectedFriend || Object.keys(
      filtered.reduce((acc, c) => { acc[c.friendHandle] = true; return acc; }, {})
    )[0];
    if (!targetFriend) return;
    setSelected(new Set(filtered.filter((c) => c.friendHandle === targetFriend).map(cardKey)));
  };
  const clearAll = () => setSelected(new Set());

  // Bulk messaging â€” only ever one friend in the map
  const selectedByFriend = selectedCards.reduce((acc, card) => {
    if (!acc[card.friendHandle]) acc[card.friendHandle] = [];
    acc[card.friendHandle].push(card);
    return acc;
  }, {});

  const openMessageThread = (handle, friendCards) => {
    const cardsParam = encodeURIComponent(JSON.stringify(
      friendCards.map((c) => ({ cardName: c.cardName, setName: c.setName, imageUrl: c.imageUrl, priceUsd: c.priceUsd }))
    ));
    router.push(`/messages/${handle}?cards=${cardsParam}`);
  };

  const openTradePropose = (handle, friendCards) => {
    const requests = encodeURIComponent(JSON.stringify(
      friendCards.map((c) => ({
        printingId: c.printingId,
        cardName: c.cardName,
        setName: c.setName,
        setId: c.setId,
        imageUrl: c.imageUrl,
        priceUsd: c.priceUsd,
      }))
    ));
    const url = `/trade/new?with=${handle}&requests=${requests}`;
    console.log("[Discover] openTradePropose URL:", url);
    router.push(url);
  };

  const isSelecting = selected.size > 0;

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)] pb-32">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <button onClick={() => router.back()} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-base leading-tight">Discover</h1>
            {!isSelecting && <p className="text-[10px] text-[var(--po-text-dim)]">Cards your friends have as duplicates</p>}
            {isSelecting && <p className="text-[10px]" style={{ color: "var(--po-green)" }}>{selected.size} selected</p>}
          </div>
          {filtered.length > 0 && (
            isSelecting ? (
              <button
                onClick={clearAll}
                className="text-[11px] font-bold text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
              >
                Clear
              </button>
            ) : (
              <button
                onClick={selectAll}
                className="text-[11px] font-bold text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
              >
                Select All
              </button>
            )
          )}
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        {/* Filters â€” hidden during selection mode */}
        {!isSelecting && cards && cards.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <select
              value={filterSet}
              onChange={(e) => setFilterSet(e.target.value)}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] px-3 py-1.5 border border-[var(--po-border)] rounded-lg bg-[var(--po-bg-soft)] cursor-pointer flex-shrink-0"
            >
              <option value="all">All sets</option>
              {allSets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={minValue}
              onChange={(e) => setMinValue(Number(e.target.value))}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] px-3 py-1.5 border border-[var(--po-border)] rounded-lg bg-[var(--po-bg-soft)] cursor-pointer flex-shrink-0"
            >
              <option value={0}>Any value</option>
              <option value={1}>Over {RATES[currency]?.symbol}1</option>
              <option value={5}>Over {RATES[currency]?.symbol}5</option>
              <option value={10}>Over {RATES[currency]?.symbol}10</option>
              <option value={25}>Over {RATES[currency]?.symbol}25</option>
            </select>
          </div>
        )}

        {cards === null && (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-16">Loading...</div>
        )}

        {cards !== null && filtered.length === 0 && (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-16">
            {cards.length === 0
              ? "No matches yet â€” add friends and start collecting!"
              : "No cards match your filters."}
          </div>
        )}

        {Object.entries(grouped).map(([handle, friendCards]) => (
          <div key={handle}>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/friend/${handle}?from=discover`}
                className="flex items-center gap-1.5 group"
              >
                <span className="text-sm font-black text-[var(--po-text)]">@{handle}</span>
                <span className="text-[10px] text-[var(--po-text-faint)]">
                  {friendCards.length} card{friendCards.length !== 1 ? "s" : ""}
                </span>
                <ChevronRight size={12} className="text-[var(--po-text-faint)] group-hover:text-[var(--po-green)] transition-colors" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {friendCards.map((card, i) => {
                const key = cardKey(card);
                const isSelected = selected.has(key);
                const isLocked = isSelecting && card.friendHandle !== selectedFriend;
                return (
                  <button
                    key={i}
                    onClick={() => toggleCard(card)}
                    disabled={isLocked}
                    className="relative rounded-lg overflow-hidden bg-black/40 text-left transition-opacity"
                    style={{
                      aspectRatio: "2/3",
                      outline: isSelected ? "2px solid var(--po-green)" : "none",
                      outlineOffset: 2,
                      opacity: isLocked ? 0.3 : 1,
                    }}
                  >
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center text-[8px] text-[var(--po-text-faint)] leading-tight">
                        {card.cardName || card.setName}
                      </div>
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0 px-1.5 py-1"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)" }}
                    >
                      <div className="text-[7px] text-white/60 truncate">{card.setName}</div>
                      {card.priceUsd > 0 && (
                        <div className="text-[9px] font-black" style={{ color: "var(--po-green)" }}>
                          {fmtMoney(card.priceUsd * (RATES[currency]?.rate || 1), currency)}
                        </div>
                      )}
                    </div>
                    {/* Selection checkmark */}
                    {isSelected && (
                      <div
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "var(--po-green)" }}
                      >
                        <Check size={11} color="#050507" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Sticky bottom bar â€” shown when cards are selected */}
      {isSelecting && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-[var(--po-border)] bg-[var(--po-bg)]/95 backdrop-blur px-4 pt-3 pb-8">
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--po-text-dim)]">
                {selected.size} card{selected.size !== 1 ? "s" : ""} selected
              </p>
              <button
                onClick={clearAll}
                className="text-xs font-bold text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
              >
                Clear selection
              </button>
            </div>
            {Object.entries(selectedByFriend).map(([handle, friendCards]) => {
              const countLabel = `${friendCards.length} card${friendCards.length !== 1 ? "s" : ""}`;
              return (
                <div key={handle} className="space-y-2">
                  <button
                    onClick={() => openTradePropose(handle, friendCards)}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl font-black text-sm po-glow-green"
                    style={{ background: "var(--po-green)", color: "#050507" }}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowLeftRight size={14} />
                      Propose Trade · @{handle}
                    </span>
                    <span className="text-xs opacity-70">{countLabel}</span>
                  </button>
                  <button
                    onClick={() => openMessageThread(handle, friendCards)}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl font-bold text-sm border border-[var(--po-border)] text-[var(--po-text)] hover:border-[var(--po-green)] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle size={14} />
                      Message Directly · @{handle}
                    </span>
                    <span className="text-xs text-[var(--po-text-dim)]">{countLabel}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

