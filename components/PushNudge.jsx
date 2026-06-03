"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { isPushSupported, isStandalone } from "@/lib/push/support";
import { subscribeToPush } from "@/lib/push/subscribe";

const STATE_KEY    = "ms_push_prompt_state";
const LEGACY_KEY   = "ms_push_prompt_dismissed";
const MAX_DISMISSALS = 3;
const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS   = 30 * 24 * 60 * 60 * 1000;

// Must match PasskeyNudge.jsx — kept identical so both nudges use the same window.
const PASSKEY_NUDGE_DISMISSED_KEY = "ms_passkey_nudge_dismissed";
const PASSKEY_NUDGE_WINDOW_MS = 10 * 60 * 1000;

function readState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate legacy boolean flag: treat as one dismiss with an old timestamp.
    if (localStorage.getItem(LEGACY_KEY)) {
      localStorage.removeItem(LEGACY_KEY);
      const migrated = { dismissCount: 1, lastDismissedAt: new Date(0).toISOString() };
      localStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return { dismissCount: 0, lastDismissedAt: null };
  } catch {
    return { dismissCount: MAX_DISMISSALS, lastDismissedAt: null };
  }
}

function shouldShow(state) {
  const { dismissCount, lastDismissedAt } = state;
  if (dismissCount >= MAX_DISMISSALS) return false;
  if (dismissCount === 0) return true;
  const elapsed = Date.now() - new Date(lastDismissedAt).getTime();
  if (dismissCount === 1) return elapsed > THREE_WEEKS_MS;
  if (dismissCount === 2) return elapsed > ONE_MONTH_MS;
  return false;
}

function writeDismiss() {
  try {
    const state = readState();
    localStorage.setItem(STATE_KEY, JSON.stringify({
      dismissCount: state.dismissCount + 1,
      lastDismissedAt: new Date().toISOString(),
    }));
  } catch { /* ignore */ }
}

function writeCap() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      dismissCount: MAX_DISMISSALS,
      lastDismissedAt: new Date().toISOString(),
    }));
  } catch { /* ignore */ }
}

export default function PushNudge() {
  const [show, setShow] = useState(false);
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    async function check() {
      if (!isStandalone()) return;
      if (!isPushSupported()) return;
      if (Notification.permission !== "default") return;

      const state = readState();
      if (!shouldShow(state)) return;

      // Defer to PasskeyNudge if it would currently be showing — never stack two banners.
      // Self-clears after PASSKEY_NUDGE_WINDOW_MS; PushNudge shows on the next app-open.
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const ageMs = Date.now() - new Date(user.created_at).getTime();
        const passkeyNudgeDismissed = (() => {
          try { return !!sessionStorage.getItem(PASSKEY_NUDGE_DISMISSED_KEY); } catch { return true; }
        })();
        if (ageMs < PASSKEY_NUDGE_WINDOW_MS && !passkeyNudgeDismissed) return;
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
    writeDismiss();
    setShow(false);
  }

  async function handleTurnOn() {
    setBusy(true);
    const sub = await subscribeToPush();
    setBusy(false);
    if (sub) {
      // Subscription succeeded — cap the counter so schedule never re-shows.
      writeCap();
    } else {
      // Permission denied or error — treat as a dismiss so we don't immediately re-nag.
      writeDismiss();
    }
    setShow(false);
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
