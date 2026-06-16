"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, SquarePen } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getBlockIds } from "@/lib/queries/blocks";
import { useTableRefetch } from "@/lib/hooks/useTableRefetch";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { NewMessageSheet } from "@/components/NewMessageSheet";
import { Avatar } from "@/components/Avatar";

const timeAgo = (ts) => {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

export default function InboxPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  // Incoming message requests (held first-contact from non-friends).
  const [requests, setRequests] = useState([]);
  const [resolvedRequests, setResolvedRequests] = useState({}); // id → 'accepted' | 'declined'
  const [requestError, setRequestError] = useState({});         // id → true (RPC failed; keep the buttons)

  const loadConversations = async (userId) => {
    const [{ data: threads }, blockIds] = await Promise.all([
      supabase.rpc("get_inbox_threads", { viewer: userId }),
      getBlockIds(supabase, userId),
    ]);

    if (!threads?.length) { setConversations([]); return; }

    const visible = threads.filter((t) => !blockIds.has(t.peer_id));
    if (!visible.length) { setConversations([]); return; }

    const peerIds = visible.map((t) => t.peer_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", peerIds);
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    setConversations(
      visible.map((t) => ({ ...t, profile: profileMap[t.peer_id] }))
    );
  };

  // Pending incoming message requests, joined to each sender's profile. Uses the
  // recipient-SELECT RLS (direct client query). sender_id FKs auth.users (not
  // profiles), so we resolve sender display with a second profiles query — the
  // same two-query shape loadConversations uses for peers.
  const loadRequests = async (userId) => {
    const { data: rows } = await supabase
      .from("message_requests")
      .select("id, sender_id, first_message, payload, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });
    if (!rows?.length) { setRequests([]); return; }

    const blockIds = await getBlockIds(supabase, userId);
    const visible = rows.filter((r) => !blockIds.has(r.sender_id));
    if (!visible.length) { setRequests([]); return; }

    const senderIds = [...new Set(visible.map((r) => r.sender_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .in("id", senderIds);
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    setRequests(visible.map((r) => ({ ...r, profile: profileMap[r.sender_id] })));
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);
      await Promise.all([loadConversations(user.id), loadRequests(user.id)]);
    })();
  }, [router, supabase]);

  useTableRefetch({
    supabase,
    table: "messages",
    events: ["INSERT", "UPDATE"],
    filter: user ? `recipient_id=eq.${user.id}` : null,
    channelName: `inbox:${user?.id}`,
    onChange: () => user && loadConversations(user.id),
    enabled: !!user?.id,
  });

  // Accept → friendship created + held message delivered (RPC 2), then the messages
  // realtime refetch surfaces the new conversation below. Resolve in place, no nav.
  const acceptRequest = async (req) => {
    setRequestError((prev) => { const next = { ...prev }; delete next[req.id]; return next; });
    const { error } = await supabase.rpc("accept_message_request", { p_request_id: req.id });
    if (error) { setRequestError((prev) => ({ ...prev, [req.id]: true })); return; }
    setResolvedRequests((prev) => ({ ...prev, [req.id]: "accepted" }));
  };

  // Decline → request row deleted (RPC 3). Silent: no sender notification.
  const declineRequest = async (req) => {
    setRequestError((prev) => { const next = { ...prev }; delete next[req.id]; return next; });
    const { error } = await supabase.rpc("decline_message_request", { p_request_id: req.id });
    if (error) { setRequestError((prev) => ({ ...prev, [req.id]: true })); return; }
    setResolvedRequests((prev) => ({ ...prev, [req.id]: "declined" }));
  };

  const pendingRequestCount = requests.filter((r) => !resolvedRequests[r.id]).length;

  return (
    <MSShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 18 }}>
        <MSPageTitle>Messages</MSPageTitle>
        <button
          onClick={() => setComposeOpen(true)}
          className="ms-pressable"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36,
            background: "var(--po-green)", color: "#050507",
            border: "none", borderRadius: 10,
            cursor: "pointer", flexShrink: 0,
          }}
          aria-label="New message"
        >
          <SquarePen size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 pb-4">
        {/* Message requests — held first-contact from non-friends. Renders only when
            there are pending requests; the conversation list below is untouched. */}
        {requests.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 px-1 pt-2 pb-2">
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--po-text-dim)" }}>
                Message requests
              </span>
              {pendingRequestCount > 0 && (
                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, fontWeight: 700, color: "var(--po-green)" }}>
                  {pendingRequestCount}
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--po-border)]">
              {requests.map((req) => {
                const resolved = resolvedRequests[req.id];
                const cardCount = req.payload?.cards?.length || 0;
                return (
                  <div key={req.id} className="py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar profile={req.profile} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold truncate text-[var(--po-text)]">@{req.profile?.handle || req.sender_id}</span>
                          {cardCount > 0 && (
                            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--po-green)", border: "1px solid var(--po-border)", borderRadius: 6, padding: "1px 5px", flexShrink: 0 }}>
                              Trade
                            </span>
                          )}
                        </div>
                        <p className="text-xs truncate text-[var(--po-text-faint)] mt-0.5">{req.first_message}</p>
                      </div>
                    </div>

                    {/* Action row — reuses the notifications Accept/Decline pattern verbatim. */}
                    <div style={{ marginTop: 10, paddingLeft: 52 }}>
                      {resolved ? (
                        <div style={{ fontSize: 13, fontFamily: '"IBM Plex Sans", sans-serif', color: resolved === "accepted" ? "var(--ms-accent)" : "var(--ms-dim)" }}>
                          {resolved === "accepted" ? "Accepted ✓" : "Declined"}
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => acceptRequest(req)}
                              style={{ flex: 1, padding: "8px 12px", background: "var(--ms-accent)", color: "black", border: "none", borderRadius: 8, fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => declineRequest(req)}
                              style={{ flex: 1, padding: "8px 12px", background: "transparent", color: "var(--ms-dim)", border: "0.5px solid var(--ms-rule)", borderRadius: 8, fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                            >
                              Decline
                            </button>
                          </div>
                          {requestError[req.id] && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "var(--ms-danger)", fontFamily: '"IBM Plex Sans", sans-serif' }}>
                              Couldn't complete. Try again.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {conversations === null && (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-16">Loading...</div>
        )}

        {conversations?.length === 0 && requests.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <MessageCircle size={36} className="mx-auto text-[var(--po-text-faint)]" />
            <p className="text-sm text-[var(--po-text-dim)]">No messages yet.</p>
            <p className="text-xs text-[var(--po-text-faint)]">Tap a card in Discover to start a trade conversation.</p>
          </div>
        )}

        {conversations?.length > 0 && (
          <div className="divide-y divide-[var(--po-border)]">
            {conversations.map((convo) => (
              <Link
                key={convo.peer_id}
                href={`/messages/${convo.profile?.handle || convo.peer_id}`}
                className="ms-pressable flex items-center gap-3 py-3.5 hover:bg-[var(--po-bg-soft)] -mx-2 px-2 rounded-xl transition-colors"
              >
                {/* Avatar placeholder */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                  style={{ background: "var(--po-bg-soft)", border: "1px solid var(--po-border)", color: "var(--po-green)" }}
                >
                  {(convo.profile?.handle || "?")[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-bold truncate ${convo.unread_count > 0 ? "text-[var(--po-text)]" : "text-[var(--po-text-dim)]"}`}>
                      @{convo.profile?.handle || convo.peer_id}
                    </span>
                    <span className="text-[10px] text-[var(--po-text-faint)] flex-shrink-0">
                      {timeAgo(convo.latest_created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-xs truncate flex-1 ${convo.unread_count > 0 ? "text-[var(--po-text)]" : "text-[var(--po-text-faint)]"}`}>
                      {convo.latest_sender_id === user?.id ? "You: " : ""}{convo.latest_body}
                    </p>
                    {convo.unread_count > 0 && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--po-green)" }} />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <NewMessageSheet open={composeOpen} onClose={() => setComposeOpen(false)} />
    </MSShell>
  );
}
