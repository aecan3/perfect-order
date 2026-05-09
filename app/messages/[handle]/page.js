"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase";

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });

const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};

const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

export default function ThreadPage() {
  const router = useRouter();
  const { handle } = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [otherProfile, setOtherProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [currency, setCurrency] = useState("AUD");

  // Pre-populated trade message from discover panel
  const prefill = searchParams.get("prefill");
  const cardMeta = (() => {
    try { return JSON.parse(searchParams.get("card") || "null"); } catch { return null; }
  })();

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    if (prefill) setBody(decodeURIComponent(prefill));
  }, [prefill]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);

      // Resolve other user by handle
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .eq("handle", handle)
        .maybeSingle();

      if (!profile) { router.replace("/messages"); return; }
      setOtherProfile(profile);

      // Load messages
      await loadMessages(user.id, profile.id);

      // Mark received messages as read
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("recipient_id", user.id)
        .eq("sender_id", profile.id)
        .eq("read", false);

      // Realtime subscription
      channelRef.current = supabase
        .channel(`thread:${[user.id, profile.id].sort().join(":")}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const msg = payload.new;
            const isRelevant =
              (msg.sender_id === user.id && msg.recipient_id === profile.id) ||
              (msg.sender_id === profile.id && msg.recipient_id === user.id);
            if (!isRelevant) return;

            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            // Auto-mark incoming as read
            if (msg.recipient_id === user.id) {
              await supabase.from("messages").update({ read: true }).eq("id", msg.id);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [handle, router, supabase]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async (myId, otherId) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`
      )
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const send = async () => {
    if (!body.trim() || !user || !otherProfile || sending) return;
    setSending(true);
    const payload = {
      sender_id: user.id,
      recipient_id: otherProfile.id,
      body: body.trim(),
      message_type: cardMeta ? "trade_proposal" : "message",
      metadata: cardMeta || null,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (!error) {
      setBody("");
      // Clear card meta after first send so subsequent messages are plain
      if (cardMeta) router.replace(`/messages/${handle}`);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const day = fmtDate(msg.created_at);
    if (!acc.length || acc[acc.length - 1].day !== day) acc.push({ day, msgs: [] });
    acc[acc.length - 1].msgs.push(msg);
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)] flex flex-col">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <button onClick={() => router.back()} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </button>
          <Link href={`/friend/${handle}`} className="flex-1 min-w-0">
            <p className="font-black text-base leading-tight">@{handle}</p>
          </Link>
        </div>
      </header>

      {/* Message list */}
      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center text-[var(--po-text-faint)] text-sm py-12">
            No messages yet — say something!
          </div>
        )}

        {grouped.map(({ day, msgs }) => (
          <div key={day}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[var(--po-border)]" />
              <span className="text-[10px] uppercase tracking-widest text-[var(--po-text-faint)]">{day}</span>
              <div className="flex-1 h-px bg-[var(--po-border)]" />
            </div>

            <div className="space-y-1.5">
              {msgs.map((msg, i) => {
                const isMine = msg.sender_id === user?.id;
                const showTime = i === msgs.length - 1 || msgs[i + 1]?.sender_id !== msg.sender_id;
                const meta = msg.metadata;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    {/* Card preview for trade proposals */}
                    {meta?.cardName && (
                      <div
                        className="mb-1 rounded-xl overflow-hidden border border-[var(--po-border)] flex gap-2 p-2 max-w-[260px]"
                        style={{ background: "var(--po-bg-soft)" }}
                      >
                        {meta.imageUrl && (
                          <img src={meta.imageUrl} alt={meta.cardName} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                        )}
                        <div className="flex flex-col justify-center min-w-0">
                          <p className="text-xs font-bold truncate text-[var(--po-text)]">{meta.cardName}</p>
                          <p className="text-[10px] text-[var(--po-text-dim)] truncate">{meta.setName}</p>
                          {meta.priceUsd > 0 && (
                            <p className="text-[10px] font-black mt-0.5" style={{ color: "var(--po-green)" }}>
                              {fmtMoney(meta.priceUsd * (RATES[currency]?.rate || 1), currency)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div
                      className="px-3 py-2 rounded-2xl max-w-[75%] text-sm leading-relaxed"
                      style={
                        isMine
                          ? { background: "var(--po-green)", color: "#050507", borderBottomRightRadius: 4 }
                          : { background: "var(--po-bg-soft)", color: "var(--po-text)", border: "1px solid var(--po-border)", borderBottomLeftRadius: 4 }
                      }
                    >
                      {msg.body}
                    </div>

                    {showTime && (
                      <span className="text-[9px] text-[var(--po-text-faint)] mt-0.5 px-1">{fmtTime(msg.created_at)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {/* Card preview above input when coming from Discover */}
      {cardMeta?.cardName && (
        <div className="max-w-md mx-auto w-full px-4 pb-1">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--po-border)] text-xs"
            style={{ background: "var(--po-bg-soft)" }}
          >
            {cardMeta.imageUrl && (
              <img src={cardMeta.imageUrl} alt={cardMeta.cardName} className="w-8 h-10 object-cover rounded flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate text-[var(--po-text)]">{cardMeta.cardName}</p>
              <p className="text-[var(--po-text-faint)] truncate">{cardMeta.setName}</p>
            </div>
            {cardMeta.priceUsd > 0 && (
              <span className="font-black flex-shrink-0" style={{ color: "var(--po-green)" }}>
                {fmtMoney(cardMeta.priceUsd * (RATES[currency]?.rate || 1), currency)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-[var(--po-border)] bg-[var(--po-bg)] px-4 py-3 max-w-md mx-auto w-full">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-2xl px-4 py-2.5 text-sm text-[var(--po-text)] placeholder:text-[var(--po-text-faint)] outline-none focus:border-[var(--po-green)] transition-colors leading-relaxed"
            style={{ maxHeight: 120, overflowY: "auto" }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={send}
            disabled={!body.trim() || sending}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
            style={{ background: body.trim() ? "var(--po-green)" : "var(--po-bg-soft)", color: body.trim() ? "#050507" : "var(--po-text-faint)" }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
