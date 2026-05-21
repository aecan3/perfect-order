"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

// Bottom offset: tab bar (64px) + safe area + 16px gap above the bar.
// Written inline — no global CSS variable introduced for a single consumer.
const FAB_BOTTOM = "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)";

export function ReportCardFAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Report a card issue"
        onClick={() => {
          setIsOpen(true);
          console.log("open report form");
        }}
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
      {/* ReportCardForm rendered here in PART 4 */}
    </>
  );
}
