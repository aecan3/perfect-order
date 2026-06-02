// Converts a VAPID base64url public key to the Uint8Array that
// pushManager.subscribe() requires as applicationServerKey.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Requests notification permission, subscribes via PushManager, and POSTs
// the subscription to /api/push/subscribe. Returns the subscription on
// success, null on any failure or unsupported context (non-installed iOS,
// no PushManager, permission denied).
export async function subscribeToPush() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return null;
  }

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
