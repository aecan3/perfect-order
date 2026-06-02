// Cache version — bump this any time you need to force-evict all cached
// entries (e.g. after changing cache strategy or adding new precache URLs).
const CACHE = "perfect-order-v24";

// /data/au-localities.json is the static suburb autocomplete dataset (~134 KB gzipped).
// Precached so suburb search works offline after first SW install.
const PRECACHE_URLS = ["/", "/welcome", "/login", "/friends", "/manifest.json", "/data/au-localities.json"];

self.addEventListener("install", (e) => {
  // Use allSettled so a single failed precache (e.g. 401 on a protected deploy URL)
  // doesn't abort the entire SW install.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => c.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache non-http(s) schemes (chrome-extension, data, etc.)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never intercept Supabase API calls.
  if (url.hostname.endsWith("supabase.co")) return;

  // Only handle GET requests — POST/PUT/DELETE must always go to the network.
  if (e.request.method !== "GET") return;

  // Never intercept auth flows — Supabase redirect chain and token exchanges
  // must reach the server directly. SW caching these breaks email confirmation.
  if (url.pathname.startsWith("/auth/")) return;

  // Never intercept API routes — dynamic server-side handlers, no caching benefit.
  if (url.pathname.startsWith("/api/")) return;

  // Navigate requests: NetworkFirst.
  // Always fetch fresh HTML — this is what carries the content-hashed chunk
  // URLs for the current deployment. Falling back to cache only when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        const fallback = await caches.match("/");
        if (fallback) return fallback;
        // Defensive: never resolve to undefined — that breaks e.respondWith().
        return new Response("<html><body>Offline</body></html>", {
          status: 503,
          headers: { "Content-Type": "text/html" },
        });
      })
    );
    return;
  }

  // Next.js content-hashed static assets: StaleWhileRevalidate.
  // URLs under /_next/static/ always include a content hash
  // (e.g. /_next/static/chunks/app/page-abc123.js), so the cached response
  // for a given URL is always correct — it can never go stale. Serving from
  // cache is fast; the background fetch keeps the cache warm for future loads.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        });
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // Everything else: NetworkFirst.
  // Non-hashed paths (RSC payloads, app icons, other assets at stable URLs)
  // must always be fetched fresh so that a new deployment is visible
  // immediately — without requiring the user to manually clear their cache.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          // Clone synchronously before caches.open resolves asynchronously —
          // by the time the .then fires, res body may already be consumed.
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        return cached ?? new Response("", { status: 503 });
      })
  );
});
