"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, ArrowLeftRight, X, ChevronDown } from "lucide-react";
import { AnonymousBinderActionSheet } from "@/components/marketplace/AnonymousBinderActionSheet";
import { AnonymousSignupConfirm } from "@/components/AnonymousSignupConfirm";
import { createClient } from "@/lib/supabase";
import { fetchUserDuplicates } from "@/lib/queries/duplicates";
import { rarityBucket, BUCKET_ORDER } from "@/lib/rarity";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import BackButton from "@/components/BackButton";
import { Avatar } from "@/components/Avatar";

const rarityRankOf = (rarity) => {
  const bucket = rarityBucket(rarity, [], 0, 0);
  const idx = BUCKET_ORDER.indexOf(bucket);
  return idx === -1 ? 999 : idx;
};

const SORT_OPTIONS = [
  { value: "price-desc", label: "Price ↓" },
  { value: "price-asc",  label: "Price ↑" },
  { value: "name-asc",   label: "Name A–Z" },
  { value: "name-desc",  label: "Name Z–A" },
];

function priceBucketOf(priceUsd) {
  const p = Number(priceUsd) || 0;
  if (p < 1)   return "0-1";
  if (p < 5)   return "1-5";
  if (p < 15)  return "5-15";
  if (p < 50)  return "15-50";
  if (p < 150) return "50-150";
  return "150+";
}

const PRICE_BUCKET_ORDER  = ["0-1", "1-5", "5-15", "15-50", "50-150", "150+"];
const PRICE_BUCKET_LABELS = {
  "0-1":    "$0–1",
  "1-5":    "$1–5",
  "5-15":   "$5–15",
  "15-50":  "$15–50",
  "50-150": "$50–150",
  "150+":   "$150+",
};

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};

function fmtMoney(priceUsd, currency) {
  const { rate, symbol } = RATES[currency] || RATES.AUD;
  const val = priceUsd * rate;
  return `${symbol}${val < 10 ? val.toFixed(2) : Math.round(val)}`;
}

export default function TradeBinderPage() {
  const { handle } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState("loading"); // loading | ok | not-found
  const [viewerId, setViewerId] = useState(null);
  const [viewerHandle, setViewerHandle] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState("price-desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen]     = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [setFilter, setSetFilter]       = useState(new Set());
  const [rarityFilter, setRarityFilter] = useState(new Set());
  const [priceFilter, setPriceFilter]   = useState(new Set());
  const [sectionsOpen, setSectionsOpen] = useState({ set: true, rarity: true, price: true });
  const [mounted, setMounted]           = useState(false);
  const [anonSelectedCard, setAnonSelectedCard] = useState(null);
  const [confirmIntent, setConfirmIntent] = useState(null);
  const currency = "AUD";

  // ── Faceted options ─────────────────────────────────────────────────────────
  // Each section ignores ITS OWN filter when computing which options to show,
  // so multi-select within a section doesn't hide its siblings.

  const setOptions = useMemo(() => {
    const relevant = duplicates.filter(d => {
      const rarityOk = rarityFilter.size === 0 || rarityFilter.has(d.rarity);
      const priceOk  = priceFilter.size  === 0 || priceFilter.has(priceBucketOf(d.price_usd));
      return rarityOk && priceOk;
    });
    const seen = new Map();
    for (const d of relevant) {
      if (!seen.has(d.set_id)) seen.set(d.set_id, d.set_name);
    }
    return [...seen.entries()].map(([set_id, set_name]) => ({ set_id, set_name }));
  }, [duplicates, rarityFilter, priceFilter]);

  const rarityOptions = useMemo(() => {
    const relevant = duplicates.filter(d => {
      const setOk   = setFilter.size   === 0 || setFilter.has(d.set_id);
      const priceOk = priceFilter.size === 0 || priceFilter.has(priceBucketOf(d.price_usd));
      return setOk && priceOk;
    });
    const seen = new Set();
    for (const d of relevant) seen.add(d.rarity);
    return [...seen].sort((a, b) => rarityRankOf(a) - rarityRankOf(b));
  }, [duplicates, setFilter, priceFilter]);

  const priceOptions = useMemo(() => {
    const relevant = duplicates.filter(d => {
      const setOk    = setFilter.size    === 0 || setFilter.has(d.set_id);
      const rarityOk = rarityFilter.size === 0 || rarityFilter.has(d.rarity);
      return setOk && rarityOk;
    });
    const seen = new Set();
    for (const d of relevant) seen.add(priceBucketOf(d.price_usd));
    return PRICE_BUCKET_ORDER.filter(b => seen.has(b));
  }, [duplicates, setFilter, rarityFilter]);

  // ── Displayed duplicates = all three filters AND'd ───────────────────────
  const filteredDuplicates = useMemo(() => {
    return duplicates.filter(d => {
      const setOk    = setFilter.size    === 0 || setFilter.has(d.set_id);
      const rarityOk = rarityFilter.size === 0 || rarityFilter.has(d.rarity);
      const priceOk  = priceFilter.size  === 0 || priceFilter.has(priceBucketOf(d.price_usd));
      return setOk && rarityOk && priceOk;
    });
  }, [duplicates, setFilter, rarityFilter, priceFilter]);

  const sortedDuplicates = useMemo(() => {
    const arr = [...filteredDuplicates];
    if (sortBy === "price-desc") {
      arr.sort((a, b) => (Number(b.price_usd) || 0) - (Number(a.price_usd) || 0));
    } else if (sortBy === "price-asc") {
      arr.sort((a, b) => (Number(a.price_usd) || 0) - (Number(b.price_usd) || 0));
    } else if (sortBy === "name-asc") {
      arr.sort((a, b) => (a.card_name || "").localeCompare(b.card_name || ""));
    } else if (sortBy === "name-desc") {
      arr.sort((a, b) => (b.card_name || "").localeCompare(a.card_name || ""));
    }
    return arr;
  }, [filteredDuplicates, sortBy]);

  const toggleSelect = (printingId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(printingId) ? next.delete(printingId) : next.add(printingId);
      return next;
    });
  };

  const captureIntentAndGoToSignup = (card, intentSubType = "message") => {
    const params = new URLSearchParams({
      returnTo: `/trade-binder/${handle}`,
      intentType: "propose_trade",
      intentSubType,
      sharerHandle: handle,
      targetPrintingId: card.printing_id,
    });
    if (card.card_name) params.set("targetCardName", card.card_name);

    try {
      sessionStorage.setItem("ms_anon_intent", JSON.stringify({
        type: "propose_trade",
        intentSubType,
        sharerHandle: handle,
        targetPrintingId: card.printing_id,
        targetCardName: card.card_name || null,
        capturedAt: Date.now(),
      }));
    } catch (e) {
      // sessionStorage unavailable — URL params carry the intent
    }

    router.push(`/welcome?${params.toString()}`);
  };

  const handleAnonMessage = () => {
    const card = anonSelectedCard;
    setAnonSelectedCard(null);
    setConfirmIntent({ type: "message", card });
  };

  const handleAnonTrade = () => {
    const card = anonSelectedCard;
    setAnonSelectedCard(null);
    setConfirmIntent({ type: "trade", card });
  };

  const handleConfirm = () => {
    const { type, card } = confirmIntent;
    setConfirmIntent(null);
    captureIntentAndGoToSignup(card, type);
  };

  const handleConfirmCancel = () => {
    setConfirmIntent(null);
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!filterOpen) return;
    const fn = (e) => { if (e.key === "Escape") closeFilter(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOpen]);

  const openFilter = () => {
    setFilterOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setFilterVisible(true)));
  };
  const closeFilter = () => {
    setFilterVisible(false);
    setTimeout(() => setFilterOpen(false), 260);
  };
  const toggleSetFilter    = (v) => setSetFilter(s    => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const toggleRarityFilter = (v) => setRarityFilter(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const togglePriceFilter  = (v) => setPriceFilter(s  => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const clearFilters = () => { setSetFilter(new Set()); setRarityFilter(new Set()); setPriceFilter(new Set()); };
  const activeFilterCount = setFilter.size + rarityFilter.size + priceFilter.size;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const anonymous = !user;

      // Resolve target handle → profile (works for anon via RLS)
      const { data: targetProf } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .eq("handle", handle)
        .maybeSingle();

      if (cancelled) return;
      if (!targetProf) { setStatus("not-found"); return; }

      if (!anonymous) {
        // Resolve viewer's own handle for isOwnPage check and trade proposal
        const { data: viewerProf } = await supabase
          .from("profiles")
          .select("id, handle")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;
        setViewerId(user.id);
        setViewerHandle(viewerProf?.handle || "");
      }

      setTargetProfile(targetProf);

      const data = await fetchUserDuplicates(supabase, targetProf.id, anonymous ? null : user.id);
      if (cancelled) return;

      setDuplicates(data);
      setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [handle, supabase]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <MSShell hideTabBar>
        <div style={{ padding: "2rem 1.25rem", color: "var(--po-text-dim)", textAlign: "center" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <MSShell hideTabBar>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>User not found.</p>
        </div>
      </MSShell>
    );
  }

  // ── Resolved ─────────────────────────────────────────────────────────────
  const isAnonymous = !viewerId;
  const isOwnPage = !isAnonymous && viewerId === targetProfile?.id;
  const huntCount = duplicates.filter((d) => d.hunted_by_viewer).length;

  return (
    <MSShell hideTabBar={isAnonymous || (!isOwnPage && selected.size > 0)}>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <BackButton />
        </div>
        <MSPageTitle sub={isOwnPage ? null : `@${handle}`}>
          {isOwnPage ? "Your Trade Binder" : "Trade Binder"}
        </MSPageTitle>

        {/* Sharer profile link — shown to all non-owner viewers (anon + logged-in) */}
        {!isOwnPage && targetProfile && (
          <Link
            href={`/friend/${handle}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              textDecoration: "none",
              marginBottom: 16,
            }}
          >
            <Avatar profile={targetProfile} size={28} />
            <span style={{ fontSize: 13, color: "var(--po-text-dim)" }}>@{handle}</span>
          </Link>
        )}

        {/* Hunting-match banner — logged-in friend view only */}
        {!isAnonymous && !isOwnPage && huntCount > 0 && (
          <div style={{
            margin: "0 0 16px",
            padding: "10px 14px",
            background: "rgba(200,255,74,0.08)",
            border: "0.5px solid rgba(200,255,74,0.25)",
            borderRadius: "var(--border-radius-md)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <Star size={14} style={{ color: "var(--po-green)", flexShrink: 0 }} fill="var(--po-green)" />
            <span style={{ color: "var(--po-green)", fontSize: 13, fontWeight: 500 }}>
              {huntCount} of these match cards you&apos;re hunting
            </span>
          </div>
        )}

        {/* Empty state */}
        {duplicates.length === 0 && (
          <div style={{ padding: "3rem 0", textAlign: "center" }}>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>No cards in your Trade Binder yet.</p>
          </div>
        )}

        {/* Sort + Filter control row */}
        {duplicates.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>

            {/* Sort dropdown */}
            <div style={{ position: "relative" }}>
              {sortOpen && (
                <div onClick={() => setSortOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              )}
              <button
                onClick={() => setSortOpen(o => !o)}
                style={{ position: "relative", zIndex: 50 }}
                className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              >
                Sort: {SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? "Price ↓"}
              </button>
              {sortOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
                  background: "var(--po-bg-soft)",
                  border: "1px solid var(--po-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  minWidth: 148,
                }}>
                  {SORT_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                      style={{
                        width: "100%", display: "block",
                        padding: "11px 16px",
                        background: sortBy === opt.value ? "rgba(200,255,74,0.1)" : "none",
                        color: sortBy === opt.value ? "var(--po-green)" : "var(--po-text)",
                        fontWeight: sortBy === opt.value ? 700 : 400,
                        fontSize: 13,
                        border: "none",
                        borderBottom: i < SORT_OPTIONS.length - 1 ? "1px solid var(--po-border)" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {sortBy === opt.value && "✓ "}{opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter button */}
            <button
              onClick={openFilter}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap border ${
                activeFilterCount > 0
                  ? "bg-[var(--po-green)] text-black font-bold border-[var(--po-green)]"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border-[var(--po-border)]"
              }`}
            >
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
            </button>

          </div>
        )}

        {/* N-of-M context when filters are active */}
        {duplicates.length > 0 && activeFilterCount > 0 && (
          <p style={{ fontSize: 11, color: "var(--po-text-dim)", marginTop: -6, marginBottom: 10 }}>
            Showing {filteredDuplicates.length} of {duplicates.length}
          </p>
        )}

        {/* Filtered-empty state */}
        {duplicates.length > 0 && filteredDuplicates.length === 0 && (
          <div style={{ padding: "3rem 0", textAlign: "center" }}>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14, marginBottom: 14 }}>
              No cards match these filters.
            </p>
            <button
              onClick={clearFilters}
              style={{
                background: "none",
                border: "1px solid var(--po-border)",
                borderRadius: 999,
                padding: "7px 16px",
                color: "var(--po-text-dim)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Card grid */}
        {duplicates.length > 0 && filteredDuplicates.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}>
            {sortedDuplicates.map((card) => (
              <div
                key={card.printing_id}
                onClick={() => {
                  if (isAnonymous) setAnonSelectedCard(card);
                  else if (!isOwnPage) toggleSelect(card.printing_id);
                }}
                style={{
                  position: "relative",
                  borderRadius: "var(--border-radius-md)",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.4)",
                  aspectRatio: "2.5/3.5",
                  cursor: isOwnPage ? "default" : "pointer",
                  outline:
                    (!isAnonymous && !isOwnPage && selected.has(card.printing_id)) ||
                    (isAnonymous && anonSelectedCard?.printing_id === card.printing_id)
                      ? "2px solid var(--po-green)"
                      : "none",
                  outlineOffset: 2,
                  boxShadow: !isAnonymous && !isOwnPage && card.hunted_by_viewer ? "0 0 16px 2px rgba(255,184,48,0.55)" : "none",
                }}
              >
                {/* Card image */}
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.card_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 8, textAlign: "center",
                    fontSize: 8, color: "var(--po-text-faint)", lineHeight: 1.3,
                  }}>
                    {card.card_name}
                  </div>
                )}

                {/* Bottom gradient overlay */}
                <div style={{
                  position: "absolute", inset: "auto 0 0",
                  padding: "20px 6px 6px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)",
                  display: "flex", alignItems: "flex-end", gap: 4,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {card.set_name} · #{card.card_number}
                    </div>
                    {card.price_usd > 0 && (
                      <div style={{ fontSize: 9, fontWeight: 900, color: "var(--po-green)" }}>
                        {fmtMoney(Number(card.price_usd), currency)}
                      </div>
                    )}
                  </div>
                  {card.set_logo_url && (
                    <img
                      src={card.set_logo_url}
                      alt={card.set_name}
                      style={{ height: 22, width: "auto", objectFit: "contain", flexShrink: 0, opacity: 0.8 }}
                    />
                  )}
                </div>

                {/* ×N duplicate badge */}
                <div style={{
                  position: "absolute", top: 5, left: 5,
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 4,
                  padding: "2px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.9)",
                  letterSpacing: "0.02em",
                }}>
                  ×{card.duplicate_count}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* Filter panel — slide in from right */}
      {filterOpen && mounted && createPortal(
        <div>
          {/* Backdrop */}
          <div
            onClick={closeFilter}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)" }}
          />
          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter trade binder"
            style={{
              position: "fixed", right: 0, top: 0, bottom: 0,
              width: "85vw", maxWidth: 360,
              background: "var(--po-bg-soft)",
              zIndex: 101,
              display: "flex", flexDirection: "column",
              transform: filterVisible ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.25s ease",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid var(--po-border)", flexShrink: 0,
            }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--po-text)" }}>Filters</span>
              <button
                onClick={closeFilter}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--po-text-dim)", display: "flex", alignItems: "center", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Sections */}
            <div style={{ flex: 1, overflowY: "auto" }}>

              {/* ── Set ── */}
              <div style={{ borderBottom: "1px solid var(--po-border)" }}>
                <button
                  onClick={() => setSectionsOpen(s => ({ ...s, set: !s.set }))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--po-text)" }}>Set</span>
                  <ChevronDown size={16} style={{ color: "var(--po-text-dim)", transform: sectionsOpen.set ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {sectionsOpen.set && setOptions.map(({ set_id, set_name }) => (
                  <button
                    key={set_id}
                    onClick={() => toggleSetFilter(set_id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 20px", background: "none", border: "none",
                      borderTop: "0.5px solid var(--po-border)", cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: setFilter.has(set_id) ? "none" : "1.5px solid var(--po-border)",
                      background: setFilter.has(set_id) ? "var(--po-green)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {setFilter.has(set_id) && <span style={{ color: "#050507", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 14, color: "var(--po-text)", textAlign: "left" }}>{set_name}</span>
                  </button>
                ))}
              </div>

              {/* ── Rarity ── */}
              <div style={{ borderBottom: "1px solid var(--po-border)" }}>
                <button
                  onClick={() => setSectionsOpen(s => ({ ...s, rarity: !s.rarity }))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--po-text)" }}>Rarity</span>
                  <ChevronDown size={16} style={{ color: "var(--po-text-dim)", transform: sectionsOpen.rarity ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {sectionsOpen.rarity && rarityOptions.map((rarity) => (
                  <button
                    key={rarity}
                    onClick={() => toggleRarityFilter(rarity)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 20px", background: "none", border: "none",
                      borderTop: "0.5px solid var(--po-border)", cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: rarityFilter.has(rarity) ? "none" : "1.5px solid var(--po-border)",
                      background: rarityFilter.has(rarity) ? "var(--po-green)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {rarityFilter.has(rarity) && <span style={{ color: "#050507", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 14, color: "var(--po-text)", textAlign: "left" }}>{rarity}</span>
                  </button>
                ))}
              </div>

              {/* ── Price ── */}
              <div>
                <button
                  onClick={() => setSectionsOpen(s => ({ ...s, price: !s.price }))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--po-text)" }}>Price</span>
                  <ChevronDown size={16} style={{ color: "var(--po-text-dim)", transform: sectionsOpen.price ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {sectionsOpen.price && priceOptions.map((bucket) => (
                  <button
                    key={bucket}
                    onClick={() => togglePriceFilter(bucket)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 20px", background: "none", border: "none",
                      borderTop: "0.5px solid var(--po-border)", cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: priceFilter.has(bucket) ? "none" : "1.5px solid var(--po-border)",
                      background: priceFilter.has(bucket) ? "var(--po-green)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {priceFilter.has(bucket) && <span style={{ color: "#050507", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 14, color: "var(--po-text)", textAlign: "left" }}>{PRICE_BUCKET_LABELS[bucket]}</span>
                  </button>
                ))}
              </div>

            </div>

            {/* Footer */}
            <div style={{
              display: "flex", gap: 10, padding: "16px 20px", flexShrink: 0,
              borderTop: "1px solid var(--po-border)",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            }}>
              <button
                onClick={clearFilters}
                style={{
                  padding: "13px 16px",
                  background: "none",
                  border: "1px solid var(--po-border)",
                  borderRadius: "var(--border-radius-md)",
                  color: "var(--po-text-dim)",
                  fontSize: 14, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                Clear all
              </button>
              <button
                onClick={closeFilter}
                style={{
                  flex: 1,
                  padding: "13px 16px",
                  background: "var(--po-green)",
                  border: "none",
                  borderRadius: "var(--border-radius-md)",
                  color: "#050507",
                  fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Show {filteredDuplicates.length} result{filteredDuplicates.length !== 1 ? "s" : ""}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Anonymous action sheet — opens when anon taps a card */}
      {isAnonymous && anonSelectedCard && (
        <AnonymousBinderActionSheet
          card={anonSelectedCard}
          sharerHandle={handle}
          onClose={() => setAnonSelectedCard(null)}
          onMessage={handleAnonMessage}
          onTrade={handleAnonTrade}
        />
      )}

      {/* Signup confirmation dialog — shown after choosing an action from the sheet */}
      {confirmIntent && (
        <AnonymousSignupConfirm
          open={true}
          intentType={confirmIntent.type}
          sharerHandle={handle}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
        />
      )}

      {/* Fixed bottom bar — sign in CTA for anonymous visitors */}
      {isAnonymous && (
        <div style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          borderTop: "0.5px solid rgba(244,244,246,0.1)",
          background: "rgba(5,5,7,0.95)",
          backdropFilter: "blur(12px)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}>
          <div style={{ maxWidth: 384, margin: "0 auto" }}>
            <button
              onClick={() => router.push(`/welcome?returnTo=/trade-binder/${handle}`)}
              style={{
                width: "100%",
                padding: "15px",
                background: "var(--po-green)",
                borderRadius: "var(--border-radius-md)",
                color: "#050507",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.01em",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ArrowLeftRight size={15} />
              Sign in to propose a trade
            </button>
          </div>
        </div>
      )}

      {/* Fixed bottom selection bar — logged-in friend view only */}
      {!isAnonymous && !isOwnPage && selected.size > 0 && (
        <div style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          borderTop: "0.5px solid rgba(244,244,246,0.1)",
          background: "rgba(5,5,7,0.95)",
          backdropFilter: "blur(12px)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}>
          <div style={{ maxWidth: 384, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--po-text-dim)" }}>
                {selected.size} card{selected.size !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => setSelected(new Set())}
                style={{ fontSize: 12, fontWeight: 700, color: "var(--po-text-dim)", background: "none", border: "none", cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
            <button
              onClick={() => {
                const selectedCards = duplicates.filter(c => selected.has(c.printing_id));
                const requests = encodeURIComponent(JSON.stringify(
                  selectedCards.map(c => ({
                    printingId: c.printing_id,
                    cardName: c.card_name,
                    setName: c.set_name,
                    setId: c.set_id,
                    imageUrl: c.image_url,
                    priceUsd: c.price_usd,
                  }))
                ));
                router.push(`/trade/new?with=${handle}&requests=${requests}`);
              }}
              style={{
                width: "100%",
                padding: "15px",
                background: "var(--po-green)",
                borderRadius: "var(--border-radius-md)",
                color: "#050507",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "-0.01em",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ArrowLeftRight size={15} />
              Propose Trade · {selected.size} card{selected.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </MSShell>
  );
}
