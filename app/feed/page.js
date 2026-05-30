"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { fetchFeedEvents } from "@/lib/queries/feed";
import { useTableRefetch } from "@/lib/hooks/useTableRefetch";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { FeedEventCard } from "@/components/feed/FeedEventCard";

export default function FeedPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [events, setEvents] = useState(null); // null = loading
  const [collectedSetIds, setCollectedSetIds] = useState(new Set());

  // Auth + initial fetch
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/welcome");
        return;
      }
      if (cancelled) return;
      setUserId(user.id);

      const [feedData, ownedSetsData] = await Promise.all([
        fetchFeedEvents(supabase, user.id),
        supabase.from("user_sets").select("set_id").eq("user_id", user.id),
      ]);

      if (cancelled) return;
      setEvents(feedData);
      setCollectedSetIds(new Set((ownedSetsData.data || []).map(r => r.set_id)));
    })();

    return () => { cancelled = true; };
  }, [router, supabase]);

  // Real-time: refetch feed counts when likes change
  useTableRefetch({
    supabase,
    table: "feed_event_likes",
    events: ["INSERT", "DELETE"],
    channelName: `feed-likes:${userId}`,
    onChange: async () => {
      if (!userId) return;
      const fresh = await fetchFeedEvents(supabase, userId);
      setEvents(fresh);
    },
    enabled: !!userId,
  });

  // Real-time: refetch feed counts when comments change
  useTableRefetch({
    supabase,
    table: "feed_event_comments",
    events: ["INSERT", "UPDATE"],
    channelName: `feed-comments:${userId}`,
    onChange: async () => {
      if (!userId) return;
      const fresh = await fetchFeedEvents(supabase, userId);
      setEvents(fresh);
    },
    enabled: !!userId,
  });

  // Anchor scroll: on mount after events load, scroll to #event-<uuid> if present
  useEffect(() => {
    if (!events || events.length === 0) return;
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#event-")) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.substring(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [events]);

  return (
    <MSShell activeTab="feed">
      <MSPageTitle title="Feed" />

      {events === null && (
        <div style={{ padding: "2rem 1.25rem", color: "var(--po-text-dim)", textAlign: "center" }}>
          Loading…
        </div>
      )}

      {events !== null && events.length === 0 && (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "var(--po-text-dim)", fontSize: 14, marginBottom: 16 }}>
            Nothing in your feed yet.<br />
            Add friends and they&apos;ll show up here.
          </p>
          <Link
            href="/friends"
            style={{ color: "var(--po-green)", fontSize: 14, fontWeight: 500 }}
          >
            Find friends →
          </Link>
        </div>
      )}

      {events !== null && events.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0.75rem 1rem 1.5rem" }}>
          {events.map(event => (
            <FeedEventCard
              key={event.id}
              event={event}
              viewerId={userId}
              viewerCollectsSet={collectedSetIds.has(event.related_set_id)}
            />
          ))}
        </div>
      )}
    </MSShell>
  );
}
