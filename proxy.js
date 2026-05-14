import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Paths that must remain publicly accessible — never require auth.
// Includes PWA assets, icons, the SW itself, and the login page.
const PUBLIC_PATHS = new Set([
  "/welcome",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/manifest.json",
  "/sw.js",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
]);

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/icons/")) {
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
