import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Separate non-singleton client with the experimental passkey flag enabled.
// Must not replace createClient() — the singleton is used everywhere else.
export function createPasskeyClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { isSingleton: false, auth: { experimental: { passkey: true } } }
  );
}
