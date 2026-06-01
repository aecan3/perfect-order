import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// =============================================================================
// SERVER-SIDE AUTH GATE — proxy.js
//
// This is a Next.js 16 Proxy handler (NOT middleware.js). Next.js 16 compiles
// and runs it before any page or API route handler, on every request that
// matches the config.matcher below.
//
// WHAT IT DOES
//   - Reads the Supabase session from cookies via createServerClient.
//   - If the user is authenticated: passes the request through.
//   - If the user is NOT authenticated: issues a 307 redirect to /welcome.
//
// WHAT THE MATCHER DOES (AND DOES NOT DO)
//   The matcher only exempts Next.js internals (_next/static, _next/image,
//   _next/webpack-hmr) and favicon.ico. It is NOT a general static-asset
//   filter. Every other path — including pages, API routes, and files served
//   from the public/ folder (images, JSON, the SW, brand assets) — hits the
//   auth check in this file.
//
// THE RULE: ADD NEW PUBLIC PATHS HERE
//   Any route or asset that a logged-out user must be able to reach needs to
//   be explicitly allowed below — either by adding it to PUBLIC_PATHS (exact
//   match) or by adding a pathname.startsWith() prefix check in the proxy
//   function. Failure to do this silently gates the path behind auth and
//   redirects logged-out requests to /welcome with no error.
//
//   Examples of things that MUST be listed here:
//     - Auth pages: /login, /welcome, /forgot-password, /reset-password
//     - Auth callback routes: e.g. /auth/callback if one is ever added
//     - PWA assets: /manifest.json, /sw.js, /icon-*.png
//     - Public asset directories: /brand/ (email images, og-images), /icons/
//     - Any future legal/marketing pages visible to logged-out users
//
// This file has caused two incidents from missing entries:
//   1. /forgot-password and /reset-password were not listed — logged-out
//      users were bounced before reaching the password reset flow.
//   2. /brand/ was not listed — email clients fetching the logo PNG (a
//      logged-out request) received a 307 redirect instead of the image.
// =============================================================================

// Exact-match paths that bypass the auth check.
const PUBLIC_PATHS = new Set([
  "/welcome",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
  "/terms",
  "/privacy",
  "/manifest.json",
  "/sw.js",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  // Supabase webhook endpoint — receives INSERT events from card_reports table.
  // Authenticated via shared-secret Authorization header (CARD_REPORT_WEBHOOK_SECRET),
  // NOT via user session. Must be public to receive POSTs from Supabase infrastructure.
  "/api/admin/card-report-notify",

  // Vercel cron endpoint — called by Vercel scheduler, no session cookie present.
  // Authenticated via Authorization: Bearer CRON_SECRET header.
  "/api/cron/trade-handover-prompts",
  "/api/cron/marketplace-pool-refresh",

  // Sentry tunnel route — browser SDK POSTs events here to bypass ad-blockers.
  // Must be public: events are sent from unauthenticated contexts (pre-login errors,
  // logged-out error states). Auth gate would silently 307 these to /welcome.
  "/monitoring",
]);

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/trade-binder/") ||
    pathname.startsWith("/sets") ||    // set catalog (/sets)
    pathname.startsWith("/set/") ||    // per-set view — trailing slash is essential: without it /settings would match
    pathname.startsWith("/friend/")    // friend profile previews
  ) {
    return NextResponse.next();
  }

  // Build a mutable response so Supabase can refresh session cookies in place.
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files.
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico).*)",
  ],
};
