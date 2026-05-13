"use client";

import { useState, useRef } from "react";
import { buildEbayUrl } from "@/lib/ebay";

const MARKET_LABEL = { AU: "AU", US: "US", UK: "UK", DE: "DE", CA: "CA" };

export function FindCard({ cardName, cardNumber, setTotal, rarity, userCountry = "AU", inline = false }) {
  const [showSheet, setShowSheet] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);
  // Ref-based debounce: prevents rapid double-taps opening eBay twice
  const ebayOpeningRef = useRef(false);

  const numberFormatted = cardNumber && setTotal
    ? `${String(cardNumber).padStart(3, "0")}/${String(setTotal).padStart(3, "0")}`
    : cardNumber ? String(cardNumber).padStart(3, "0") : "";

  const ebayUrl = buildEbayUrl({ cardName, cardNumber, setTotal, rarity, userCountry });

  // Stop propagation on every handler — the component lives inside card divs
  // that have their own onClick, and React synthetic events bubble through
  // the component tree regardless of position:fixed on children.

  const openSheet = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (showSheet) return; // guard against double-open
    setShowSheet(true);
  };

  const closeSheet = (e) => {
    if (e) e.stopPropagation();
    setShowSheet(false);
  };

  const handleEbayClick = (e) => {
    e.stopPropagation();
    if (ebayOpeningRef.current) return;
    ebayOpeningRef.current = true;
    setTimeout(() => { ebayOpeningRef.current = false; }, 1000);

    if (!localStorage.getItem("ebay_location_prompted")) {
      setPendingUrl(ebayUrl);
      setShowLocationModal(true);
    } else {
      window.open(ebayUrl, "_blank", "noopener,noreferrer");
    }
  };

  const finishLocation = (url) => {
    localStorage.setItem("ebay_location_prompted", "true");
    setShowLocationModal(false);
    setPendingUrl(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const overlayBtn = (
    <button
      onClick={openSheet}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 7px",
        background: "rgba(7,7,10,0.82)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(200,255,74,0.35)",
        borderRadius: 6,
        color: "#c8ff4a",
        fontFamily: '"IBM Plex Mono", monospace',
        fontWeight: 500,
        fontSize: 10,
        letterSpacing: "0.06em",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      FIND CARD
    </button>
  );

  const inlineBtn = (
    <button
      onClick={openSheet}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        background: "transparent",
        border: "1px solid rgba(200,255,74,0.25)",
        borderRadius: 8,
        color: "#c8ff4a",
        fontFamily: '"IBM Plex Mono", monospace',
        fontWeight: 500,
        fontSize: 11,
        letterSpacing: "0.06em",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      FIND CARD
    </button>
  );

  return (
    <>
      {inline ? (
        inlineBtn
      ) : (
        <div style={{ position: "absolute", top: 6, left: 6, zIndex: 10 }}>
          {overlayBtn}
        </div>
      )}

      {/* Buy Options bottom sheet */}
      {showSheet && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center"
          onClick={closeSheet}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-t-2xl w-full max-w-sm px-5 pt-4 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--po-border)] rounded-full mx-auto mb-4" />

            {/* Header + disclaimer */}
            <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.08em", color: "var(--po-text-dim)", marginBottom: 6 }}>
              BUYING OPTIONS
            </p>
            <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, color: "var(--po-text-faint)", lineHeight: 1.55, marginBottom: 10 }}>
              Master Setter may earn a commission from purchases made through links on this page. This does not affect the price you pay.
            </p>
            <div style={{ height: 1, background: "var(--po-border)", marginBottom: 12 }} />

            {/* eBay button */}
            <button
              onClick={handleEbayClick}
              className="w-full flex items-center justify-between py-3 px-4 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-xl text-left hover:border-[var(--po-green)] transition-colors mb-2"
            >
              <div className="flex items-center gap-3">
                <span style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1, flexShrink: 0 }}>
                  <span style={{ color: "#e43137" }}>e</span>
                  <span style={{ color: "#0064d3" }}>B</span>
                  <span style={{ color: "#f5af02" }}>a</span>
                  <span style={{ color: "#86b817" }}>y</span>
                </span>
                <div>
                  <div className="text-sm font-bold text-[var(--po-text)]">
                    Search on eBay {MARKET_LABEL[userCountry] || "AU"}
                  </div>
                  <div style={{ color: "rgba(244,244,246,0.4)", fontSize: 11 }}>
                    {cardName}{numberFormatted ? ` ${numberFormatted}` : ""}
                  </div>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--po-text-dim)", flexShrink: 0 }}>
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </button>

            {/* Placeholder: card shops */}
            <div className="w-full flex items-center justify-between py-3 px-4 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-xl mb-2 opacity-40 cursor-not-allowed">
              <div>
                <div className="text-sm font-bold text-[var(--po-text)]">Card shops near you</div>
                <div style={{ color: "rgba(244,244,246,0.4)", fontSize: 11 }}>Find local retailers</div>
              </div>
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.06em", background: "rgba(244,244,246,0.08)", borderRadius: 4, padding: "2px 6px", color: "var(--po-text-dim)", flexShrink: 0 }}>
                SOON
              </span>
            </div>

            {/* Placeholder: TCGPlayer (US only) */}
            {userCountry === "US" && (
              <div className="w-full flex items-center justify-between py-3 px-4 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-xl mb-2 opacity-40 cursor-not-allowed">
                <div>
                  <div className="text-sm font-bold text-[var(--po-text)]">TCGPlayer</div>
                  <div style={{ color: "rgba(244,244,246,0.4)", fontSize: 11 }}>US only</div>
                </div>
                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.06em", background: "rgba(244,244,246,0.08)", borderRadius: 4, padding: "2px 6px", color: "var(--po-text-dim)", flexShrink: 0 }}>
                  SOON
                </span>
              </div>
            )}

            <button
              onClick={closeSheet}
              className="w-full py-2 text-xs text-[var(--po-text-dim)] mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* One-time location permission modal */}
      {showLocationModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={(e) => { e.stopPropagation(); finishLocation(pendingUrl); }}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-2xl w-full max-w-xs p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold mb-2">Allow location?</h2>
            <p className="text-sm text-[var(--po-text-dim)] mb-5 leading-relaxed">
              Allow location for more relevant eBay results near you? We never store your location.
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); finishLocation(pendingUrl); }}
                className="flex-1 py-2.5 rounded-xl border border-[var(--po-border)] text-sm font-bold text-[var(--po-text)]"
              >
                Skip
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.geolocation.getCurrentPosition(() => {}, () => {});
                  finishLocation(pendingUrl);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-black"
                style={{ background: "var(--po-green)" }}
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
