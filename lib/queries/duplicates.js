export async function fetchUserDuplicates(supabase, targetUserId, viewerId) {
  const { data, error } = await supabase.rpc("get_user_duplicates", {
    target_user: targetUserId,
    viewer: viewerId,
  });
  if (error) throw error;
  return data || [];
}
