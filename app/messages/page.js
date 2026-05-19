"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useTableRefetch } from "@/lib/hooks/useTableRefetch";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

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

  const loadConversations = async (userId) => {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, read, created_at, message_type, metadata")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (!messages?.length) { setConversations([]); return; }

    const threadMap = {};
    for (const msg of messages) {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      if (!threadMap[otherId]) threadMap[otherId] = { otherId, latest: msg, unread: 0 };
      if (!msg.read && msg.recipient_id === userId) threadMap[otherId].unread++;
    }

    const otherIds = Object.keys(threadMap);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", otherIds);
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    const convos = Object.values(threadMap)
      .sort((a, b) => new Date(b.latest.created_at) - new Date(a.latest.created_at))
      .map((t) => ({ ...t, profile: profileMap[t.otherId] }));

    setConversations(convos);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);
      await loadConversations(user.id);
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

  return (
    <MSShell>
      <MSPageTitle>Messages</MSPageTitle>

      <div className="max-w-md mx-auto px-4 pb-4">
        {conversations === null && (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-16">Loading...</div>
        )}

        {conversations?.length === 0 && (
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
                key={convo.otherId}
                href={`/messages/${convo.profile?.handle || convo.otherId}`}
                className="flex items-center gap-3 py-3.5 hover:bg-[var(--po-bg-soft)] -mx-2 px-2 rounded-xl transition-colors"
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
                    <span className={`text-sm font-bold truncate ${convo.unread > 0 ? "text-[var(--po-text)]" : "text-[var(--po-text-dim)]"}`}>
                      @{convo.profile?.handle || convo.otherId}
                    </span>
                    <span className="text-[10px] text-[var(--po-text-faint)] flex-shrink-0">
                      {timeAgo(convo.latest.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-xs truncate flex-1 ${convo.unread > 0 ? "text-[var(--po-text)]" : "text-[var(--po-text-faint)]"}`}>
                      {convo.latest.sender_id === user?.id ? "You: " : ""}{convo.latest.body}
                    </p>
                    {convo.unread > 0 && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--po-green)" }} />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MSShell>
  );
}
