"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const fmtMoney = (usd, currency) => {
  const { rate, symbol } = RATES[currency] || RATES.AUD;
  const v = (usd || 0) * rate;
  if (v >= 100) return `${symbol}${v.toFixed(0)}`;
  if (v >= 10)  return `${symbol}${v.toFixed(1)}`;
  return `${symbol}${v.toFixed(2)}`;
};

export default function TradeNewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">Loading...</div>}>
      <TradeNewInner />
    </Suspense>
  );
}

function TradeNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const recipientHandle = searchParams.get("with") || "";

  // Discover passes a JSON array via `requests`; friend-set page passes individual params
  const requestedCards = (() => {
    const raw = searchParams.get("requests");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    // Fallback: single-card params from friend set page
    const id = searchParams.get("request");
    if (!id) return [];
    return [{
      printingId: id,
      cardName: searchParams.get("requestName") || "Unknown Card",
      setName: searchParams.get("requestSet") || "",
      setId: searchParams.get("requestSetId") || "",
      imageUrl: searchParams.get("requestImage") || "",
      priceUsd: parseFloat(searchParams.get("requestPrice") || "0"),
      printingLabel: searchParams.get("requestLabel") || "",
    }];
  })();

  const requestTotalPrice = requestedCards.reduce((s, c) => s + (Number(c.priceUsd) || 0), 0);

  const [currency, setCurrency] = useState("AUD");
  const [me, setMe] = useState(null);
  const [myCollection, setMyCollection] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState({});
  const [openSets, setOpenSets] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [understood, setUnderstood] = useState(false);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setMe(user);

      const PAGE = 1000;
      const rows = [];
      let from = 0;
      while (true) {
        const { data, error: fetchErr } = await supabase
          .from("collection_entries")
          .select("printing_id, set_id, card_number, duplicate_count, is_graded, printing:printings(id, card_name, printing_label, image_url, price_usd, set_id, set:sets(name))")
          .eq("user_id", user.id)
          .eq("checked", true)
          .eq("is_graded", false)
          .range(from, from + PAGE - 1);
        if (fetchErr) { setError(fetchErr.message); setStatus("error"); return; }
        rows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const withPrinting = rows.filter((r) => r.printing);
      setMyCollection(withPrinting);
      setStatus("ok");
    })();
  }, []);

  const visibleCollection = useMemo(() => {
    if (showAll) return myCollection;
    return myCollection.filter((r) => (r.duplicate_count || 0) >= 1);
  }, [myCollection, showAll]);

  const groupedBySet = useMemo(() => {
    const groups = {};
    for (const row of visibleCollection) {
      const setName = row.printing?.set?.name || row.set_id;
      if (!groups[setName]) groups[setName] = [];
      groups[setName].push(row);
    }
    return groups;
  }, [visibleCollection]);

  const toggleSelect = (printingId) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[printingId]) delete next[printingId];
      else next[printingId] = true;
      return next;
    });
  };

  const selectedRows = visibleCollection.filter((r) => selected[r.printing_id]);
  const offerTotal = selectedRows.reduce((s, r) => s + (Number(r.printing?.price_usd) || 0), 0);
  const ratio = requestTotalPrice > 0 ? offerTotal / requestTotalPrice : null;
  const undervalued = ratio !== null && ratio < 0.75;

  const canSubmit = selectedRows.length > 0 && (!undervalued || understood);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    const offerItems = selectedRows.map((r) => ({
      printing_id: r.printing_id,
      card_name: r.printing?.card_name || "",
      set_name: r.printing?.set?.name || "",
      set_id: r.set_id,
      card_number: r.card_number,
      price_usd: r.printing?.price_usd || null,
      image_url: r.printing?.image_url || null,
      printing_label: r.printing?.printing_label || null,
    }));

    const requestItems = requestedCards.map((c) => ({
      printing_id: c.printingId || null,
      card_name: c.cardName || "",
      set_name: c.setName || "",
      set_id: c.setId || null,
      price_usd: c.priceUsd || null,
      image_url: c.imageUrl || null,
      printing_label: c.printingLabel || null,
    }));

    const res = await fetch("/api/trade/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientHandle, offerItems, requestItems }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to propose trade");
      setSubmitting(false);
      return;
    }

    router.push(`/messages/${recipientHandle}?tradeProposed=1`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading your duplicates...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)] flex flex-col max-w-sm mx-auto">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/95 backdrop-blur px-4 pt-4 pb-3 border-b border-[var(--po-border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[var(--po-text-dim)] text-sm mb-3"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="font-black text-lg uppercase tracking-tight">Propose Trade</h1>
        <p className="text-xs text-[var(--po-text-dim)] mt-0.5">with @{recipientHandle}</p>
      </header>

      <div className="px-4 py-4 space-y-4 flex-1 overflow-y-auto pb-32">
        {/* Requesting section */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mb-2">
            You want{requestedCards.length > 1 ? ` (${requestedCards.length} cards)` : ""}
          </p>
          {requestedCards.length === 1 ? (
            <div className="flex items-center gap-3 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-xl p-3">
              {requestedCards[0].imageUrl ? (
                <img src={requestedCards[0].imageUrl} alt={requestedCards[0].cardName} className="w-14 h-20 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-14 h-20 rounded-lg bg-[var(--po-bg)] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm leading-tight">{requestedCards[0].cardName}</div>
                {requestedCards[0].printingLabel && <div className="text-[10px] text-[var(--po-text-dim)] mt-0.5">{requestedCards[0].printingLabel}</div>}
                <div className="text-[10px] text-[var(--po-text-dim)] mt-0.5">{requestedCards[0].setName}</div>
                {requestedCards[0].priceUsd > 0 && (
                  <div className="text-xs font-bold mt-1" style={{ color: "var(--po-green)" }}>
                    {fmtMoney(requestedCards[0].priceUsd, currency)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollSnapType: "x mandatory" }}>
              {requestedCards.map((c, i) => (
                <div
                  key={i}
                  className="flex-none rounded-xl border border-[var(--po-border)] overflow-hidden bg-[var(--po-bg-soft)]"
                  style={{ width: 100, scrollSnapAlign: "start" }}
                >
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.cardName} className="w-full object-cover" style={{ height: 140 }} />
                  ) : (
                    <div className="flex items-center justify-center p-2 text-center text-[8px] text-[var(--po-text-dim)]" style={{ height: 140 }}>
                      {c.cardName}
                    </div>
                  )}
                  <div className="px-2 py-1.5">
                    <div className="text-[9px] font-bold leading-tight line-clamp-2">{c.cardName}</div>
                    {c.priceUsd > 0 && (
                      <div className="text-[9px] font-black mt-0.5" style={{ color: "var(--po-green)" }}>
                        {fmtMoney(c.priceUsd, currency)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Value bar */}
        {requestTotalPrice > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--po-text-dim)]">Your offer value</span>
            <span className="font-bold tabular-nums" style={{ color: undervalued ? "#f87171" : "var(--po-green)" }}>
              {fmtMoney(offerTotal, currency)}
              {ratio !== null && (
                <span className="ml-1 font-normal text-[var(--po-text-dim)]">
                  ({Math.round(ratio * 100)}%)
                </span>
              )}
            </span>
          </div>
        )}

        {undervalued && !understood && (
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <AlertTriangle size={14} />
              Offer is less than 75% of card value
            </div>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              The cards you are offering are worth significantly less than the card you are requesting. Your friend may decline.
            </p>
            <button
              onClick={() => setUnderstood(true)}
              className="text-xs font-bold text-amber-400 underline"
            >
              I understand, send anyway
            </button>
          </div>
        )}

        {/* Offer selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">
              {showAll ? "Your collection" : "Your duplicates"}
            </p>
            <button
              onClick={() => { setShowAll((v) => !v); setSelected({}); }}
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--po-green)" }}
            >
              {showAll ? "Duplicates only" : "Show all cards"}
            </button>
          </div>
          {visibleCollection.length === 0 ? (
            <p className="text-sm text-[var(--po-text-dim)] py-4 text-center">
              {showAll ? "No cards in your collection yet." : "No duplicates yet — tap 'Show all cards' to offer any card."}
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedBySet).map(([setName, rows]) => {
                const isOpen = openSets[setName] !== false;
                return (
                  <div key={setName} className="rounded-xl border border-[var(--po-border)] overflow-hidden">
                    <button
                      onClick={() => setOpenSets((p) => ({ ...p, [setName]: !isOpen }))}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--po-bg-soft)]"
                    >
                      <span className="text-xs font-bold">{setName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--po-text-dim)]">
                          {rows.filter((r) => selected[r.printing_id]).length}/{rows.length}
                        </span>
                        <ChevronDown size={14} className={`text-[var(--po-text-dim)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-[var(--po-border)]">
                        {rows.map((row) => {
                          const p = row.printing;
                          const isSelected = !!selected[row.printing_id];
                          return (
                            <button
                              key={row.printing_id}
                              onClick={() => toggleSelect(row.printing_id)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                              style={{ background: isSelected ? "rgba(200,255,74,0.06)" : undefined }}
                            >
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: isSelected ? "var(--po-green)" : "transparent",
                                  border: `2px solid ${isSelected ? "var(--po-green)" : "var(--po-border)"}`,
                                }}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} className="text-black" />}
                              </div>
                              {p?.image_url && (
                                <img src={p.image_url} alt={p.card_name} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold truncate">{p?.card_name}</div>
                                <div className="text-[10px] text-[var(--po-text-dim)]">{p?.printing_label}</div>
                                {(row.duplicate_count || 0) > 1 && (
                                  <div className="text-[10px] text-[var(--po-text-dim)]">x{row.duplicate_count} dupes</div>
                                )}
                              </div>
                              {p?.price_usd > 0 && (
                                <span className="text-xs font-bold flex-shrink-0 tabular-nums" style={{ color: "var(--po-green)" }}>
                                  {fmtMoney(p.price_usd, currency)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto px-4 pb-6 pt-3 bg-[var(--po-bg)]/95 backdrop-blur border-t border-[var(--po-border)]">
        {error && (
          <p className="text-xs text-rose-400 mb-2 text-center">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-black disabled:opacity-40 po-glow-green flex items-center justify-center gap-2"
          style={{ background: "var(--po-green)" }}
        >
          <ArrowLeftRight size={14} />
          {submitting ? "Sending..." : selectedRows.length === 0 ? "Select cards to offer" : `Propose Trade (${selectedRows.length} card${selectedRows.length !== 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
}
