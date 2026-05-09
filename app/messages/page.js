"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);

      const { data: messages } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, body, read, created_at, message_type, metadata")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!messages?.length) { setConversations([]); return; }

      // Group by the other person
      const threadMap = {};
      for (const msg of messages) {
        const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        if (!threadMap[otherId]) threadMap[otherId] = { otherId, latest: msg, unread: 0 };
        if (!msg.read && msg.recipient_id === user.id) threadMap[otherId].unread++;
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
    })();
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <button onClick={() => router.back()} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-black text-base flex-1">Messages</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        {conversations === null && (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-16">Loadingâ€¦</div>
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
      </main>
    </div>
  );
}

