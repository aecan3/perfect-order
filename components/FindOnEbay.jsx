"use client";

import { useState } from "react";
import { buildEbayUrl } from "@/lib/ebay";

export function FindOnEbay({ cardName, setName, userCountry = "AU" }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);

  const openUrl = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleClick = (e) => {
    e.stopPropagation();
    const url = buildEbayUrl({ cardName, setName, userCountry });
    if (!localStorage.getItem("ebay_location_prompted")) {
      setPendingUrl(url);
      setShowModal(true);
    } else {
      openUrl(url);
    }
  };

  const proceed = (url) => {
    localStorage.setItem("ebay_location_prompted", "true");
    setShowModal(false);
    setPendingUrl(null);
    openUrl(url);
  };

  const handleAllow = () => {
    navigator.geolocation.getCurrentPosition(() => {}, () => {});
    proceed(pendingUrl);
  };

  const handleSkip = () => {
    proceed(pendingUrl);
  };

  return (
    <>
      <button
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          background: "transparent",
          border: "1px solid rgba(244,244,246,0.2)",
          borderRadius: 8,
          color: "rgba(244,244,246,0.8)",
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 500,
          fontSize: 13,
          cursor: "pointer",
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15,3 21,3 21,9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        Find on eBay
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={handleSkip}
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
                onClick={handleSkip}
                className="flex-1 py-2.5 rounded-xl border border-[var(--po-border)] text-sm font-bold text-[var(--po-text)]"
              >
                Skip
              </button>
              <button
                onClick={handleAllow}
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
