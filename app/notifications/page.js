// HIDDEN FOR LAUNCH: grand_master_completion notification type deliberately
// disabled in this file. Any existing GM notification rows in the DB will
// render with default styling. See handover for re-enable steps.
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, UserPlus, UserCheck, ArrowLeftRight,
  CheckCircle2, XCircle, Camera, Award, Crown,
  Heart, MessageCircle, MailPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

const TYPE_ICON = {
  friend_request:           { Icon: UserPlus,        color: "var(--ms-dim)" },
  friend_accepted:          { Icon: UserCheck,        color: "var(--ms-dim)" },
  // Tappable row → '/messages?tab=requests'; accept/decline lives in the inbox section.
  message_request:          { Icon: MailPlus,         color: "var(--ms-dim)" },
  trade_proposal:           { Icon: ArrowLeftRight,   color: "var(--ms-dim)" },
  trade_accepted:           { Icon: CheckCircle2,     color: "var(--ms-dim)" },
  trade_declined:           { Icon: XCircle,          color: "var(--ms-dim)" },
  trade_verification:       { Icon: Camera,           color: "var(--ms-dim)" },
  master_completion:        { Icon: Award,            color: "var(--ms-dim)" },
  feed_like:                { Icon: Heart,            color: "var(--ms-dim)" },
  feed_comment:             { Icon: MessageCircle,    color: "var(--ms-dim)" },
  // HIDDEN FOR LAUNCH: grand_master_completion: { Icon: Crown, color: "var(--ms-gold)" },
};

function formatTs(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${Math.max(0, diffMin)}M AGO`;
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 24) return `${diffH}H AGO`;
  const diffD = Math.floor(diffMs / 86400000);
  if (diffD < 7) return `${diffD}D AGO`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [resolvedRequests, setResolvedRequests] = useState({});
  // Set of sender handles whose friend request is STILL pending in the DB.
  // Authoritative across page navigations — avoids buttons reappearing on reload.
  const [pendingSenderHandles, setPendingSenderHandles] = useState(new Set());
  const markAllTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifications(data || []);
      setLoading(false);

      // Determine which friend_request notifications still have a pending friendship.
      // Querying the live DB state means buttons persist-gone across page navigations.
      const frHandles = [
        ...new Set(
          (data || [])
            .filter((n) => n.type === "friend_request" && n.link?.startsWith("/friend/"))
            .map((n) => n.link.split("/").pop())
            .filter(Boolean)
        ),
      ];
      if (frHandles.length > 0) {
        const { data: senderProfiles } = await supabase
          .from("profiles")
          .select("id, handle")
          .in("handle", frHandles);
        if (senderProfiles?.length) {
          const senderIds = senderProfiles.map((p) => p.id);
          const { data: pendingFriendships } = await supabase
            .from("friendships")
            .select("user_a")
            .eq("user_b", user.id)
            .eq("status", "pending")
            .in("user_a", senderIds);
          const pendingIds = new Set((pendingFriendships || []).map((f) => f.user_a));
          const profileById = Object.fromEntries(senderProfiles.map((p) => [p.id, p.handle]));
          setPendingSenderHandles(
            new Set(senderIds.filter((id) => pendingIds.has(id)).map((id) => profileById[id]))
          );
        }
      }

      const unread = (data || []).filter((n) => !n.read).map((n) => n.id);
      if (unread.length > 0) {
        markAllTimerRef.current = setTimeout(async () => {
          await supabase.from("notifications").update({ read: true }).in("id", unread);
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }, 1000);
      }
    })();

    return () => clearTimeout(markAllTimerRef.current);
  }, [router, supabase]);

  const handleTap = async (notif) => {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.link) router.push(notif.link);
  };

  const acceptRequest = async (notif) => {
    const handle = notif.link?.startsWith("/friend/") ? notif.link.split("/").pop() : null;
    if (!handle) return;
    const { data: sender } = await supabase.from("profiles").select("id").eq("handle", handle).maybeSingle();
    if (!sender) return;
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_a", sender.id)
      .eq("user_b", user.id)
      .eq("status", "pending");
    const { data: acceptorProfile } = await supabase
      .from("profiles")
      .select("display_name, handle")
      .eq("id", user.id)
      .maybeSingle();
    const acceptorName = acceptorProfile?.display_name || `@${acceptorProfile?.handle}` || "Someone";
    if (acceptorProfile?.handle) {
      await supabase.from("notifications").insert({
        user_id: sender.id,
        type: "friend_accepted",
        title: "Friend request accepted",
        body: `${acceptorName} accepted your friend request.`,
        link: `/friend/${acceptorProfile.handle}`,
      });
    }
    await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
    setResolvedRequests((prev) => ({ ...prev, [notif.id]: "accepted" }));
    setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    if (handle) setPendingSenderHandles((prev) => { const next = new Set(prev); next.delete(handle); return next; });
  };

  const declineRequest = async (notif) => {
    const handle = notif.link?.startsWith("/friend/") ? notif.link.split("/").pop() : null;
    if (!handle) return;
    const { data: sender } = await supabase.from("profiles").select("id").eq("handle", handle).maybeSingle();
    if (!sender) return;
    await supabase
      .from("friendships")
      .delete()
      .eq("user_a", sender.id)
      .eq("user_b", user.id);
    await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
    setResolvedRequests((prev) => ({ ...prev, [notif.id]: "declined" }));
    setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    if (handle) setPendingSenderHandles((prev) => { const next = new Set(prev); next.delete(handle); return next; });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const sub = unreadCount > 0 ? `${unreadCount} UNREAD` : "ALL CAUGHT UP";

  if (loading) {
    return (
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  return (
    <MSShell>
      <MSPageTitle sub={sub}>Notifications</MSPageTitle>

      {notifications.length === 0 ? (
        <div style={{
          padding: "80px 32px 0",
          textAlign: "center",
          fontFamily: '"IBM Plex Sans", sans-serif',
          fontSize: 15,
          color: "var(--ms-dim)",
          lineHeight: 1.6,
        }}>
          No notifications yet. Friend requests and trade activity will appear here.
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {notifications.map((notif, i) => {
            const { Icon, color } = TYPE_ICON[notif.type] || { Icon: Bell, color: "var(--ms-dim)" };
            const senderHandle = notif.type === "friend_request" && notif.link?.startsWith("/friend/")
              ? notif.link.split("/").pop()
              : null;
            const isFriendRequest = !!senderHandle;
            const isPending = senderHandle ? pendingSenderHandles.has(senderHandle) : false;
            const resolved = resolvedRequests[notif.id];
            const borderBottom = i < notifications.length - 1 ? "1px solid var(--ms-rule-soft)" : "none";

            // friend_request rows: split into tappable content area + action row
            if (isFriendRequest) {
              return (
                <div
                  key={notif.id}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    background: notif.read ? "transparent" : "rgba(200,255,74,0.03)",
                    borderBottom,
                    position: "relative",
                  }}
                >
                  {!notif.read && (
                    <span aria-hidden="true" style={{
                      position: "absolute",
                      top: 0, left: 0, bottom: 0,
                      width: 2,
                      background: "var(--ms-accent)",
                    }} />
                  )}

                  {/* Tappable content row — navigates to sender's preview profile */}
                  <div
                    onClick={() => handleTap(notif)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "inline-flex", color, flexShrink: 0, marginTop: 1 }}>
                      <Icon size={22} strokeWidth={2} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: '"IBM Plex Sans", sans-serif',
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--ms-ink)",
                        marginBottom: 2,
                      }}>
                        {notif.title}
                      </div>
                      {notif.body && (
                        <div style={{
                          fontFamily: '"IBM Plex Sans", sans-serif',
                          fontWeight: 400,
                          fontSize: 13,
                          color: "var(--ms-dim)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {notif.body}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: 10,
                      color: "var(--ms-faint)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      flexShrink: 0,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                    }}>
                      {formatTs(notif.created_at)}
                    </span>
                  </div>

                  {/* Action row — Accept/Decline (pending), resolved feedback, or nothing */}
                  {(resolved || isPending) && (
                    <div style={{ marginTop: 10, paddingLeft: 36 }}>
                      {resolved ? (
                        <div style={{
                          fontSize: 13,
                          fontFamily: '"IBM Plex Sans", sans-serif',
                          color: resolved === "accepted" ? "var(--ms-accent)" : "var(--ms-dim)",
                        }}>
                          {resolved === "accepted" ? "Accepted ✓" : "Declined"}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => acceptRequest(notif)}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              background: "var(--ms-accent)",
                              color: "black",
                              border: "none",
                              borderRadius: 8,
                              fontFamily: '"IBM Plex Sans", sans-serif',
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => declineRequest(notif)}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              background: "transparent",
                              color: "var(--ms-dim)",
                              border: "0.5px solid var(--ms-rule)",
                              borderRadius: 8,
                              fontFamily: '"IBM Plex Sans", sans-serif',
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // All other notification types — original single-button row
            return (
              <button
                key={notif.id}
                onClick={() => handleTap(notif)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 16px",
                  background: notif.read ? "transparent" : "rgba(200,255,74,0.03)",
                  border: "none",
                  borderBottom,
                  textAlign: "left",
                  cursor: notif.link ? "pointer" : "default",
                  position: "relative",
                }}
              >
                {!notif.read && (
                  <span aria-hidden="true" style={{
                    position: "absolute",
                    top: 0, left: 0, bottom: 0,
                    width: 2,
                    background: "var(--ms-accent)",
                  }} />
                )}

                <span style={{ display: "inline-flex", color, flexShrink: 0, marginTop: 1 }}>
                  <Icon size={22} strokeWidth={2} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: '"IBM Plex Sans", sans-serif',
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--ms-ink)",
                    marginBottom: 2,
                  }}>
                    {notif.title}
                  </div>
                  {notif.body && (
                    <div style={{
                      fontFamily: '"IBM Plex Sans", sans-serif',
                      fontWeight: 400,
                      fontSize: 13,
                      color: "var(--ms-dim)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {notif.body}
                    </div>
                  )}
                </div>

                <span style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 10,
                  color: "var(--ms-faint)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}>
                  {formatTs(notif.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </MSShell>
  );
}
