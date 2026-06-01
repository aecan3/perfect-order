"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Layers } from "lucide-react";
import { MSHeader } from "./MSHeader";
import { MSTabBar } from "./MSTabBar";
import { createClient } from "@/lib/supabase";
import { useTableRefetch } from "@/lib/hooks/useTableRefetch";
import { getUserMarketplaceId } from "@/lib/marketplace/currency-to-marketplace";
import { fetchMarketplaceListings } from "@/lib/marketplace/client-fetch";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

function AnonymousTabBar() {
  return (
    <nav
      aria-label="Primary"
      style={{
        flexShrink: 0,
        height: "calc(64px + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: 16,
        paddingRight: 16,
        borderTop: "1px solid var(--ms-rule)",
        background: "var(--ms-bg)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Link
        href="/sets"
        style={{
          flex: 1,
          height: 64,
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          color: "var(--ms-dim)",
          textDecoration: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <Layers size={22} strokeWidth={2} />
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>Sets</span>
      </Link>
      <Link
        href="/welcome"
        style={{
          flex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 44,
          background: "var(--po-green)",
          color: "#050507",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
          letterSpacing: "0.04em",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Sign Up Free
      </Link>
    </nav>
  );
}
import { useRefreshPrices } from "@/app/RefreshPricesProvider";

function deriveTab(pathname) {
  if (!pathname) return null;
  if (pathname === "/" || pathname.startsWith("/sets") || pathname.startsWith("/set/")) return "sets";
  if (pathname.startsWith("/discover")) return "discover";
  if (pathname.startsWith("/feed")) return "feed";
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

export function MSShell({ activeTab: propActiveTab, unreadCount: propUnreadCount, hideTabBar = false, anonymousNav = false, children }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [fetchedUnreadCount, setFetchedUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [userId, setUserId] = useState(null);

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
      if (!userId) setUserId(user.id);
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setFetchedUnreadCount(count || 0);
    })();
    fetchUnreadMessages();
  }, [pathname, supabase, propUnreadCount]);

  useTableRefetch({
    supabase,
    table: "messages",
    events: ["INSERT"],
    filter: `recipient_id=eq.${userId}`,
    channelName: `unread-messages:${userId}`,
    onChange: fetchUnreadMessages,
    enabled: !!userId,
  });

  const {
    refreshing,
    refreshDone,
    refreshErrors,
    refreshProgress,
    recoveredFromReload,
    dismissErrors,
  } = useRefreshPrices();
  const router = useRouter();

  const onIndicatorTap = () => {
    if (pathname !== "/") router.push("/");
  };

  const indicatorVisible =
    refreshing ||
    refreshDone ||
    refreshErrors.length > 0 ||
    recoveredFromReload;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      fetchUnreadMessages();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const marketplaceId = getUserMarketplaceId();
      // Fire-and-forget — warm the client-side marketplace cache for upcoming
      // navigation to /discover. Route is a pure cached DB read; we discard
      // the response here since Discover's own useEffect will consume it.
      fetchMarketplaceListings(marketplaceId).catch(() => {});
    })();
    return () => { cancelled = true; };
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
      <MSHeader unreadCount={unreadCount} scrolled={scrolled} anonymous={anonymousNav} />
      {indicatorVisible && (
        <button
          type="button"
          onClick={onIndicatorTap}
          aria-label={
            refreshing
              ? "Refreshing prices, tap to view"
              : refreshDone
              ? "Prices updated"
              : refreshErrors.length > 0
              ? "Some sets failed to update"
              : "Prices may still be updating"
          }
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "6px 16px",
            background: refreshDone
              ? "rgba(200,255,74,0.12)"
              : refreshErrors.length > 0
              ? "rgba(251,191,36,0.10)"
              : recoveredFromReload
              ? "rgba(251,191,36,0.10)"
              : "rgba(200,255,74,0.08)",
            borderBottom: "1px solid var(--ms-rule, rgba(244,244,246,0.08))",
            color: refreshDone
              ? "var(--po-green)"
              : refreshErrors.length > 0 || recoveredFromReload
              ? "#fbbf24"
              : "var(--po-text)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: pathname !== "/" ? "pointer" : "default",
          }}
        >
          {refreshing ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                Updating prices
                {refreshProgress && refreshProgress.total > 1
                  ? ` — ${refreshProgress.done}/${refreshProgress.total}`
                  : ""}
                {refreshProgress?.name ? ` · ${refreshProgress.name}` : ""}
              </span>
            </>
          ) : refreshDone ? (
            <>
              <CheckCircle2 size={12} />
              <span>Prices updated</span>
            </>
          ) : refreshErrors.length > 0 ? (
            <>
              <AlertCircle size={12} />
              <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                {refreshErrors.length === 1
                  ? `${refreshErrors[0]} failed to update`
                  : `${refreshErrors.length} sets failed to update`}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  dismissErrors();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissErrors();
                  }
                }}
                style={{
                  marginLeft: 8,
                  color: "var(--po-text-dim)",
                  fontWeight: 400,
                }}
              >
                ✕
              </span>
            </>
          ) : recoveredFromReload ? (
            <>
              <AlertCircle size={12} />
              <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                Prices may still be updating — pull to refresh in a moment
              </span>
            </>
          ) : null}
        </button>
      )}
      <main
        data-scroll-container="true"
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehaviorY: "contain",
          minHeight: 0,
          paddingBottom: (hideTabBar && !anonymousNav) ? "env(safe-area-inset-bottom, 0px)" : undefined,
        }}
      >
        {children}
      </main>
      {anonymousNav ? (
        <AnonymousTabBar />
      ) : !hideTabBar ? (
        <MSTabBar active={resolvedTab} unreadMessages={unreadMessages} />
      ) : null}
    </div>
  );
}
