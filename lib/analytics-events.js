// Shared allowlist of valid analytics event names. Client-safe (no server
// imports) — imported by /api/track now and the client tracker in PART 3.
export const ANALYTICS_EVENTS = Object.freeze([
  "page_view",
  "set_opened",
  "card_added",
  "threshold_shown",
  "auth_required",
  "signup_started",
  "signup_completed",
  "want_list_viewed",
  "trade_invite_viewed",
  "referral_landing",
  "ebay_click",
]);

export const ANALYTICS_EVENT_SET = new Set(ANALYTICS_EVENTS);
