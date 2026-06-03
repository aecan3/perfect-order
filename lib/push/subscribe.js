import { isPushSupported } from "./support";

// Converts a VAPID base64url public key to the Uint8Array that
// pushManager.subscribe() requires as applicationServerKey.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Returns the current push state for display.
// "on"      — permission granted AND a live browser subscription exists.
// "off"     — permission default (never asked) — can prompt.
// "blocked" — permission denied by the user — must re-enable in OS settings.
// "unsupported" — PushManager not available (non-installed iOS, old browser).
export async function getPushState() {
  if (!isPushSupported()) return "unsupported";

  if (Notification.permission === "denied") return "blocked";

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return "off";
  }

  const subscription = await registration.pushManager.getSubscription();
  if (Notification.permission === "granted" && subscription !== null) return "on";

  return "off";
}

// Requests notification permission, subscribes via PushManager, and POSTs
// the subscription to /api/push/subscribe. Returns the subscription on
// success, null on any failure or unsupported context.
export async function subscribeToPush() {
  if (!isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
    return null;
  }

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return null;
  }

  let subscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch {
    return null;
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    console.warn("[push] subscribe API failed", res.status);
    return null;
  }

  return subscription;
}

// Unsubscribes from push: browser-side unsubscribe + DB row delete.
// No-op if there is no active subscription. Returns true on success.
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return true;

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return true;
  }

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;

  // Browser side — stops delivery immediately.
  try {
    await subscription.unsubscribe();
  } catch {
    // Continue to DB delete even if browser unsubscribe fails.
  }

  // DB side — stops the webhook from attempting dead sends.
  const res = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

  if (!res.ok) {
    console.warn("[push] unsubscribe API failed", res.status);
    return false;
  }

  return true;
}
