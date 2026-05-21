"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { ReportCardForm } from "@/components/ReportCardForm";

// Tab bar (64px) + safe area + 16px gap.
const FAB_BOTTOM = "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)";

// Toast sits above the FAB.
const TOAST_BOTTOM = "calc(64px + env(safe-area-inset-bottom, 0px) + 80px)";

export function ReportCardFAB() {
  const [mounted, setMounted]       = useState(false);
  const [isOpen, setIsOpen]         = useState(false);
  const [showToast, setShowToast]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, [showToast]);

  const handleSuccess = () => {
    setIsOpen(false);
    setShowToast(true);
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
        background: "#1a1a1f",
        border: "1px solid rgba(200,255,74,0.3)",
        borderRadius: 24,
        padding: "10px 20px",
        fontSize: 14,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: "rgba(244,244,246,0.9)",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}
    >
      Thanks — we&apos;ll look into it.
    </div>,
    document.body
  );

  return (
    <>
      <button
        aria-label="Report a card issue"
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: FAB_BOTTOM,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "#1a1a1f",
          border: "1px solid var(--ms-rule)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 400,
          padding: 0,
        }}
      >
        <Flag size={20} color="rgba(244,244,246,0.55)" />
      </button>
      <ReportCardForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={handleSuccess}
      />
      {toast}
    </>
  );
}
