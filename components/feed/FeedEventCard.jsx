"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Send, Layers, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { useTableRefetch } from "@/lib/hooks/useTableRefetch";

function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function FeedEventCard({ event, viewerId, viewerCollectsSet }) {
  const supabase = createClient();
  const router = useRouter();

  const [liked, setLiked] = useState(event.liked_by_me);
  const [likeCount, setLikeCount] = useState(Number(event.like_count));
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  // Sync from event prop when parent refetches
  useEffect(() => {
    setLiked(event.liked_by_me);
    setLikeCount(Number(event.like_count));
  }, [event.liked_by_me, event.like_count]);

  // Load comments when expanded for first time
  useEffect(() => {
    if (!commentsExpanded || commentsLoaded) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("feed_event_comments")
        .select(`id, body, created_at, author_id, author:profiles!author_id(handle)`)
        .eq("event_id", event.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setComments(data || []);
      setCommentsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [commentsExpanded, commentsLoaded, event.id, supabase]);

  // Real-time: new comments arrive without disrupting input focus
  useTableRefetch({
    supabase,
    table: "feed_event_comments",
    events: ["INSERT"],
    filter: `event_id=eq.${event.id}`,
    channelName: `feed-event-comments:${event.id}`,
    onChange: async () => {
      if (!commentsExpanded) return;
      const { data } = await supabase
        .from("feed_event_comments")
        .select(`id, body, created_at, author_id, author:profiles!author_id(handle)`)
        .eq("event_id", event.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      setComments(data || []);
      // Keep input focused after real-time update
      inputRef.current?.focus();
    },
    enabled: commentsExpanded,
  });

  const handleLikeToggle = async (e) => {
    e.stopPropagation();
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("feed_event_likes")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", viewerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("feed_event_likes")
          .insert({ event_id: event.id, user_id: viewerId });
        if (error && error.code !== "23505") throw error;
      }
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
      console.error("[FeedEventCard] like toggle failed:", err);
    }
  };

  const handleCommentToggle = (e) => {
    e.stopPropagation();
    setCommentsExpanded(prev => !prev);
  };

  const handleCommentSend = async (e) => {
    e?.preventDefault?.();
    const body = commentText.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("feed_event_comments")
        .insert({ event_id: event.id, author_id: viewerId, body });
      if (error) throw error;
      setCommentText("");
      // Comment will arrive via the real-time subscription
    } catch (err) {
      console.error("[FeedEventCard] comment send failed:", err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleCardTap = () => {
    if (viewerCollectsSet) {
      router.push(`/set/${event.related_set_id}`);
    }
  };

  return (
    <article
      style={{
        background: "rgba(244,244,246,0.02)",
        border: "0.5px solid rgba(244,244,246,0.08)",
        borderRadius: "var(--border-radius-lg)",
        padding: "14px 16px",
        cursor: viewerCollectsSet ? "pointer" : "default",
      }}
      onClick={handleCardTap}
    >
      <header style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Link
          href={`/friend/${event.actor_handle}`}
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0 }}
        >
          <Avatar
            profile={{ handle: event.actor_handle, avatar_url: event.actor_avatar_url }}
            size={40}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <Link
              href={`/friend/${event.actor_handle}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: "var(--po-text)", fontSize: 14, fontWeight: 500 }}
            >
              @{event.actor_handle}
            </Link>
            <span style={{ color: "var(--po-text-dim)", fontSize: 14 }}>
              started collecting {event.set_name}
            </span>
          </div>
          <div style={{ color: "var(--po-text-dim)", fontSize: 12, opacity: 0.7 }}>
            {formatRelativeTime(event.created_at)}
          </div>
        </div>
        {event.set_logo_url && (
          <img
            src={event.set_logo_url}
            alt={event.set_name}
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--border-radius-md)",
              objectFit: "contain",
              background: "rgba(244,244,246,0.04)",
              padding: 4,
              flexShrink: 0,
            }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
      </header>

      {viewerCollectsSet && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            background: "rgba(200,255,74,0.08)",
            border: "0.5px solid rgba(200,255,74,0.25)",
            borderRadius: "var(--border-radius-md)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Layers size={16} style={{ color: "var(--po-green)", flexShrink: 0 }} />
          <span style={{ color: "var(--po-green)", fontSize: 13, fontWeight: 500, flex: 1 }}>
            Got duplicates to help?
          </span>
          <ArrowRight size={14} style={{ color: "var(--po-green)", flexShrink: 0 }} />
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "0.5px solid rgba(244,244,246,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <button
          type="button"
          onClick={handleLikeToggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: liked ? "var(--po-green)" : "var(--po-text-dim)",
          }}
          aria-label={liked ? "Unlike this event" : "Like this event"}
        >
          <Heart size={18} fill={liked ? "var(--po-green)" : "none"} />
          <span style={{ fontSize: 13, fontWeight: liked ? 500 : 400 }}>{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={handleCommentToggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: commentsExpanded ? "var(--po-green)" : "var(--po-text-dim)",
          }}
          aria-label={commentsExpanded ? "Hide comments" : "Show comments"}
        >
          <MessageCircle size={18} />
          <span style={{ fontSize: 13 }}>{Number(event.comment_count)}</span>
        </button>
      </div>

      {commentsExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "0.5px solid rgba(244,244,246,0.06)",
          }}
        >
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <Avatar
                profile={{ handle: c.author?.handle, avatar_url: null }}
                size={28}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                  <span style={{ color: "var(--po-text)", fontSize: 13, fontWeight: 500 }}>
                    @{c.author?.handle || "unknown"}
                  </span>
                  <span style={{ color: "var(--po-text-dim)", fontSize: 11, opacity: 0.7 }}>
                    {formatRelativeTime(c.created_at)}
                  </span>
                </div>
                <div style={{ color: "var(--po-text)", fontSize: 13, lineHeight: 1.4, opacity: 0.85 }}>
                  {c.body}
                </div>
              </div>
            </div>
          ))}

          <form
            onSubmit={handleCommentSend}
            style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
          >
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
              style={{
                flex: 1,
                background: "rgba(244,244,246,0.04)",
                border: "0.5px solid rgba(244,244,246,0.08)",
                borderRadius: "var(--border-radius-md)",
                padding: "8px 12px",
                color: "var(--po-text)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || sending}
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--border-radius-md)",
                background: "rgba(200,255,74,0.12)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: commentText.trim() && !sending ? "pointer" : "default",
                opacity: commentText.trim() && !sending ? 1 : 0.4,
              }}
              aria-label="Send comment"
            >
              <Send size={16} style={{ color: "var(--po-green)" }} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
