"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const TOAST_BOTTOM = "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)";

const MODE_CONFIG = {
  block: {
    title:        (handle) => `Block @${handle}?`,
    body:         "They won't be able to see your collection or contact you, and your friendship will end. You can unblock them later in Settings.",
    primaryLabel: "Block",
    inFlight:     "Blocking…",
    toastText:    (handle) => `@${handle} blocked`,
    primaryStyle: (submitting) => ({
      background: submitting ? "rgba(220,38,38,0.2)" : "rgba(220,38,38,0.85)",
      color:      submitting ? "rgba(252,165,165,0.5)" : "#fff",
    }),
    doFetch: (targetUserId) => fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetUserId }),
    }),
  },
  unblock: {
    title:        (handle) => `Unblock @${handle}?`,
    body:         "They'll be able to see your collection and contact you again. You'll need to re-add them as a friend separately.",
    primaryLabel: "Unblock",
    inFlight:     "Unblocking…",
    toastText:    (handle) => `@${handle} unblocked`,
    primaryStyle: (submitting) => ({
      background: submitting ? "rgba(200,255,74,0.15)" : "#c8ff4a",
      color:      submitting ? "rgba(200,255,74,0.35)" : "#000",
    }),
    doFetch: (targetUserId) => fetch(`/api/block/${targetUserId}`, { method: "DELETE" }),
  },
};

export function BlockConfirmModal({ open, onClose, targetHandle, targetUserId, onSuccess, mode = "block" }) {
  const [mounted, setMounted]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [showToast, setShowToast]   = useState(false);

  const sheetRef  = useRef(null);
  const cancelRef = useRef(null);

  const cfg = MODE_CONFIG[mode];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const trapTab = (e) => {
      if (e.key !== "Tab") return;
      const nodes = sheetRef.current.querySelectorAll(
        "button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [open]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await cfg.doFetch(targetUserId);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${mode} user`);
      }
      onClose();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      onSuccess?.();
    } catch (err) {
      setSubmitting(false);
      setError(err.message || `Couldn't ${mode} this user. Please try again.`);
    }
  };

  const toast = showToast && mounted && createPortal(
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: TOAST_BOTTOM,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "rgba(30,30,34,0.97)",
        border: "1px solid rgba(244,244,246,0.12)",
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 14,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: "rgba(244,244,246,0.9)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      {cfg.toastText(targetHandle)}
    </div>,
    document.body
  );

  if (!mounted || !open) return toast ?? null;

  return (
    <>
      {createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}
          onClick={onClose}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={cfg.title(targetHandle)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111113",
              borderRadius: "16px 16px 0 0",
              padding: "20px 20px 40px",
            }}
          >
            {/* Drag handle */}
            <div style={{
              width: 40, height: 4,
              background: "rgba(244,244,246,0.18)",
              borderRadius: 2,
              margin: "0 auto 20px",
            }} />

            {/* Title */}
            <p style={{
              margin: "0 0 12px",
              fontSize: 16, fontWeight: 800,
              color: "rgba(244,244,246,0.9)",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}>
              {cfg.title(targetHandle)}
            </p>

            {/* Body */}
            <p style={{
              margin: "0 0 24px",
              fontSize: 14,
              color: "rgba(244,244,246,0.55)",
              fontFamily: '"IBM Plex Sans", sans-serif',
              lineHeight: 1.5,
            }}>
              {cfg.body}
            </p>

            {/* Inline error */}
            {error && (
              <div style={{
                marginBottom: 16,
                padding: "10px 14px",
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.3)",
                borderRadius: 8,
                fontSize: 13, color: "#fca5a5",
                fontFamily: '"IBM Plex Sans", sans-serif',
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                ref={cancelRef}
                onClick={onClose}
                disabled={submitting}
                style={{
                  flex: 1, padding: "14px",
                  background: "transparent",
                  border: "1px solid rgba(244,244,246,0.14)",
                  borderRadius: 10,
                  color: "rgba(244,244,246,0.55)",
                  fontSize: 15, fontFamily: '"IBM Plex Sans", sans-serif',
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                aria-disabled={submitting}
                style={{
                  flex: 1, padding: "14px",
                  ...cfg.primaryStyle(submitting),
                  border: "none", borderRadius: 10,
                  fontSize: 15, fontWeight: 800,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  cursor: submitting ? "not-allowed" : "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {submitting ? cfg.inFlight : cfg.primaryLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {toast}
    </>
  );
}
