"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Check, AlertTriangle, ChevronDown, Search, X } from "lucide-react";
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
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading...
      </div>
    }>
      <TradeNewInner />
    </Suspense>
  );
}

function TradeNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const recipientHandle = searchParams.get("with") || "";

  // Parse requested cards — array from Discover (?requests=json) or single from friend-set page
  const requestedCards = (() => {
    const raw = searchParams.get("requests");
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (e) {
        console.error("Failed to parse requests param:", raw, e);
      }
    }
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
  const [allRows, setAllRows] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState({});
  const [expandedSet, setExpandedSet] = useState(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [understood, setUnderstood] = useState(false);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      // Step 1: collection_entries — flat, no joins (avoids PostgREST ambiguity)
      const PAGE = 1000;
      const entryRows = [];
      let from = 0;
      while (true) {
        const { data, error: fetchErr } = await supabase
          .from("collection_entries")
          .select("printing_id, set_id, card_number, duplicate_count")
          .eq("user_id", user.id)
          .eq("checked", true)
          .eq("is_graded", false)
          .range(from, from + PAGE - 1);
        if (fetchErr) {
          console.error("[trade/new] collection_entries query failed:", fetchErr.message, fetchErr.details, fetchErr.hint, fetchErr.code);
          setLoadError(fetchErr.message);
          setStatus("error");
          return;
        }
        entryRows.push(...(data || []));
        if ((data || []).length < PAGE) break;
        from += PAGE;
      }

      console.log("[trade/new] entryRows loaded:", entryRows.length);

      if (entryRows.length === 0) {
        setAllRows([]);
        setStatus("ok");
        return;
      }

      const printingIds = [...new Set(entryRows.map((e) => e.printing_id).filter(Boolean))];
      const setIds = [...new Set(entryRows.map((e) => e.set_id).filter(Boolean))];
      console.log("[trade/new] printingIds:", printingIds.length, "setIds:", setIds.length);

      // Step 2: printings + sets in parallel
      const [{ data: printingsData, error: pErr }, { data: setsData, error: sErr }] = await Promise.all([
        supabase.from("printings").select("id, card_id, printing_label, image_url, price_usd").in("id", printingIds),
        supabase.from("sets").select("id, name, logo_url, theme_primary").in("id", setIds),
      ]);
      if (pErr) {
        console.error("[trade/new] printings query failed:", pErr.message, pErr.details, pErr.hint, pErr.code);
        setLoadError(pErr.message);
        setStatus("error");
        return;
      }
      if (sErr) {
        console.error("[trade/new] sets query failed:", sErr.message, sErr.details, sErr.hint, sErr.code);
        setLoadError(sErr.message);
        setStatus("error");
        return;
      }

      console.log("[trade/new] printingsData:", printingsData?.length, "setsData:", setsData?.length);

      // Step 3: card names from cards table
      const cardIds = [...new Set((printingsData || []).map((p) => p.card_id).filter(Boolean))];
      console.log("[trade/new] cardIds:", cardIds.length);
      const { data: cardsData, error: cErr } = await supabase
        .from("cards")
        .select("id, name")
        .in("id", cardIds);
      if (cErr) {
        console.error("[trade/new] cards query failed:", cErr.message, cErr.details, cErr.hint, cErr.code);
        setLoadError(cErr.message);
        setStatus("error");
        return;
      }

      // Build lookup maps
      const printingMap = Object.fromEntries((printingsData || []).map((p) => [p.id, p]));
      const setMap = Object.fromEntries((setsData || []).map((s) => [s.id, s]));
      const cardMap = Object.fromEntries((cardsData || []).map((c) => [c.id, c]));

      // Join client-side
      const joined = entryRows
        .filter((e) => e.printing_id && printingMap[e.printing_id])
        .map((e) => {
          const p = printingMap[e.printing_id];
          const s = setMap[e.set_id] || {};
          const c = cardMap[p.card_id] || {};
          return {
            printing_id: e.printing_id,
            set_id: e.set_id,
            card_number: e.card_number,
            duplicate_count: e.duplicate_count || 0,
            cardName: c.name || "",
            printingLabel: p.printing_label || "",
            imageUrl: p.image_url || "",
            priceUsd: Number(p.price_usd) || 0,
            setName: s.name || e.set_id,
            setLogoUrl: s.logo_url || "",
            setThemePrimary: s.theme_primary || "#b9ff3c",
          };
        });

      setAllRows(joined);
      setStatus("ok");
    })();
  }, []);

  const visibleRows = useMemo(
    () => (showAll ? allRows : allRows.filter((r) => r.duplicate_count >= 1)),
    [allRows, showAll]
  );

  const setGroups = useMemo(() => {
    const groups = {};
    for (const row of visibleRows) {
      if (!groups[row.set_id]) {
        groups[row.set_id] = {
          setId: row.set_id,
          setName: row.setName,
          setLogoUrl: row.setLogoUrl,
          setThemePrimary: row.setThemePrimary,
          rows: [],
        };
      }
      groups[row.set_id].rows.push(row);
    }
    return Object.values(groups).sort((a, b) => a.setName.localeCompare(b.setName));
  }, [visibleRows]);

  const searchLower = search.toLowerCase().trim();
  const isSearching = searchLower.length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return visibleRows.filter(
      (r) =>
        r.cardName.toLowerCase().includes(searchLower) ||
        r.setName.toLowerCase().includes(searchLower) ||
        String(r.card_number).includes(searchLower)
    );
  }, [visibleRows, searchLower, isSearching]);

  const toggleSelect = (printingId) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[printingId]) delete next[printingId];
      else next[printingId] = true;
      return next;
    });
  };

  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected[r.printing_id]),
    [visibleRows, selected]
  );
  const offerTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + r.priceUsd, 0),
    [selectedRows]
  );
  const ratio = requestTotalPrice > 0 ? offerTotal / requestTotalPrice : null;
  const undervalued = ratio !== null && ratio < 0.75;
  const canSubmit = selectedRows.length > 0 && (!undervalued || understood);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const offerItems = selectedRows.map((r) => ({
      printing_id: r.printing_id,
      card_name: r.cardName,
      set_name: r.setName,
      set_id: r.set_id,
      card_number: r.card_number,
      price_usd: r.priceUsd || null,
      image_url: r.imageUrl || null,
      printing_label: r.printingLabel || null,
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
      setSubmitError(data.error || "Failed to propose trade");
      setSubmitting(false);
      return;
    }

    router.push(`/messages/${recipientHandle}?tradeProposed=1`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading your collection…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-sm text-rose-300 text-center">{loadError}</p>
        <button onClick={() => router.back()} className="text-[var(--po-green)] underline text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[var(--po-bg)] text-[var(--po-text)] overflow-hidden">
      <div className="flex flex-col h-full max-w-sm mx-auto">

        {/* Header */}
        <header className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[var(--po-border)]">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[var(--po-text-dim)] text-sm mb-2">
            <ArrowLeft size={15} /> Back
          </button>
          <h1 className="font-black text-base uppercase tracking-tight">Propose Trade</h1>
          <p className="text-[10px] text-[var(--po-text-dim)] mt-0.5">with @{recipientHandle}</p>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* You want — scrolls away */}
          {requestedCards.length > 0 && (
            <div className="px-4 py-3 border-b border-[var(--po-border)]">
              <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mb-2">
                You want{requestedCards.length > 1 ? ` (${requestedCards.length})` : ""}
              </p>
              {requestedCards.length === 1 ? (
                <div className="flex items-center gap-3 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-xl p-3">
                  {requestedCards[0].imageUrl ? (
                    <img src={requestedCards[0].imageUrl} alt={requestedCards[0].cardName} className="w-12 h-[68px] object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-[68px] rounded-lg bg-[var(--po-bg)] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm leading-tight">{requestedCards[0].cardName}</div>
                    {requestedCards[0].printingLabel && (
                      <div className="text-[10px] text-[var(--po-text-dim)] mt-0.5">{requestedCards[0].printingLabel}</div>
                    )}
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
                    <div key={i} className="flex-none rounded-xl border border-[var(--po-border)] overflow-hidden bg-[var(--po-bg-soft)]" style={{ width: 88, scrollSnapAlign: "start" }}>
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.cardName} className="w-full object-cover" style={{ height: 120 }} />
                      ) : (
                        <div className="flex items-center justify-center p-2 text-center text-[8px] text-[var(--po-text-dim)]" style={{ height: 120 }}>{c.cardName}</div>
                      )}
                      <div className="px-1.5 py-1.5">
                        <div className="text-[9px] font-bold leading-tight line-clamp-2">{c.cardName}</div>
                        {c.priceUsd > 0 && <div className="text-[9px] font-black mt-0.5" style={{ color: "var(--po-green)" }}>{fmtMoney(c.priceUsd, currency)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sticky controls — sticks inside scroll container once "You want" scrolls off */}
          <div className="sticky top-0 z-10 bg-[var(--po-bg)]/95 backdrop-blur border-b border-[var(--po-border)] px-4 py-3 space-y-2">
            {/* Value bar */}
            {requestTotalPrice > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--po-text-dim)]">Your offer</span>
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

            {/* 75% warning */}
            {undervalued && !understood && (
              <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <AlertTriangle size={12} /> Offer under 75% of card value
                </div>
                <p className="text-[10px] text-amber-200/70 leading-relaxed">Your friend may decline this offer.</p>
                <button onClick={() => setUnderstood(true)} className="text-[10px] font-bold text-amber-400 underline">
                  I understand, send anyway
                </button>
              </div>
            )}

            {/* Toggle + search row */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">
                {showAll ? "Your collection" : "Your duplicates"}
              </span>
              <button
                onClick={() => { setShowAll((v) => !v); setSelected({}); }}
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--po-green)" }}
              >
                {showAll ? "Dupes only" : "All cards"}
              </button>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--po-text-dim)] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards or sets…"
                className="w-full pl-8 pr-7 py-2 text-xs bg-[var(--po-bg)] border border-[var(--po-border)] rounded-xl text-[var(--po-text)] placeholder:text-[var(--po-text-dim)] focus:outline-none focus:border-[var(--po-green)]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X size={12} className="text-[var(--po-text-dim)]" />
                </button>
              )}
            </div>
          </div>

          {/* Card list */}
          <div className="px-4 pt-3 pb-8">
            {visibleRows.length === 0 && (
              <p className="text-sm text-[var(--po-text-dim)] py-8 text-center">
                {showAll
                  ? "No cards in your collection yet."
                  : "No duplicates yet — tap 'All cards' to offer any card."}
              </p>
            )}

            {isSearching ? (
              /* Flat search results */
              <div className="space-y-1">
                {searchResults.length === 0 && visibleRows.length > 0 && (
                  <p className="text-sm text-[var(--po-text-dim)] py-8 text-center">No cards match "{search}"</p>
                )}
                {searchResults.map((row) => {
                  const isSel = !!selected[row.printing_id];
                  return (
                    <button
                      key={row.printing_id}
                      onClick={() => toggleSelect(row.printing_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left"
                      style={{
                        borderColor: isSel ? "var(--po-green)" : "var(--po-border)",
                        background: isSel ? "rgba(200,255,74,0.06)" : "transparent",
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSel ? "var(--po-green)" : "transparent",
                          border: `2px solid ${isSel ? "var(--po-green)" : "var(--po-border)"}`,
                        }}
                      >
                        {isSel && <Check size={11} strokeWidth={3} className="text-black" />}
                      </div>
                      {row.imageUrl && (
                        <img src={row.imageUrl} alt={row.cardName} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{row.cardName}</div>
                        <div className="text-[10px] text-[var(--po-text-dim)] truncate">{row.setName} · {row.printingLabel}</div>
                      </div>
                      {row.priceUsd > 0 && (
                        <span className="text-xs font-bold flex-shrink-0 tabular-nums" style={{ color: "var(--po-green)" }}>
                          {fmtMoney(row.priceUsd, currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Set-grouped view */
              <div className="space-y-2">
                {setGroups.map((group) => {
                  const isExpanded = expandedSet === group.setId;
                  const selCount = group.rows.filter((r) => selected[r.printing_id]).length;
                  return (
                    <div key={group.setId} className="rounded-xl overflow-hidden border border-[var(--po-border)]">
                      <button
                        onClick={() => setExpandedSet(isExpanded ? null : group.setId)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        style={{ background: "var(--po-bg-soft)" }}
                      >
                        {group.setLogoUrl ? (
                          <img src={group.setLogoUrl} alt={group.setName} className="h-6 w-auto flex-shrink-0 object-contain" style={{ maxWidth: 48 }} />
                        ) : (
                          <div className="w-8 h-6 rounded flex-shrink-0" style={{ background: group.setThemePrimary + "30" }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold block truncate">{group.setName}</span>
                          <span className="text-[10px] text-[var(--po-text-dim)]">
                            {group.rows.length} card{group.rows.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {selCount > 0 && (
                          <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--po-green)", color: "#050507" }}
                          >
                            {selCount}
                          </span>
                        )}
                        <ChevronDown
                          size={14}
                          className={`text-[var(--po-text-dim)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="grid grid-cols-3 gap-2 p-2 border-t border-[var(--po-border)]" style={{ background: "var(--po-bg)" }}>
                          {group.rows.map((row) => {
                            const isSel = !!selected[row.printing_id];
                            return (
                              <button
                                key={row.printing_id}
                                onClick={() => toggleSelect(row.printing_id)}
                                className="relative flex flex-col rounded-lg overflow-hidden text-left"
                                style={{
                                  outline: isSel ? "2px solid var(--po-green)" : "2px solid transparent",
                                  outlineOffset: 1,
                                }}
                              >
                                <div className="relative bg-black/20" style={{ aspectRatio: "2.5/3.5" }}>
                                  {row.imageUrl ? (
                                    <img src={row.imageUrl} alt={row.cardName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center p-1 text-center text-[7px] text-[var(--po-text-dim)]">
                                      {row.cardName}
                                    </div>
                                  )}
                                  {isSel && (
                                    <div
                                      className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                      style={{ background: "var(--po-green)" }}
                                    >
                                      <Check size={9} strokeWidth={3} className="text-black" />
                                    </div>
                                  )}
                                </div>
                                <div className="px-1 pt-1 pb-1.5" style={{ background: "var(--po-bg-soft)" }}>
                                  <p className="text-[8px] font-bold leading-tight line-clamp-1 text-[var(--po-text)]">{row.cardName}</p>
                                  {row.priceUsd > 0 && (
                                    <p className="text-[8px] font-black mt-0.5" style={{ color: "var(--po-green)" }}>
                                      {fmtMoney(row.priceUsd, currency)}
                                    </p>
                                  )}
                                </div>
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

        {/* Footer — always visible at bottom */}
        <div className="flex-shrink-0 border-t border-[var(--po-border)] px-4 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {submitError && <p className="text-xs text-rose-400 mb-2 text-center">{submitError}</p>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-black disabled:opacity-40 po-glow-green flex items-center justify-center gap-2"
            style={{ background: "var(--po-green)" }}
          >
            <ArrowLeftRight size={14} />
            {submitting
              ? "Sending…"
              : selectedRows.length === 0
              ? "Select cards to offer"
              : `Propose Trade (${selectedRows.length} card${selectedRows.length !== 1 ? "s" : ""})`}
          </button>
        </div>

      </div>
    </div>
  );
}
