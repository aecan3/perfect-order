"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Star, ArrowLeftRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { fetchUserDuplicates } from "@/lib/queries/duplicates";
import { rarityBucket, BUCKET_ORDER } from "@/lib/rarity";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import BackButton from "@/components/BackButton";

const rarityRankOf = (rarity) => {
  const bucket = rarityBucket(rarity, [], 0, 0);
  const idx = BUCKET_ORDER.indexOf(bucket);
  return idx === -1 ? 999 : idx;
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

export default function DuplicatesPage() {
  const { handle } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState("loading"); // loading | ok | not-found | not-friends
  const [viewerId, setViewerId] = useState(null);
  const [viewerHandle, setViewerHandle] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState("price-desc");
  const [setFilter, setSetFilter] = useState(null);
  const currency = "AUD";

  const availableSets = useMemo(() => {
    const seen = new Map();
    for (const d of duplicates) {
      if (!seen.has(d.set_id)) seen.set(d.set_id, d.set_name);
    }
    return [...seen.entries()].map(([set_id, set_name]) => ({ set_id, set_name }));
  }, [duplicates]);

  const sortedDuplicates = useMemo(() => {
    const filtered = setFilter ? duplicates.filter(d => d.set_id === setFilter) : duplicates;
    const arr = [...filtered];
    if (sortBy === "price-desc") {
      arr.sort((a, b) => (Number(b.price_usd) || 0) - (Number(a.price_usd) || 0));
    } else if (sortBy === "price-asc") {
      arr.sort((a, b) => (Number(a.price_usd) || 0) - (Number(b.price_usd) || 0));
    } else if (sortBy === "name") {
      arr.sort((a, b) => (a.card_name || "").localeCompare(b.card_name || ""));
    } else if (sortBy === "rarity") {
      arr.sort((a, b) => rarityRankOf(b.rarity) - rarityRankOf(a.rarity));
    }
    return arr;
  }, [duplicates, sortBy, setFilter]);

  const toggleSelect = (printingId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(printingId) ? next.delete(printingId) : next.add(printingId);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      // Resolve target handle → profile
      const { data: targetProf } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .eq("handle", handle)
        .maybeSingle();

      if (cancelled) return;
      if (!targetProf) { setStatus("not-found"); return; }

      // Resolve viewer's own handle for isOwnPage check
      const { data: viewerProf } = await supabase
        .from("profiles")
        .select("id, handle")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const isOwnPage = user.id === targetProf.id;

      if (!isOwnPage) {
        // Privacy: only friends can view each other's duplicates
        const { data: friendship } = await supabase
          .from("friendships")
          .select("id")
          .or(`and(user_a.eq.${user.id},user_b.eq.${targetProf.id}),and(user_a.eq.${targetProf.id},user_b.eq.${user.id})`)
          .eq("status", "accepted")
          .maybeSingle();

        if (cancelled) return;
        if (!friendship) { setStatus("not-friends"); return; }
      }

      setViewerId(user.id);
      setViewerHandle(viewerProf?.handle || "");
      setTargetProfile(targetProf);

      const data = await fetchUserDuplicates(supabase, targetProf.id, user.id);
      if (cancelled) return;

      setDuplicates(data);
      setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [handle, router, supabase]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <MSShell>
        <div style={{ padding: "2rem 1.25rem", color: "var(--po-text-dim)", textAlign: "center" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <MSShell>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>User not found.</p>
        </div>
      </MSShell>
    );
  }

  // ── Not friends (privacy gate) ───────────────────────────────────────────
  if (status === "not-friends") {
    return (
      <MSShell>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "var(--po-text-dim)", fontSize: 14, lineHeight: 1.55 }}>
            You can only view duplicates from friends.<br />Add @{handle} as a friend first.
          </p>
        </div>
      </MSShell>
    );
  }

  // ── Resolved ─────────────────────────────────────────────────────────────
  const isOwnPage = viewerId && targetProfile && viewerId === targetProfile.id;
  const huntCount = duplicates.filter((d) => d.hunted_by_viewer).length;

  return (
    <MSShell hideTabBar={!isOwnPage && selected.size > 0}>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <BackButton />
        </div>
        <MSPageTitle sub={isOwnPage ? null : `@${handle}`}>
          {isOwnPage ? "Your Duplicates" : "Duplicates"}
        </MSPageTitle>

        {/* Hunting-match banner — friend view only */}
        {!isOwnPage && huntCount > 0 && (
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
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>No duplicates available.</p>
          </div>
        )}

        {/* Sort pills */}
        {duplicates.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 mb-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <button
              onClick={() => setSortBy(sortBy === "price-desc" ? "price-asc" : "price-desc")}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                sortBy === "price-desc" || sortBy === "price-asc"
                  ? "bg-[var(--po-green)] text-black font-bold"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              }`}
            >
              {sortBy === "price-asc" ? "Price ↑" : "Price ↓"}
            </button>
            <button
              onClick={() => setSortBy("name")}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                sortBy === "name"
                  ? "bg-[var(--po-green)] text-black font-bold"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy("rarity")}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                sortBy === "rarity"
                  ? "bg-[var(--po-green)] text-black font-bold"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              }`}
            >
              Rarity
            </button>
          </div>
        )}

        {/* Set filter chips — only when dupes span multiple sets */}
        {availableSets.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 mb-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <button
              onClick={() => setSetFilter(null)}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                setFilter === null
                  ? "bg-[var(--po-green)] text-black font-bold"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              }`}
            >
              All
            </button>
            {availableSets.map(({ set_id, set_name }) => (
              <button
                key={set_id}
                onClick={() => setSetFilter(set_id)}
                className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                  setFilter === set_id
                    ? "bg-[var(--po-green)] text-black font-bold"
                    : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
                }`}
              >
                {set_name}
              </button>
            ))}
          </div>
        )}

        {/* Card grid */}
        {duplicates.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}>
            {sortedDuplicates.map((card) => (
              <div
                key={card.printing_id}
                onClick={() => !isOwnPage && toggleSelect(card.printing_id)}
                style={{
                  position: "relative",
                  borderRadius: "var(--border-radius-md)",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.4)",
                  aspectRatio: "2.5/3.5",
                  cursor: isOwnPage ? "default" : "pointer",
                  outline: !isOwnPage && selected.has(card.printing_id) ? "2px solid var(--po-green)" : "none",
                  outlineOffset: 2,
                  boxShadow: !isOwnPage && card.hunted_by_viewer ? "0 0 16px 2px rgba(255,184,48,0.55)" : "none",
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

      {/* Fixed bottom selection bar — friend view only */}
      {!isOwnPage && selected.size > 0 && (
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
