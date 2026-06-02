"use client";

import { createPortal } from "react-dom";

export function captureCollectionMigrationIntent() {
  try {
    sessionStorage.setItem(
      "ms_anon_intent",
      JSON.stringify({ type: "collection_migration", capturedAt: Date.now() })
    );
  } catch (e) { /* ignore */ }
}

const COPY = {
  card_threshold: {
    title: "Save your collection",
    body: (count, valueAud) =>
      `You've ticked ${count} ${count === 1 ? "card" : "cards"} worth about A$${Math.round(valueAud)}. Sign up for free to save your progress — it only takes a minute.`,
  },
  second_set: {
    title: "Save before you browse",
    body: (count, valueAud) =>
      `You have ${count} ${count === 1 ? "card" : "cards"} saved (A$${Math.round(valueAud)}). Sign up to keep this set and explore as many as you like.`,
  },
  auth_required: {
    title: "Sign up to use this feature",
    body: (count, valueAud) =>
      count > 0
        ? `You've already ticked ${count} ${count === 1 ? "card" : "cards"} (A$${Math.round(valueAud)}). Sign up to save them and unlock all features.`
        : "Create a free account to use this feature.",
  },
};

export function AnonymousCollectionBlocker({ open, trigger = "card_threshold", count = 0, valueUsd = 0, onSignUp, onDismiss }) {
  if (!open || typeof document === "undefined") return null;

  const copy = COPY[trigger] || COPY.card_threshold;
  const valueAud = valueUsd * 1.53;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onDismiss}
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
          {copy.title}
        </h2>
        <p style={{
          fontSize: 14, color: "var(--po-text-dim)",
          margin: "0 0 20px", lineHeight: 1.5,
        }}>
          {copy.body(count, valueAud)}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onSignUp}
            style={{
              width: "100%", padding: 13,
              background: "var(--po-green)", color: "#050507",
              border: "none", borderRadius: "var(--border-radius-md)",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            {count > 0
              ? `Sign Up Free — Save ${count} ${count === 1 ? "card" : "cards"}`
              : "Sign Up Free"}
          </button>
          <button
            onClick={onDismiss}
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
