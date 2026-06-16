"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Share2, QrCode } from "lucide-react";
import { LazyQRCode } from "@/components/LazyQRCode";

// Shared "Share my Trade Binder" affordance.
//
// Shares/copies the BARE URL only — the descriptive blurb rides in the trade-binder
// page's Open Graph preview (trade-binder/[handle]/layout.js), so we never glue text
// into the copied string (that concatenation broke paste-into-URL-bar on the iOS
// share sheet). On the clipboard path (desktop / no native sheet) it shows a lime
// "Link copied" toast; mobile's OS sheet self-confirms, so we don't double-toast.
//
// Props:
//   handle  — the binder owner's handle; the share URL is /trade-binder/{handle}.
//   showQr  — when true, also render the QR button + bottom-sheet (used on /you).
//             Omit for the lighter single-button affordance (in-binder header).
export function ShareTradeBinder({ handle, showQr = false }) {
  const [shareToast, setShareToast] = useState(null);
  const [origin, setOrigin] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);

  // window is only available client-side; resolve origin after mount (SSR-safe).
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const binderUrl = handle && origin ? `${origin}/trade-binder/${handle}` : null;

  const handleShare = async () => {
    if (!binderUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: binderUrl });
      } catch (e) {
        // user cancelled — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(binderUrl);
        setShareToast("Link copied");
      } catch (e) {
        console.error("Clipboard write failed:", e);
      }
    }
  };

  // Auto-dismiss the "Link copied" toast (~2.8s); also click-to-dismiss on the bar.
  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(null), 2800);
    return () => clearTimeout(t);
  }, [shareToast]);

  const openQr = () => {
    setQrOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setQrVisible(true)));
  };
  const closeQr = () => {
    setQrVisible(false);
    setTimeout(() => setQrOpen(false), 260);
  };

  useEffect(() => {
    if (!qrOpen) return;
    const fn = (e) => { if (e.key === "Escape") closeQr(); };
    document.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen]);

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleShare}
          className="ms-pressable"
          style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 16px",
            background: "rgba(200,255,74,0.08)",
            border: "0.5px solid rgba(200,255,74,0.25)",
            borderRadius: "var(--border-radius-md)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          <Share2 size={16} style={{ color: "var(--po-green)", flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--po-green)" }}>
            Share my Trade Binder
          </span>
        </button>
        {showQr && binderUrl && (
          <button
            onClick={openQr}
            aria-label="Show QR code"
            className="ms-pressable"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "13px",
              background: "rgba(200,255,74,0.08)",
              border: "0.5px solid rgba(200,255,74,0.25)",
              borderRadius: "var(--border-radius-md)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <QrCode size={16} style={{ color: "var(--po-green)" }} />
          </button>
        )}
      </div>

      {/* "Link copied" toast — mirrors the restoreToast / tradeToastBar pattern. */}
      {shareToast && (
        <div
          onClick={() => setShareToast(null)}
          style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 300,
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            background: "rgba(5,5,7,0.96)", border: "1px solid rgba(200,255,74,0.35)", borderRadius: 10,
            color: "var(--po-green)", fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 700,
            whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", cursor: "pointer",
          }}
        >
          ✓ {shareToast}
        </div>
      )}

      {/* QR bottom-sheet portal — only when showQr. */}
      {showQr && qrOpen && binderUrl && createPortal(
        <>
          <div
            onClick={closeQr}
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              background: "rgba(0,0,0,0.65)",
              opacity: qrVisible ? 1 : 0,
              transition: "opacity 260ms ease",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trade binder QR code"
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
              background: "#0a0a0b",
              transform: qrVisible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 260ms ease",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
              borderRadius: "16px 16px 0 0",
              padding: "12px 20px 32px",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3f3f46", margin: "0 auto 16px" }} />
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--po-text-dim)", marginBottom: 20 }}>
              Scan to see my trade binder
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
                <LazyQRCode value={binderUrl} size={200} fgColor="#000000" bgColor="#ffffff" />
              </div>
            </div>
            <p style={{
              textAlign: "center", fontSize: 11, color: "var(--po-text-faint)",
              fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
              marginBottom: 20, wordBreak: "break-all", padding: "0 8px",
            }}>
              {binderUrl}
            </p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(binderUrl);
                  setQrCopied(true);
                  setTimeout(() => setQrCopied(false), 2000);
                } catch (e) {
                  console.error("Clipboard write failed:", e);
                }
              }}
              className="ms-pressable"
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 16px",
                background: qrCopied ? "rgba(200,255,74,0.18)" : "rgba(200,255,74,0.08)",
                border: "0.5px solid rgba(200,255,74,0.25)",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                transition: "background 0.15s",
                marginBottom: 12,
              }}
            >
              <Share2 size={16} style={{ color: "var(--po-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--po-green)" }}>
                {qrCopied ? "Link copied!" : "Copy link"}
              </span>
            </button>
            <button
              type="button"
              onClick={closeQr}
              className="ms-pressable"
              style={{
                display: "block", width: "100%", padding: "12px 0",
                textAlign: "center", fontSize: 14, color: "#a1a1aa",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
