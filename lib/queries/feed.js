export async function fetchFeedEvents(supabase, userId) {
  const { data, error } = await supabase.rpc("get_feed_events", { viewer: userId });
  if (error) throw error;
  return data || [];
}
