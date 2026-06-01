"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, ArrowLeftRight } from "lucide-react";

export function AnonymousBinderActionSheet({ card, sharerHandle, onClose, onMessage, onTrade }) {
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

  if (!mounted || !card) return null;

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
          background: "#0a0a0b",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 260ms ease",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
          borderRadius: "16px 16px 0 0",
          padding: "12px 20px 32px",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3f3f46", margin: "0 auto 16px" }} />

        {/* Card identity with thumbnail */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          {card.image_url && (
            <img
              src={card.image_url}
              alt={card.card_name}
              style={{
                width: 52,
                aspectRatio: "2.5/3.5",
                borderRadius: 6,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f4f4f6", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {card.card_name}
            </h2>
            <p style={{ fontSize: 13, color: "#a1a1aa", margin: 0 }}>
              {card.set_name}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onMessage}
            style={{
              width: "100%", padding: "14px 16px",
              background: "var(--po-green)", borderRadius: 10,
              fontSize: 15, fontWeight: 700, color: "#050507",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <MessageCircle size={17} />
            {sharerHandle ? `Message @${sharerHandle} about this` : "Message about this card"}
          </button>

          <button
            type="button"
            onClick={onTrade}
            style={{
              width: "100%", padding: "14px 16px",
              background: "none", borderRadius: 10,
              border: "1px solid var(--po-border)",
              fontSize: 15, fontWeight: 600, color: "#f4f4f6",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <ArrowLeftRight size={17} />
            Propose a structured trade
          </button>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
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
