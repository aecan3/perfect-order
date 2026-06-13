import { ANALYTICS_EVENT_SET } from "@/lib/analytics-events";

const ANON_KEY = "ms_anon_id";
const SESSION_KEY = "ms_session";          // sessionStorage: { id, lastActivity }
const ATTRIBUTION_KEY = "ms_attribution";  // localStorage: first-touch, sticky
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min inactivity -> new session

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAnonId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = uuid(); localStorage.setItem(ANON_KEY, id); }
    return id;
  } catch { return null; }
}

export function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const now = Date.now();
    let s = null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) { try { s = JSON.parse(raw); } catch { s = null; } }
    if (!s || !s.id || now - (s.lastActivity || 0) > SESSION_TIMEOUT_MS) {
      s = { id: uuid(), lastActivity: now };
    } else {
      s.lastActivity = now;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s.id;
  } catch { return null; }
}

export function ensureAttribution() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(ATTRIBUTION_KEY)) return; // first-touch already set
    const params = new URLSearchParams(window.location.search);
    const attribution = {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      referrer: document.referrer || null,
      landing_path: window.location.pathname,
      captured_at: new Date().toISOString(),
    };
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch { /* best-effort */ }
}

function getAttribution() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return {};
    const a = JSON.parse(raw);
    return {
      utm_source: a.utm_source || null,
      utm_medium: a.utm_medium || null,
      utm_campaign: a.utm_campaign || null,
      referrer: a.referrer || null,
    };
  } catch { return {}; }
}

export function track(eventName, props = {}) {
  if (typeof window === "undefined") return;
  if (!ANALYTICS_EVENT_SET.has(eventName)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[track] unknown event_name: ${eventName}`);
    }
    return;
  }
  const anon_id = getAnonId();
  const session_id = getSessionId();
  if (!anon_id || !session_id) return; // storage blocked; skip silently

  const payload = {
    event_name: eventName,
    anon_id,
    session_id,
    ...getAttribution(),
    path: window.location.pathname,
    props: props && typeof props === "object" ? props : {},
  };
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/track", blob)) return;
    }
  } catch { /* fall through */ }
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* analytics must never break the app */ }
}
