/**
 * Client-side admin check. Takes a browser Supabase client and a userId.
 * Returns true if the user has is_admin = true, false otherwise.
 * Caller handles routing (typically notFound() if false).
 */
export async function isAdminClient(supabase, userId) {
  if (!userId) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return !!profile?.is_admin;
}
