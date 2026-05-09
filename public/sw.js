// Cache version — bump this any time you need to force-evict all cached
// entries (e.g. after changing cache strategy or adding new precache URLs).
const CACHE = "perfect-order-v2";

const PRECACHE_URLS = ["/", "/login", "/friends", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE_URLS)));
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

  // Never intercept Supabase API calls.
  if (url.hostname.includes("supabase.co")) return;

  // Navigate requests: NetworkFirst.
  // Always fetch fresh HTML — this is what carries the content-hashed chunk
  // URLs for the current deployment. Falling back to cache only when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request).then((r) => r || caches.match("/"))
      )
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
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
