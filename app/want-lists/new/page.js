"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "react-qr-code";
import { QrCode, Share2, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { missingCardsForSet } from "@/lib/queries/wantList";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import BackButton from "@/components/BackButton";
import * as Sentry from "@sentry/nextjs";

const PAGE = 1000;

function fmtPrice(priceUsd) {
  const val = Number(priceUsd) * 1.53;
  return `A$${val < 10 ? val.toFixed(2) : Math.round(val)}`;
}

function NewWantListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const addToSlug = searchParams.get("addTo");

  const [step, setStep] = useState("sets"); // "sets" | "cards" | "done"
  const [loadingState, setLoadingState] = useState("loading");

  // Set picker
  const [listTitle, setListTitle] = useState("");
  const [addToTitle, setAddToTitle] = useState(null);
  const [trackedSets, setTrackedSets] = useState([]);
  const [allMissingBySet, setAllMissingBySet] = useState({});
  const [selectedSetIds, setSelectedSetIds] = useState(new Set());

  // Card step
  const [deselectedIds, setDeselectedIds] = useState(new Set());

  // Done screen
  const [createdSlug, setCreatedSlug] = useState(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Data load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      const { data: userSetsData } = await supabase
        .from("user_sets")
        .select("set_id, edition_mode")
        .eq("user_id", user.id)
        .is("hidden_at", null);
      if (cancelled) return;

      const setIds = (userSetsData || []).map(us => us.set_id);
      if (!setIds.length) {
        if (!cancelled) { setTrackedSets([]); setLoadingState("ok"); }
        return;
      }

      const [{ data: setsData }, { data: printingsData }, { data: cardsData }] = await Promise.all([
        supabase.from("sets").select("id, name, logo_url").in("id", setIds),
        supabase.from("printings").select("id, card_number, set_id, printing_type, price_usd, card:cards(image_large)").in("set_id", setIds),
        supabase.from("cards").select("number, name, set_id").in("set_id", setIds),
      ]);
      if (cancelled) return;

      // Paginated collection entries
      const owned = new Set();
      let from = 0;
      while (true) {
        const { data: rows, error } = await supabase
          .from("collection_entries")
          .select("printing_id")
          .eq("user_id", user.id)
          .eq("checked", true)
          .range(from, from + PAGE - 1);
        if (error || cancelled) break;
        for (const r of rows) owned.add(r.printing_id);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (cancelled) return;

      const setsMap = Object.fromEntries((setsData || []).map(s => [s.id, s]));
      const cardNameMap = {};
      for (const c of (cardsData || [])) cardNameMap[`${c.set_id}-${c.number}`] = c.name;

      const printingsBySet = {};
      const printingDetailMap = {};
      for (const p of (printingsData || [])) {
        if (!printingsBySet[p.set_id]) printingsBySet[p.set_id] = [];
        printingsBySet[p.set_id].push(p);
        printingDetailMap[p.id] = { image_url: p.card?.image_large || null, price_usd: p.price_usd };
      }

      // For addTo mode: fetch existing list cards to exclude from candidate pool
      let existingIds = new Set();
      if (addToSlug) {
        const { data: targetList } = await supabase
          .from("want_lists")
          .select("id, title")
          .eq("slug", addToSlug)
          .maybeSingle();
        if (targetList) {
          if (!cancelled) setAddToTitle(targetList.title);
          const { data: existingCards } = await supabase
            .from("want_list_cards")
            .select("printing_id")
            .eq("want_list_id", targetList.id);
          existingIds = new Set((existingCards || []).map(c => c.printing_id));
        }
      }
      if (cancelled) return;

      const missing = {};
      for (const us of (userSetsData || [])) {
        const slots = missingCardsForSet(us.set_id, printingsBySet[us.set_id] || [], owned, us.edition_mode);
        missing[us.set_id] = slots.filter(s => !existingIds.has(s.printing_id)).map(s => ({
          ...s,
          set_name: setsMap[us.set_id]?.name || us.set_id,
          card_name: cardNameMap[`${us.set_id}-${s.card_number}`] || null,
          image_url: printingDetailMap[s.printing_id]?.image_url ?? null,
          price_usd: printingDetailMap[s.printing_id]?.price_usd ?? null,
        }));
      }

      const preSetId = searchParams.get("sets");

      if (!cancelled) {
        setTrackedSets((userSetsData || []).map(us => ({
          set_id: us.set_id,
          edition_mode: us.edition_mode,
          set_name: setsMap[us.set_id]?.name || us.set_id,
          logo_url: setsMap[us.set_id]?.logo_url || null,
        })));
        setAllMissingBySet(missing);
        if (preSetId && setIds.includes(preSetId)) setSelectedSetIds(new Set([preSetId]));
        setLoadingState("ok");
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedMissing = useMemo(() => {
    const all = [];
    for (const setId of selectedSetIds) all.push(...(allMissingBySet[setId] || []));
    return all;
  }, [selectedSetIds, allMissingBySet]);

  const totalSlots = selectedMissing.length;
  const overCap = totalSlots > 500;

  const finalCards = useMemo(
    () => selectedMissing.filter(s => !deselectedIds.has(s.printing_id)),
    [selectedMissing, deselectedIds]
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleSet = (setId) => setSelectedSetIds(prev => {
    const next = new Set(prev);
    next.has(setId) ? next.delete(setId) : next.add(setId);
    return next;
  });

  const toggleDeselect = (printingId) => setDeselectedIds(prev => {
    const next = new Set(prev);
    next.has(printingId) ? next.delete(printingId) : next.add(printingId);
    return next;
  });

  const addToList = async (cards) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/want-lists/${addToSlug}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: cards.map(c => ({
            set_id: c.set_id,
            card_number: c.card_number,
            printing_id: c.printing_id,
            edition_label: c.edition_label,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Failed to add cards");
      }
      router.replace(`/wants/${addToSlug}`);
    } catch (e) {
      Sentry.captureMessage("[want-lists] addTo POST non-OK", {
        level: "error",
        extra: { error: e.message },
      });
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const createWantList = async (cards) => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/want-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(listTitle.trim() ? { title: listTitle.trim() } : {}),
          cards: cards.map(c => ({
            set_id: c.set_id,
            card_number: c.card_number,
            printing_id: c.printing_id,
            edition_label: c.edition_label,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Creation failed");
      }
      const { slug } = await res.json();
      setSubmittedCount(cards.length);
      setCreatedSlug(slug);
      setStep("done");
    } catch (e) {
      Sentry.captureMessage("[want-lists] creation POST non-OK", {
        level: "error",
        extra: { error: e.message },
      });
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const wantUrl = createdSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/wants/${createdSlug}`
    : null;

  const handleShare = async () => {
    if (!wantUrl) return;
    if (navigator.share) {
      await navigator.share({ url: wantUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(wantUrl).catch(() => {});
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const openQr = () => {
    setQrOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setQrVisible(true)));
  };
  const closeQr = () => {
    setQrVisible(false);
    setTimeout(() => setQrOpen(false), 260);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingState === "loading") {
    return (
      <MSShell hideTabBar>
        <div style={{ padding: "2rem 1.25rem", color: "var(--po-text-dim)", textAlign: "center" }}>Loading…</div>
      </MSShell>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (step === "done") {
    const dateStr = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return (
      <MSShell hideTabBar>
        <div style={{ padding: "0 16px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <BackButton href="/you" replace />
          </div>
          <MSPageTitle>Want list created</MSPageTitle>
          <p style={{ fontSize: 13, color: "var(--po-text-dim)", marginBottom: 24 }}>
            {listTitle.trim()
              ? `"${listTitle.trim()}" created · ${submittedCount} card${submittedCount !== 1 ? "s" : ""}`
              : `${submittedCount} missing slot${submittedCount !== 1 ? "s" : ""} · ${dateStr}`}
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={handleShare}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 16px",
                background: shareCopied ? "rgba(200,255,74,0.18)" : "rgba(200,255,74,0.08)",
                border: "0.5px solid rgba(200,255,74,0.25)",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer", transition: "background 0.15s",
              }}
            >
              <Share2 size={16} style={{ color: "var(--po-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--po-green)" }}>
                {shareCopied ? "Link copied!" : "Share Want List"}
              </span>
            </button>
            {wantUrl && (
              <button
                onClick={openQr}
                aria-label="Show QR code"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "13px",
                  background: "rgba(200,255,74,0.08)", border: "0.5px solid rgba(200,255,74,0.25)",
                  borderRadius: "var(--border-radius-md)", cursor: "pointer", flexShrink: 0,
                }}
              >
                <QrCode size={16} style={{ color: "var(--po-green)" }} />
              </button>
            )}
          </div>

          {wantUrl && (
            <a
              href={`/wants/${createdSlug}`}
              style={{
                display: "block", textAlign: "center", padding: "13px 16px",
                background: "none", border: "0.5px solid var(--po-border)",
                borderRadius: "var(--border-radius-md)",
                color: "var(--po-text-dim)", fontSize: 14, fontWeight: 500,
                textDecoration: "none",
              }}
            >
              View my Want List →
            </a>
          )}
        </div>

        {/* QR sheet */}
        {qrOpen && wantUrl && mounted && createPortal(
          <>
            <div onClick={closeQr} style={{
              position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.65)",
              opacity: qrVisible ? 1 : 0, transition: "opacity 260ms ease",
            }} />
            <div
              role="dialog" aria-modal="true" aria-label="Want list QR code"
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
                background: "#0a0a0b", borderRadius: "16px 16px 0 0",
                padding: "24px 24px 40px",
                transform: qrVisible ? "translateY(0)" : "translateY(100%)",
                transition: "transform 260ms ease",
              }}
            >
              <div style={{ width: 40, height: 4, background: "rgba(244,244,246,0.18)", borderRadius: 2, margin: "0 auto 20px" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ background: "#fff", padding: 12, borderRadius: 12 }}>
                  <QRCode value={wantUrl} size={180} fgColor="#000000" bgColor="#ffffff" />
                </div>
                <p style={{ fontSize: 12, color: "var(--po-text-dim)", textAlign: "center", wordBreak: "break-all" }}>
                  {wantUrl}
                </p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(wantUrl).catch(() => {});
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }}
                  style={{
                    width: "100%", padding: "14px",
                    background: "rgba(200,255,74,0.08)", border: "0.5px solid rgba(200,255,74,0.25)",
                    borderRadius: "var(--border-radius-md)",
                    color: "var(--po-green)", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {shareCopied ? "Copied!" : "Copy link"}
                </button>
                <button
                  onClick={closeQr}
                  style={{
                    width: "100%", padding: "14px",
                    background: "rgba(244,244,246,0.06)", border: "1px solid rgba(244,244,246,0.12)",
                    borderRadius: "var(--border-radius-md)",
                    color: "rgba(244,244,246,0.55)", fontSize: 14, cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      </MSShell>
    );
  }

  // ── Step 2: Card deselection grid ──────────────────────────────────────────
  if (step === "cards") {
    const selectedCount = finalCards.length;
    const allSelected = deselectedIds.size === 0;
    const toggleAll = () => {
      if (allSelected) {
        setDeselectedIds(new Set(selectedMissing.map(c => c.printing_id)));
      } else {
        setDeselectedIds(new Set());
      }
    };
    return (
      <MSShell hideTabBar>
        <div style={{ padding: "0 16px 120px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <BackButton onBack={() => setStep("sets")} />
          </div>
          <MSPageTitle>{addToSlug ? "Choose cards to add" : "Choose cards"}</MSPageTitle>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--po-text-dim)", margin: 0 }}>
              {selectedCount} of {selectedMissing.length} selected
            </p>
            {selectedMissing.length > 0 && (
              <button
                onClick={toggleAll}
                style={{
                  padding: "5px 10px",
                  background: "rgba(244,244,246,0.06)",
                  border: "0.5px solid var(--po-border)",
                  borderRadius: 6,
                  color: "var(--po-text-dim)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>

          {selectedMissing.length === 0 ? (
            <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--po-text-dim)", fontSize: 14 }}>
              No missing cards in selected sets.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {selectedMissing.map(card => {
                const off = deselectedIds.has(card.printing_id);
                return (
                  <div
                    key={`${card.set_id}-${card.card_number}-${card.printing_id}`}
                    onClick={() => toggleDeselect(card.printing_id)}
                    style={{
                      position: "relative",
                      borderRadius: "var(--border-radius-md)",
                      overflow: "hidden",
                      background: "rgba(0,0,0,0.4)",
                      aspectRatio: "2.5/3.5",
                      cursor: "pointer",
                      opacity: off ? 0.35 : 1,
                      transition: "opacity 0.15s ease",
                      outline: off ? "none" : "2px solid var(--po-green)",
                      outlineOffset: 2,
                    }}
                  >
                    {card.image_url ? (
                      <img src={card.image_url} alt={card.card_name || `#${card.card_number}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{
                        width: "100%", height: "100%", display: "flex", alignItems: "center",
                        justifyContent: "center", padding: 8, textAlign: "center",
                        fontSize: 8, color: "var(--po-text-faint)", lineHeight: 1.3,
                      }}>
                        {card.card_name || `#${card.card_number}`}
                      </div>
                    )}
                    <div style={{
                      position: "absolute", inset: "auto 0 0",
                      padding: "20px 6px 6px",
                      background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)",
                    }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "var(--po-green)", marginBottom: 1 }}>
                        {card.edition_label}
                      </div>
                      <div style={{ fontSize: 7, color: "rgba(255,255,255,0.55)" }}>
                        {card.set_name} · #{card.card_number}
                      </div>
                      {Number(card.price_usd) > 0 && (
                        <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.7)" }}>
                          {fmtPrice(card.price_usd)}
                        </div>
                      )}
                    </div>
                    {off && (
                      <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <X size={32} style={{ color: "rgba(255,255,255,0.4)" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          background: "rgba(5,5,7,0.97)", borderTop: "0.5px solid rgba(244,244,246,0.1)",
          backdropFilter: "blur(12px)",
        }}>
          {createError && (
            <p style={{ fontSize: 12, color: "#ff6b6b", marginBottom: 8, textAlign: "center" }}>{createError}</p>
          )}
          <button
            onClick={() => {
              if (selectedCount > 0 && !creating) {
                addToSlug ? addToList(finalCards) : createWantList(finalCards);
              }
            }}
            disabled={selectedCount === 0 || creating}
            style={{
              width: "100%", padding: "15px",
              background: selectedCount === 0 ? "rgba(200,255,74,0.15)" : "var(--po-green)",
              borderRadius: "var(--border-radius-md)",
              color: selectedCount === 0 ? "rgba(200,255,74,0.4)" : "#050507",
              fontWeight: 700, fontSize: 15, border: "none",
              cursor: selectedCount === 0 ? "default" : "pointer",
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating
              ? (addToSlug ? "Adding…" : "Creating…")
              : addToSlug
                ? `Add ${selectedCount} card${selectedCount !== 1 ? "s" : ""}`
                : `Share ${selectedCount} card${selectedCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </MSShell>
    );
  }

  // ── Step 1: Set picker ─────────────────────────────────────────────────────
  const anySelected = selectedSetIds.size > 0;

  return (
    <MSShell hideTabBar>
      <div style={{ padding: "0 16px 200px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <BackButton />
        </div>
        <MSPageTitle>
          {addToSlug ? `Add to '${addToTitle || addToSlug}'` : "New Want List"}
        </MSPageTitle>
        <p style={{ fontSize: 13, color: "var(--po-text-dim)", marginBottom: 16 }}>
          {addToSlug
            ? "Select sets to pull missing slots from. Already-listed cards are excluded."
            : "Select sets. A public snapshot of your missing card slots will be created."}
        </p>

        {!addToSlug && (
          <input
            type="text"
            value={listTitle}
            onChange={e => setListTitle(e.target.value)}
            maxLength={50}
            placeholder="Name your list (optional) — e.g. Non-holos, Perfect Order wants"
            style={{
              width: "100%", padding: "12px 14px", marginBottom: 20,
              background: "rgba(244,244,246,0.04)",
              border: "0.5px solid var(--po-border)",
              borderRadius: "var(--border-radius-md)",
              color: "var(--po-text)", fontSize: 14,
              outline: "none", boxSizing: "border-box",
            }}
          />
        )}

        {trackedSets.length === 0 ? (
          <div style={{ padding: "3rem 0", textAlign: "center" }}>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14, marginBottom: 12 }}>
              You haven&apos;t added any sets yet.
            </p>
            <a href="/sets" style={{ color: "var(--po-green)", fontSize: 13, fontWeight: 600 }}>Browse sets →</a>
          </div>
        ) : (
          trackedSets.map(set => {
            const missingCount = (allMissingBySet[set.set_id] || []).length;
            const sel = selectedSetIds.has(set.set_id);
            return (
              <button
                key={set.set_id}
                onClick={() => toggleSet(set.set_id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", marginBottom: 8,
                  background: sel ? "rgba(200,255,74,0.06)" : "rgba(244,244,246,0.03)",
                  border: sel ? "1px solid rgba(200,255,74,0.35)" : "0.5px solid var(--po-border)",
                  borderRadius: "var(--border-radius-md)",
                  cursor: "pointer", transition: "background 0.12s, border-color 0.12s",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  border: sel ? "none" : "1.5px solid var(--po-border)",
                  background: sel ? "var(--po-green)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {sel && <span style={{ color: "#050507", fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--po-text)", marginBottom: 2 }}>
                    {set.set_name}
                  </div>
                  <div style={{ fontSize: 11, color: missingCount === 0 ? "var(--po-text-faint)" : "var(--po-text-dim)" }}>
                    {missingCount === 0 ? "Complete ✓" : `${missingCount} missing slot${missingCount !== 1 ? "s" : ""}`}
                  </div>
                </div>
                {set.logo_url && (
                  <img src={set.logo_url} alt={set.set_name}
                    style={{ height: 28, width: "auto", objectFit: "contain", flexShrink: 0, opacity: 0.7 }} />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Fixed footer */}
      {trackedSets.length > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          background: "rgba(5,5,7,0.97)", borderTop: "0.5px solid rgba(244,244,246,0.1)",
          backdropFilter: "blur(12px)",
        }}>
          {/* Running total */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: overCap ? "#ff9f43" : "var(--po-text-dim)" }}>
              {anySelected
                ? `${totalSlots} slot${totalSlots !== 1 ? "s" : ""} across ${selectedSetIds.size} set${selectedSetIds.size !== 1 ? "s" : ""}`
                : "No sets selected"}
            </span>
            {overCap && <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9f43" }}>500 max</span>}
          </div>
          {overCap && (
            <p style={{ fontSize: 11, color: "#ff9f43", marginBottom: 8, lineHeight: 1.4 }}>
              Too many cards — choose specific cards or select fewer sets.
            </p>
          )}
          {createError && (
            <p style={{ fontSize: 12, color: "#ff6b6b", marginBottom: 8, textAlign: "center" }}>{createError}</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => {
                if (totalSlots > 0 && !overCap && !creating) {
                  addToSlug ? addToList(selectedMissing) : createWantList(selectedMissing);
                }
              }}
              disabled={totalSlots === 0 || overCap || creating}
              style={{
                width: "100%", padding: "15px",
                background: (totalSlots === 0 || overCap) ? "rgba(200,255,74,0.15)" : "var(--po-green)",
                borderRadius: "var(--border-radius-md)",
                color: (totalSlots === 0 || overCap) ? "rgba(200,255,74,0.4)" : "#050507",
                fontWeight: 700, fontSize: 15, border: "none",
                cursor: (totalSlots === 0 || overCap) ? "default" : "pointer",
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating
                ? (addToSlug ? "Adding…" : "Creating…")
                : addToSlug
                  ? `Add all ${totalSlots}`
                  : `Share all ${totalSlots}`}
            </button>
            <button
              onClick={() => {
                if (totalSlots === 0 || creating) return;
                setDeselectedIds(new Set());
                setStep("cards");
              }}
              disabled={totalSlots === 0 || creating}
              style={{
                width: "100%", padding: "13px",
                background: "none",
                border: `0.5px solid ${totalSlots === 0 ? "var(--po-border)" : "rgba(200,255,74,0.3)"}`,
                borderRadius: "var(--border-radius-md)",
                color: totalSlots === 0 ? "var(--po-text-faint)" : "var(--po-green)",
                fontWeight: 600, fontSize: 14,
                cursor: totalSlots === 0 ? "default" : "pointer",
              }}
            >
              Choose specific cards →
            </button>
            <button
              onClick={() => router.back()}
              style={{
                background: "none", border: "none",
                color: "var(--po-text-dim)", fontSize: 13, fontWeight: 500,
                padding: "8px", cursor: "pointer", width: "100%",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </MSShell>
  );
}

export default function NewWantListPage() {
  return (
    <Suspense>
      <NewWantListContent />
    </Suspense>
  );
}
