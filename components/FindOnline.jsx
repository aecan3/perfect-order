"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { buildEbayUrl, ebayCampaignId } from "@/lib/ebay";
import { track, EVENTS, getAnonId } from "@/lib/track";

const MARKET_LABEL = { AU: "AU", US: "US", UK: "UK", DE: "DE", CA: "CA" };

export function FindOnline({ cardName, collectorNumber = "", rarity, userCountry = "AU", setId = null, inline = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ebayOpeningRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  const ebayUrl = buildEbayUrl({ cardName, collectorNumber, rarity, userCountry, customId: getAnonId() });

  const handleOpen = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
  };

  const handleClose = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setIsOpen(false);
  };

  const handleEbayClick = (e) => {
    e.stopPropagation();
    if (ebayOpeningRef.current) return;
    ebayOpeningRef.current = true;
    setTimeout(() => { ebayOpeningRef.current = false; }, 1000);
    if (!localStorage.getItem("ebay_location_prompted")) {
      localStorage.setItem("ebay_location_prompted", "true");
      try { navigator.geolocation.getCurrentPosition(() => {}, () => {}); } catch (_) {}
    }
    // ebay_click — the lone monetisation event. sendBeacon-first transport
    // survives the window.open / navigation. Fires per genuine click (the 1s
    // debounce above already guards against double-fire).
    track(EVENTS.EBAY_CLICK, {
      set_id: setId ?? null,
      card_name: cardName ?? null,
      collector_number: collectorNumber ?? null,
      rarity: rarity ?? null,
      user_country: userCountry ?? null,
      campaign_id: ebayCampaignId(userCountry),
    });
    window.open(ebayUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  const chipStyle = inline ? {
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
  } : {
    position: "absolute",
    top: 6,
    left: 6,
    zIndex: 10,
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
  };

  const iconSize = inline ? 11 : 10;

  const modal = isOpen && mounted && createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111113",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 40px",
          maxHeight: "70vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            background: "none",
            border: "none",
            color: "rgba(244,244,246,0.5)",
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>

        <div style={{ width: 40, height: 4, background: "rgba(244,244,246,0.18)", borderRadius: 2, margin: "0 auto 16px" }} />

        <p style={{
          fontSize: 11,
          color: "rgba(244,244,246,0.55)",
          fontFamily: '"IBM Plex Mono", monospace',
          letterSpacing: "0.04em",
          marginBottom: 16,
          borderBottom: "1px solid rgba(244,244,246,0.1)",
          paddingBottom: 12,
          lineHeight: 1.55,
        }}>
          BUYING OPTIONS · Master Setter may earn a commission from purchases made through links on this page. This does not affect the price you pay.
        </p>

        {/* eBay */}
        <button
          onClick={handleEbayClick}
          className="ms-pressable"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "rgba(244,244,246,0.04)",
            border: "1px solid rgba(244,244,246,0.14)",
            borderRadius: 12,
            marginBottom: 8,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1, flexShrink: 0 }}>
              <span style={{ color: "#e43137" }}>e</span>
              <span style={{ color: "#0064d3" }}>B</span>
              <span style={{ color: "#f5af02" }}>a</span>
              <span style={{ color: "#86b817" }}>y</span>
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(244,244,246,0.9)" }}>
                Search on eBay {MARKET_LABEL[userCountry] || "AU"}
              </div>
              <div style={{ fontSize: 11, color: "rgba(244,244,246,0.38)" }}>
                {cardName}{collectorNumber ? ` · ${collectorNumber}` : ""}
              </div>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(244,244,246,0.38)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </button>

        {/* Card shops — coming soon */}
        <div style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "rgba(244,244,246,0.02)",
          border: "1px solid rgba(244,244,246,0.08)",
          borderRadius: 12,
          marginBottom: 8,
          opacity: 0.4,
          cursor: "not-allowed",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(244,244,246,0.9)" }}>Card shops near you</div>
            <div style={{ fontSize: 11, color: "rgba(244,244,246,0.38)" }}>Find local retailers</div>
          </div>
          <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.06em", background: "rgba(244,244,246,0.08)", borderRadius: 4, padding: "2px 6px", color: "rgba(244,244,246,0.5)", flexShrink: 0 }}>SOON</span>
        </div>

        {/* TCGPlayer (US only) */}
        {userCountry === "US" && (
          <div style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "rgba(244,244,246,0.02)",
            border: "1px solid rgba(244,244,246,0.08)",
            borderRadius: 12,
            marginBottom: 8,
            opacity: 0.4,
            cursor: "not-allowed",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(244,244,246,0.9)" }}>TCGPlayer</div>
              <div style={{ fontSize: 11, color: "rgba(244,244,246,0.38)" }}>US only</div>
            </div>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.06em", background: "rgba(244,244,246,0.08)", borderRadius: 4, padding: "2px 6px", color: "rgba(244,244,246,0.5)", flexShrink: 0 }}>SOON</span>
          </div>
        )}

        <button
          onClick={handleClose}
          className="ms-pressable"
          style={{
            width: "100%",
            marginTop: 12,
            padding: "14px",
            background: "rgba(244,244,246,0.06)",
            border: "1px solid rgba(244,244,246,0.12)",
            borderRadius: 10,
            color: "rgba(244,244,246,0.55)",
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button onClick={handleOpen} className="ms-pressable" style={chipStyle}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        FIND ONLINE
      </button>
      {modal}
    </>
  );
}
