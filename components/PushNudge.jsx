"use client";

import { useState, useEffect } from "react";
import { isPushSupported, isStandalone } from "@/lib/push/support";
import { subscribeToPush } from "@/lib/push/subscribe";

const DISMISSED_KEY = "ms_push_prompt_dismissed";

export default function PushNudge() {
  const [show, setShow] = useState(false);
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    async function check() {
      if (!isStandalone()) return;
      if (!isPushSupported()) return;
      if (Notification.permission !== "default") return;

      try {
        if (localStorage.getItem(DISMISSED_KEY)) return;
      } catch {
        return;
      }

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;

      const existing = await reg.pushManager.getSubscription().catch(() => null);
      if (existing) return;

      setShow(true);
    }
    check();
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  async function handleTurnOn() {
    setBusy(true);
    const sub = await subscribeToPush();
    setBusy(false);
    // Whether they granted or denied, don't re-nag — dismiss either way.
    dismiss();
    // (If sub is non-null, the settings toggle will reflect "on" next time they look.)
    void sub;
  }

  if (!show) return null;

  return (
    <div style={{
      marginBottom: 16,
      padding: "14px 16px",
      background: "var(--po-bg-soft)",
      border: "0.5px solid var(--po-border)",
      borderRadius: 16,
    }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--po-text)", margin: "0 0 4px" }}>
        Turn on notifications
      </p>
      <p style={{ fontSize: 13, color: "var(--po-text-dim)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Get notified about messages, trades, and friend activity.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleTurnOn}
          disabled={busy}
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
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Turning on..." : "Turn on"}
        </button>
        <button
          onClick={dismiss}
          disabled={busy}
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
            cursor: busy ? "default" : "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
