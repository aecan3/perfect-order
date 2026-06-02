"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { usePasskeyEnrollment } from "@/lib/usePasskeyEnrollment";

const DISMISSED_KEY = "ms_passkey_nudge_dismissed";
// Show nudge only within this window of account creation.
// Wide enough to survive a slow email client; narrow enough to feel contextual.
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

export default function PasskeyNudge() {
  const [show, setShow] = useState(false);
  const { status, enroll } = usePasskeyEnrollment();

  useEffect(() => {
    async function check() {
      try {
        if (sessionStorage.getItem(DISMISSED_KEY)) return;
      } catch {
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      if (ageMs < NEW_ACCOUNT_WINDOW_MS) setShow(true);
    }
    check();
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  async function handleSetUp() {
    await enroll();
    // Dismiss regardless of outcome — a failed nudge is a shrug, not a wall.
    dismiss();
  }

  // Hide once done or if the nudge condition isn't met.
  if (!show || status === "success") return null;

  return (
    <div style={{
      marginBottom: 16,
      padding: "14px 16px",
      background: "var(--po-bg-soft)",
      border: "0.5px solid var(--po-border)",
      borderRadius: 16,
    }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--po-text)", margin: "0 0 4px" }}>
        Sign in faster next time
      </p>
      <p style={{ fontSize: 13, color: "var(--po-text-dim)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Set up Face ID or fingerprint — one tap to sign in.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSetUp}
          disabled={status === "pending"}
          style={{
            flex: 1,
            padding: "9px 0",
            background: "var(--po-green)",
            border: "none",
            borderRadius: 10,
            color: "#050507",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: '"IBM Plex Sans", sans-serif',
            cursor: status === "pending" ? "default" : "pointer",
          }}
        >
          {status === "pending" ? "Setting up…" : "Set up"}
        </button>
        <button
          onClick={dismiss}
          disabled={status === "pending"}
          style={{
            flex: 1,
            padding: "9px 0",
            background: "transparent",
            border: "0.5px solid var(--po-border)",
            borderRadius: 10,
            color: "var(--po-text-dim)",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: '"IBM Plex Sans", sans-serif',
            cursor: status === "pending" ? "default" : "pointer",
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
