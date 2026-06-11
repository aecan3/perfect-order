"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function MarketplaceDetailOverlay({ listing, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 260);
  }

  if (!mounted || !listing) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.65)",
          opacity: visible ? 1 : 0,
          transition: "opacity 260ms ease",
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#0a0a0b",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 260ms ease",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
          borderRadius: "16px 16px 0 0",
          padding: "12px 20px 32px",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3f3f46", margin: "0 auto 12px" }} />

        {/* Card name */}
        <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a1a1aa", marginBottom: 4 }}>
          {listing.card_name || "Marketplace listing"}
        </h2>

        {/* Listing title */}
        <p style={{ fontSize: 14, lineHeight: 1.4, color: "#fff", marginBottom: 16 }}>
          {listing.title}
        </p>

        {/* Seller's listing photo — the one allowed exception to card-art-only */}
        {listing.image_url && (
          <div style={{ marginBottom: 16, borderRadius: 8, overflow: "hidden", background: "#18181b" }}>
            <img
              src={listing.image_url}
              alt="Seller photo of listing"
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }}
            />
          </div>
        )}

        {/* Metadata grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 14, marginBottom: 20 }}>
          <span style={{ color: "#a1a1aa" }}>Price</span>
          <span style={{ textAlign: "right", fontWeight: 700, color: "#fff" }}>
            {formatPrice(listing.price_amount, listing.price_currency)}
          </span>

          {listing.condition && (
            <>
              <span style={{ color: "#a1a1aa" }}>Condition</span>
              <span style={{ textAlign: "right", color: "#fff" }}>{listing.condition}</span>
            </>
          )}

          {listing.seller_username && (
            <>
              <span style={{ color: "#a1a1aa" }}>Seller</span>
              <span style={{ textAlign: "right", color: "#fff" }}>
                {listing.seller_username}
                {listing.seller_feedback_pct != null && (
                  <span style={{ marginLeft: 4, fontSize: 12, color: "#a1a1aa" }}>
                    ({listing.seller_feedback_pct}%)
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Affiliate disclosure */}
        <p style={{ fontSize: 11, lineHeight: 1.5, color: "#71717a", marginBottom: 12 }}>
          Master Setter may earn a commission from purchases made through this link. This does not affect the price you pay.
        </p>

        {/* View on eBay CTA */}
        <a
          href={listing.listing_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="ms-pressable"
          style={{
            display: "block", width: "100%", padding: "12px 0",
            textAlign: "center", fontSize: 14, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: "#fff", background: "rgb(0,99,217)",
            borderRadius: 8, textDecoration: "none",
          }}
        >
          View on eBay
        </a>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="ms-pressable"
          style={{
            display: "block", width: "100%", marginTop: 12, padding: "12px 0",
            textAlign: "center", fontSize: 14, color: "#a1a1aa",
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </>,
    document.body
  );
}

function formatPrice(amount, currency) {
  const n = Number(amount);
  if (Number.isNaN(n)) return "";
  return `${currency || "USD"} ${n.toFixed(2)}`;
}
