// Push support and standalone detection helpers.
// Used by both the settings toggle (Part 1) and the contextual prompt (Part 2).

// Returns true when the browser supports web push.
// False in non-installed iOS Safari, old browsers, and SSR.
export function isPushSupported() {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Returns true when the app is running as an installed PWA (standalone mode).
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}
