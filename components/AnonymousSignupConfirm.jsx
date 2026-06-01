"use client";

import { createPortal } from "react-dom";

export function AnonymousSignupConfirm({ open, intentType, sharerHandle, onConfirm, onCancel }) {
  if (!open) return null;

  const isTrade = intentType === "trade";
  const title = isTrade ? "Sign up to propose a trade" : "Sign up to send a message";
  const body = isTrade
    ? "To propose a structured trade you'll need cards in your own binder. Sign up to start one — it only takes a minute."
    : `To message @${sharerHandle}, you'll need a free account. Take you there now?`;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--po-bg)",
          border: "0.5px solid rgba(244,244,246,0.15)",
          borderRadius: "var(--border-radius-md)",
          padding: 20,
          maxWidth: "min(360px, calc(100vw - 32px))",
          width: "100%",
        }}
      >
        <h2 style={{
          fontSize: 17, fontWeight: 700, color: "var(--po-text)",
          margin: "0 0 8px", lineHeight: 1.3,
        }}>
          {title}
        </h2>
        <p style={{
          fontSize: 14, color: "var(--po-text-dim)",
          margin: "0 0 20px", lineHeight: 1.5,
        }}>
          {body}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{
              width: "100%", padding: 13,
              background: "var(--po-green)", color: "#050507",
              border: "none", borderRadius: "var(--border-radius-md)",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            Yes, take me there
          </button>
          <button
            onClick={onCancel}
            style={{
              width: "100%", padding: 13,
              background: "transparent", color: "var(--po-text-dim)",
              border: "0.5px solid rgba(244,244,246,0.15)",
              borderRadius: "var(--border-radius-md)",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
