"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Flag } from "lucide-react";
import { TradePanel } from "@/components/TradePanel";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { OverflowMenu } from "@/components/OverflowMenu";
import { ReportUserForm } from "@/components/ReportUserForm";

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
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [currency, setCurrency] = useState("AUD");

  // Pre-populated trade message from discover panel
  // Supports single ?card=<json> or bulk ?cards=<json-array>
  const prefill = searchParams.get("prefill");
  const cardsMeta = (() => {
    try {
      const multi = searchParams.get("cards");
      if (multi) return JSON.parse(multi);
      const single = searchParams.get("card");
      if (single) return [JSON.parse(single)];
      return null;
    } catch { return null; }
  })();
  // Keep legacy single reference for backwards-compat rendering
  const cardMeta = cardsMeta?.[0] ?? null;

  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const channelRef = useRef(null);
  const initialScrollDone = useRef(false);
  const initialScrollAtRef = useRef(0);
  const prevCountRef = useRef(0);
  const firstUnreadRef = useRef(null);

  const handleAsyncContentLoaded = useCallback(() => {
    if (!initialScrollDone.current) return;
    if (Date.now() - initialScrollAtRef.current > 2000) return;
    if (firstUnreadRef.current) return;
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, []);

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
      if (!user) { router.replace("/welcome"); return; }
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

  // Instant scroll on initial load; follow new messages only if near bottom
  useEffect(() => {
    if (messages.length === 0) return;
    if (!initialScrollDone.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = scrollContainerRef.current;
          if (!container) return;
          if (firstUnreadRef.current) {
            firstUnreadRef.current.scrollIntoView({ block: "start", behavior: "instant" });
          } else {
            container.scrollTop = container.scrollHeight;
          }
          initialScrollDone.current = true;
          initialScrollAtRef.current = Date.now();
        });
      });
    } else if (messages.length > prevCountRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distFromBottom < 80) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
    prevCountRef.current = messages.length;
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
      message_type: cardsMeta ? "trade_proposal" : "message",
      metadata: cardsMeta ? { cards: cardsMeta } : null,
    };
    const { error } = await supabase.from("messages").insert(payload);
    if (!error) {
      setBody("");
      // Clear card attachment after first send
      if (cardsMeta) router.replace(`/messages/${handle}`);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const firstUnreadMsgId = user
    ? (messages.find((m) => m.recipient_id === user.id && !m.read)?.id ?? null)
    : null;

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const day = fmtDate(msg.created_at);
    if (!acc.length || acc[acc.length - 1].day !== day) acc.push({ day, msgs: [] });
    acc[acc.length - 1].msgs.push(msg);
    return acc;
  }, []);

  return (
    <>
    <MSShell hideTabBar>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Thread header with back arrow */}
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--po-border)", padding: "12px 16px", background: "var(--po-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 448, margin: "0 auto" }}>
            <button onClick={() => router.back()} style={{ color: "var(--po-text-dim)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              <ArrowLeft size={20} />
            </button>
            <Link href={`/friend/${handle}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
              <p style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2, color: "var(--po-text)", margin: 0 }}>@{handle}</p>
            </Link>
            {otherProfile && (
              <OverflowMenu
                targetHandle={handle}
                items={[{
                  icon: Flag,
                  label: "Report user",
                  onClick: () => setReportFormOpen(true),
                }]}
              />
            )}
          </div>
        </div>

        {/* Scrollable message list */}
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div className="px-4 py-4 max-w-md mx-auto w-full">
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
                const isFirstUnread = msg.id === firstUnreadMsgId;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    {isFirstUnread && (
                      <div ref={firstUnreadRef} className="self-stretch flex items-center gap-3 mb-2">
                        <div className="flex-1 h-px bg-[var(--po-border)]" />
                        <span className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">New messages</span>
                        <div className="flex-1 h-px bg-[var(--po-border)]" />
                      </div>
                    )}
                    {/* Verification photo message */}
                    {msg.message_type === "trade_verification_photo" && (
                      <div className="w-full max-w-[80%] rounded-2xl overflow-hidden border border-[var(--po-border)]" style={{ background: "var(--po-bg-soft)" }}>
                        {meta?.photoUrl ? (
                          <img src={meta.photoUrl} alt={meta?.cardName || "Verified card"} className="w-full object-cover" style={{ maxHeight: 320 }} onLoad={handleAsyncContentLoaded} />
                        ) : (
                          <div className="w-full flex items-center justify-center py-8 text-[var(--po-text-faint)] text-xs">Photo unavailable</div>
                        )}
                        <div className="px-3 py-2.5 space-y-1">
                          {meta?.cardName && (
                            <p className="text-sm font-bold text-[var(--po-text)]">{meta.cardName}</p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                              style={{ background: "var(--po-green)", color: "#050507" }}
                            >
                              AI Verified
                            </span>
                            {meta?.verifiedAt && (
                              <span className="text-[9px] text-[var(--po-text-faint)]">
                                {fmtTime(meta.verifiedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-[8px] text-[var(--po-text-faint)] leading-relaxed">
                            This photo will be automatically deleted when the trade completes.
                          </p>
                          <p className="text-[8px] text-[var(--po-text-faint)] leading-relaxed">
                            Photo confirmation only. Master Setter does not authenticate or guarantee card condition.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Card previews for trade proposals — horizontal scroll row */}
                    {(() => {
                      const cardList = meta?.cards || (meta?.cardName ? [meta] : null);
                      if (!cardList?.length) return null;
                      // normalise camelCase (legacy) and snake_case (new propose API)
                      const norm = (c) => ({
                        imageUrl: c.imageUrl || c.image_url,
                        cardName: c.cardName || c.card_name,
                        priceUsd: c.priceUsd ?? c.price_usd,
                        side: c.side,
                      });
                      return (
                        <div
                          className="flex gap-2 mb-1 overflow-x-auto pb-1"
                          style={{ maxWidth: 280, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
                        >
                          {cardList.map((raw, ci) => {
                            const c = norm(raw);
                            return (
                              <div
                                key={ci}
                                className="flex-none flex flex-col rounded-xl overflow-hidden border"
                                style={{
                                  width: 88,
                                  background: "var(--po-bg-soft)",
                                  scrollSnapAlign: "start",
                                  borderColor: c.side === "request" ? "var(--po-green)" : "var(--po-border)",
                                }}
                              >
                                {c.imageUrl ? (
                                  <img src={c.imageUrl} alt={c.cardName} className="w-full object-cover" style={{ height: 120 }} onLoad={handleAsyncContentLoaded} />
                                ) : (
                                  <div className="flex items-center justify-center text-[8px] text-[var(--po-text-faint)] p-1 text-center" style={{ height: 120 }}>
                                    {c.cardName}
                                  </div>
                                )}
                                <div className="px-1.5 py-1.5">
                                  {c.side && (
                                    <p className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: c.side === "request" ? "var(--po-green)" : "var(--po-text-dim)" }}>
                                      {c.side === "offer"
                                        ? (isMine ? "You offer" : "They offer")
                                        : (isMine ? "They offer" : "You offer")}
                                    </p>
                                  )}
                                  <p className="text-[9px] font-bold leading-tight line-clamp-2 text-[var(--po-text)]">{c.cardName}</p>
                                  {c.priceUsd > 0 && (
                                    <p className="text-[9px] font-black mt-0.5" style={{ color: "var(--po-green)" }}>
                                      {fmtMoney(c.priceUsd * (RATES[currency]?.rate || 1), currency)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {msg.message_type !== "trade_verification_photo" && (
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
                    )}

                    {showTime && (
                      <span className="text-[9px] text-[var(--po-text-faint)] mt-0.5 px-1">{fmtTime(msg.created_at)}</span>
                    )}

                    {/* Trade panel — shown for trade_proposal messages that have a trade_id */}
                    {msg.message_type === "trade_proposal" && meta?.trade_id && otherProfile && (
                      <div className="w-full max-w-[85%]">
                        <TradePanel
                          tradeId={meta.trade_id}
                          user={user}
                          otherHandle={handle}
                          otherUserId={otherProfile.id}
                          requestCard={meta.cards?.find((c) => (c.side === "request")) || null}
                          supabase={supabase}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        </div>
        </div>

        {/* Card previews above input when arriving from Discover — horizontal scroll */}
        {cardsMeta?.length > 0 && (
          <div
            style={{ flexShrink: 0, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
            className="max-w-md mx-auto w-full px-4 pb-2 flex gap-2 overflow-x-auto"
          >
            {cardsMeta.map((c, i) => (
              <div
                key={i}
                className="flex-none flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--po-border)] text-xs"
                style={{ background: "var(--po-bg-soft)", scrollSnapAlign: "start", minWidth: 180, maxWidth: 240 }}
              >
                {c.imageUrl && (
                  <img src={c.imageUrl} alt={c.cardName} className="w-8 h-10 object-cover rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-[var(--po-text)]">{c.cardName}</p>
                  <p className="text-[var(--po-text-faint)] truncate">{c.setName}</p>
                  {c.priceUsd > 0 && (
                    <p className="font-black" style={{ color: "var(--po-green)" }}>
                      {fmtMoney(c.priceUsd * (RATES[currency]?.rate || 1), currency)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--po-border)", background: "var(--po-bg)", padding: "12px 16px" }}>
          <div className="flex items-end gap-2 max-w-md mx-auto">
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
    </MSShell>
    {otherProfile && (
      <ReportUserForm
        isOpen={reportFormOpen}
        onClose={() => setReportFormOpen(false)}
        reportedUserId={otherProfile.id}
        reportedUserHandle={otherProfile.handle}
        context="thread"
      />
    )}
    </>
  );
}
