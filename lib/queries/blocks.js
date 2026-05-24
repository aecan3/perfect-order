// Returns a Set of user IDs in a block relationship with userId (both directions).
// Uses get_block_peer_ids() SECURITY DEFINER RPC — the restrictive SELECT policy
// only exposes outgoing blocks to the client, so the RPC is required for symmetry.
export async function getBlockIds(supabase, userId) {
  const { data, error } = await supabase.rpc("get_block_peer_ids", { viewer: userId });
  if (error) throw error;
  return new Set((data || []).map((row) => row.peer_id));
}
