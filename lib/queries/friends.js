// Returns an array of user IDs who are accepted friends of userId.
export async function getFriendIds(supabase, userId) {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq("status", "accepted");
  if (error) throw error;
  return (data || []).map((f) => f.user_a === userId ? f.user_b : f.user_a);
}
