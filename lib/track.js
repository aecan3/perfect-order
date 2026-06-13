import { ANALYTICS_EVENT_SET } from "@/lib/analytics-events";

const ANON_KEY = "ms_anon_id";
const USER_KEY = "ms_user_id";             // localStorage: set after identifyOnSignup
const SESSION_KEY = "ms_session";          // sessionStorage: { id, lastActivity }
const ATTRIBUTION_KEY = "ms_attribution";  // localStorage: first-touch, sticky
const FIRED_KEY = "ms_fired_events";       // sessionStorage: JSON array of fired event keys
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min inactivity -> new session

// Symbolic event keys -> allowlist strings. Call sites import EVENTS.CARD_ADDED
// rather than typing the raw string. Every value MUST be in ANALYTICS_EVENT_SET
// or track() will silently drop it (dev assertion below guards against drift).
export const EVENTS = Object.freeze({
  PAGE_VIEW: "page_view",
  SET_OPENED: "set_opened",
  CARD_ADDED: "card_added",
  THRESHOLD_SHOWN: "threshold_shown",
  AUTH_REQUIRED_SHOWN: "auth_required_shown",
  NAV_AWAY_WARNED: "nav_away_warned",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  WANT_LIST_VIEWED: "want_list_viewed",
  FRIEND_LINK_VIEWED: "friend_link_viewed",
  TRADE_INVITE_VIEWED: "trade_invite_viewed",
  REFERRAL_LANDING: "referral_landing",
  EBAY_CLICK: "ebay_click",
});

if (process.env.NODE_ENV !== "production") {
  for (const [key, value] of Object.entries(EVENTS)) {
    if (!ANALYTICS_EVENT_SET.has(value)) {
      console.error(
        `[track] EVENTS.${key} = "${value}" is not in ANALYTICS_EVENT_SET — track() will drop it.`
      );
    }
  }
}

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

function getStoredUserId() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(USER_KEY) || null;
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
  // Client-side user_id is a best-effort hint for events fired between
  // identifyOnSignup() and the next page load. The server still derives
  // user_id from the auth cookie as the source of truth and prefers it.
  const userId = getStoredUserId();
  if (userId) payload.user_id = userId;
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

// Identity stitch: link the current anon_id to the authenticated user_id at
// signup. Awaited internally so the localStorage write only happens after the
// server confirms the link — but callers fire-and-forget (don't await this).
export async function identifyOnSignup(userId) {
  if (typeof window === "undefined") return;
  if (!userId || typeof userId !== "string") return;
  const anon_id = getAnonId();
  if (!anon_id) return;

  try {
    const res = await fetch("/api/analytics/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anon_id, user_id: userId }),
      keepalive: true,
    });
    if (res.ok) {
      try { localStorage.setItem(USER_KEY, userId); } catch { /* storage blocked */ }
    }
  } catch { /* analytics must never break signup */ }
}

// Per-session dedupe. signup_completed can be reached from three call sites;
// hasFired/markFired ensure it emits exactly once per browser session.
export function hasFired(eventKey) {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) && arr.includes(eventKey);
  } catch { return false; }
}

export function markFired(eventKey) {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed) ? parsed : [];
    if (!arr.includes(eventKey)) {
      arr.push(eventKey);
      sessionStorage.setItem(FIRED_KEY, JSON.stringify(arr));
    }
  } catch { /* ignore */ }
}
