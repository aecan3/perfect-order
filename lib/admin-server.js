import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

/**
 * Verifies the request comes from an admin user.
 * Returns { user, supabase } on success.
 * Returns NextResponse 401/403 on failure — caller must return it.
 *
 * Usage in API route:
 *   const guard = await requireAdmin();
 *   if (guard instanceof NextResponse) return guard;
 *   const { user, supabase } = guard;
 */
export async function requireAdmin() {
  const supabase = await getSupabase();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  console.log("[requireAdmin] user lookup:", {
    hasUser: !!user,
    userId: user?.id,
    userErr: userErr?.message,
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  console.log("[requireAdmin] profile lookup:", {
    userId: user.id,
    profile,
    profileErr: profileErr?.message,
  });

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user, supabase };
}
