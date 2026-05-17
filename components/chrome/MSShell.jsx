"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MSHeader } from "./MSHeader";
import { MSTabBar } from "./MSTabBar";
import { createClient } from "@/lib/supabase";

function deriveTab(pathname) {
  if (!pathname) return null;
  if (pathname === "/" || pathname.startsWith("/set") || pathname.startsWith("/sets")) return "sets";
  if (pathname.startsWith("/discover")) return "discover";
  if (pathname.startsWith("/messages")) return "messages";
  if (
    pathname === "/you" ||
    pathname.startsWith("/you/") ||
    pathname.startsWith("/settings") ||
    pathname === "/friends" ||
    pathname.startsWith("/friends/") ||
    pathname === "/friend" ||
    pathname.startsWith("/friend/")
  ) return "you";
  return null;
}

export function MSShell({ activeTab: propActiveTab, unreadCount: propUnreadCount, hideTabBar = false, children }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [fetchedUnreadCount, setFetchedUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const messagesChannelRef = useRef(null);

  const resolvedTab = propActiveTab !== undefined ? propActiveTab : deriveTab(pathname);
  const unreadCount = propUnreadCount !== undefined ? propUnreadCount : fetchedUnreadCount;

  const fetchUnreadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rows } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("recipient_id", user.id)
      .eq("read", false)
      .eq("message_type", "message");
    const uniqueSenders = new Set((rows || []).map((r) => r.sender_id));
    setUnreadMessages(uniqueSenders.size);
  };

  useEffect(() => {
    if (propUnreadCount !== undefined) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setFetchedUnreadCount(count || 0);
    })();
    fetchUnreadMessages();
  }, [pathname, supabase, propUnreadCount]);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const channel = supabase
        .channel(`unread-messages:${user.id}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        }, () => fetchUnreadMessages())
        .subscribe();
      messagesChannelRef.current = channel;
      cleanup = () => supabase.removeChannel(channel);
    })();
    return () => cleanup();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      fetchUnreadMessages();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const onScroll = (e) => {
    setScrolled(e.currentTarget.scrollTop > 0);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--ms-bg)",
        color: "var(--ms-ink)",
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      }}
    >
      <MSHeader unreadCount={unreadCount} scrolled={scrolled} />
      <main
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          paddingBottom: hideTabBar ? "env(safe-area-inset-bottom, 0px)" : undefined,
        }}
      >
        {children}
      </main>
      {!hideTabBar && <MSTabBar active={resolvedTab} unreadMessages={unreadMessages} />}
    </div>
  );
}
