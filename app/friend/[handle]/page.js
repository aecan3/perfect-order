"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Flag, ShieldOff, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import { Avatar } from "@/components/Avatar";
import { fetchMasterPrintingCounts } from "@/lib/queries/printings";
import { fetchUserDuplicates } from "@/lib/queries/duplicates";
import { MSShell } from "@/components/chrome/MSShell";
import { ProfileView } from "@/components/profile/ProfileView";
import { OverflowMenu } from "@/components/OverflowMenu";
import { ReportUserForm } from "@/components/ReportUserForm";
import { BlockConfirmModal } from "@/components/BlockConfirmModal";
import * as Sentry from "@sentry/nextjs";
import { RATES } from "@/lib/currency";
import { track, EVENTS } from "@/lib/track";

const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

export default function FriendOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const handle = params.handle;

  const [friend, setFriend] = useState(null);
  const [friendSets, setFriendSets] = useState([]);
  const [currency, setCurrency] = useState("AUD");
  const [status, setStatus] = useState("loading");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [stats, setStats] = useState({ sets: 0, cards: 0, duplicates: 0 });
  const [favourites, setFavourites] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [mutualCount, setMutualCount] = useState(0);
  const [mutualNames, setMutualNames] = useState([]);
  const [remainingMutuals, setRemainingMutuals] = useState(0);
  const [isFriend, setIsFriend] = useState(false);
  const [isPendingFromMe, setIsPendingFromMe] = useState(false);
  const [isPendingFromThem, setIsPendingFromThem] = useState(false);
  const [localPendingFromMe, setLocalPendingFromMe] = useState(false);
  const [publicHuntingCount, setPublicHuntingCount] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [friendWantLists, setFriendWantLists] = useState([]);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  // Fetch real counts from service-role endpoint when in preview mode.
  // RLS blocks non-friends from reading collection data directly, so the
  // main useEffect produces zeros. This overrides those zeros with real counts.
  useEffect(() => {
    if (status !== "ok") return;
    if (isFriend || isPendingFromMe || localPendingFromMe) return;
    (async () => {
      try {
        const res = await fetch(`/api/profile/${handle}/public-stats`);
        if (!res.ok) return;
        const { stats: publicStats, hunting_count, mutual_count } = await res.json();
        setStats(publicStats);
        setMutualCount(mutual_count);
        setPublicHuntingCount(hunting_count);
      } catch (e) {
        Sentry.captureMessage("[friend/public-stats] fetch failed", {
          level: "error",
          extra: { handle, error: e?.message },
        });
      }
    })();
  }, [status, isFriend, isPendingFromMe, localPendingFromMe, handle]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ── Gate 1: auth ──────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled) setAuthResolved(true);

      if (!user) {
        // Anonymous path — fetch public profile only; skip blocked check + friendship queries
        const { data: friendProfile } = await supabase.from("profiles")
          .select("*").eq("handle", handle).maybeSingle();
        if (!friendProfile) { setStatus("not-found"); return; }
        if (cancelled) return;
        setFriend(friendProfile);
        setStatus("ok");
        return;
      }

      const viewerId = user.id;
      setCurrentUserId(viewerId);

      // ── Gate 2: profile lookup + viewer's own profile ─────────────
      const [{ data: friendProfile }, { data: viewerProfile }] = await Promise.all([
        supabase.from("profiles").select("*").eq("handle", handle).maybeSingle(),
        supabase.from("profiles").select("handle, display_name").eq("id", viewerId).maybeSingle(),
      ]);

      if (!friendProfile) { setStatus("not-found"); return; }

      // ── Gate 3: is_blocked RPC (safety gate — must not be removed) ─
      const { data: blocked } = await supabase.rpc("is_blocked", {
        viewer: viewerId,
        target: friendProfile.id,
      });
      if (blocked) { setStatus("not-found"); return; }

      setFriend(friendProfile);
      setCurrentUserProfile(viewerProfile);

      // ── Gate 4: friendship row (any status) ───────────────────────
      // No .eq("status", "accepted") — we need pending rows too for preview mode.
      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_a.eq.${viewerId},user_b.eq.${friendProfile.id}),and(user_a.eq.${friendProfile.id},user_b.eq.${viewerId})`)
        .maybeSingle();

      const friendshipAccepted = friendship?.status === "accepted";
      const friendshipPendingFromMe = friendship?.status === "pending" && friendship?.user_a === viewerId;
      const friendshipPendingFromThem = friendship?.status === "pending" && friendship?.user_b === viewerId;

      if (cancelled) return;

      // ── Paginated collection entries (handles large collections) ──
      const fetchAllEntries = async (userId) => {
        const PAGE = 1000;
        const rows = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("collection_entries")
            .select("set_id, printing:printings!inner(price_usd)")
            .eq("printing.collection_tier", "master")
            .eq("user_id", userId)
            .eq("checked", true)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          rows.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return rows;
      };

      // ── Parallel data fetches (runs for all visitors, enables preview) ──
      const [
        { data: userSetsRows },
        entries,
        { count: cardsCount },
        duplicatesData,
        { data: favData },
        { data: viewerFriendships },
        { data: targetFriendships },
      ] = await Promise.all([
        supabase
          .from("user_sets")
          .select("set_id, added_at")
          .eq("user_id", friendProfile.id)
          .order("added_at", { ascending: false }),
        fetchAllEntries(friendProfile.id),
        supabase
          .from("collection_entries")
          .select("printing:printings!inner(collection_tier)", { count: "exact", head: true })
          .eq("user_id", friendProfile.id)
          .eq("checked", true)
          .eq("printing.collection_tier", "master"),
        fetchUserDuplicates(supabase, friendProfile.id, viewerId),
        supabase
          .from("favourites")
          .select("printing_id, printing:printings!inner(price_usd, card:cards!printings_card_id_fkey(name, image_large))")
          .eq("user_id", friendProfile.id)
          .limit(50),
        supabase
          .from("friendships")
          .select("user_a, user_b")
          .or(`user_a.eq.${viewerId},user_b.eq.${viewerId}`)
          .eq("status", "accepted"),
        supabase
          .from("friendships")
          .select("user_a, user_b")
          .or(`user_a.eq.${friendProfile.id},user_b.eq.${friendProfile.id}`)
          .eq("status", "accepted"),
      ]);

      if (cancelled) return;

      // ── Sets: metadata + master counts ───────────────────────────
      const setIds = (userSetsRows || []).map(r => r.set_id).filter(Boolean);
      const [{ data: setsData }, masterCountBySet] = setIds.length > 0
        ? await Promise.all([
            supabase
              .from("sets")
              .select("id, code, name, series, logo_url, theme_primary, theme_secondary, theme_bg")
              .in("id", setIds),
            fetchMasterPrintingCounts(supabase),
          ])
        : [{ data: [] }, new Map()];

      if (cancelled) return;

      // ── Mutual friends: intersection + profiles ───────────────────
      const viewerFriendIds = new Set(
        (viewerFriendships || []).map(f => f.user_a === viewerId ? f.user_b : f.user_a)
      );
      const mutualIds = (targetFriendships || [])
        .map(f => f.user_a === friendProfile.id ? f.user_b : f.user_a)
        .filter(id => viewerFriendIds.has(id));

      let mutualFriendsData = [];
      if (mutualIds.length > 0) {
        const { data: mutualProfs } = await supabase
          .from("profiles")
          .select("handle, display_name, avatar_url")
          .in("id", mutualIds.slice(0, 6));
        if (!cancelled) mutualFriendsData = mutualProfs || [];
      }

      if (cancelled) return;

      // ── Friend want lists (friends-only, RPC enforces access) ─────
      let wantListsData = [];
      if (friendshipAccepted && viewerId) {
        const { data: wlData } = await supabase.rpc("get_friend_want_lists", {
          target: friendProfile.id,
        });
        if (!cancelled) wantListsData = wlData || [];
      }

      if (cancelled) return;

      // ── Derive final state ────────────────────────────────────────
      const sortedFavs = [...(favData || [])]
        .sort((a, b) => (Number(b.printing?.price_usd) || 0) - (Number(a.printing?.price_usd) || 0))
        .slice(0, 6);

      const setById = Object.fromEntries((setsData || []).map(s => [s.id, s]));
      const countMap = {}, vals = {};
      (entries || []).forEach(e => {
        countMap[e.set_id] = (countMap[e.set_id] || 0) + 1;
        vals[e.set_id] = (vals[e.set_id] || 0) + (e.printing?.price_usd || 0);
      });

      // Mutual names for preview-mode text (first 3)
      const names = mutualFriendsData.slice(0, 3).map(p => p.display_name || p.handle);
      const remaining = mutualIds.length - names.length;

      setIsFriend(friendshipAccepted);
      setIsPendingFromMe(friendshipPendingFromMe);
      setIsPendingFromThem(friendshipPendingFromThem);
      setStats({
        sets: (userSetsRows || []).length,
        cards: cardsCount || 0,
        duplicates: duplicatesData.length,
      });
      setFavourites(sortedFavs);
      setMutualFriends(mutualFriendsData);
      setMutualCount(mutualIds.length);
      setMutualNames(names);
      setRemainingMutuals(remaining);
      setFriendSets(
        (userSetsRows || [])
          .map(row => {
            const s = setById[row.set_id];
            if (!s) return null;
            return {
              ...s,
              checkedCount: countMap[s.id] || 0,
              collectionValue: vals[s.id] || 0,
              masterPrintingCount: masterCountBySet.get(s.id) || 0,
            };
          })
          .filter(Boolean)
      );
      setFriendWantLists(wantListsData);
      setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [handle, router, supabase]);

  // friend_link_viewed — fire once, on resolution (status === "ok"), so
  // viewer_is_friend reflects the settled friendship rather than the mount-time
  // default. Ref-guarded against the effect re-running on later state updates.
  const friendLinkFiredRef = useRef(false);
  useEffect(() => {
    if (friendLinkFiredRef.current) return;
    if (status !== "ok") return;
    friendLinkFiredRef.current = true;
    track(EVENTS.FRIEND_LINK_VIEWED, { handle, viewer_is_friend: isFriend });
  }, [status, isFriend, handle]);

  const isAnonymous = !currentUserId;

  // ── Gate renders ──────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  if (status === "not-found") {
    return (
      <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "0 16px", textAlign: "center" }}>
          <p className="text-[var(--po-text)] mb-3">No user with handle @{handle}.</p>
          <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Back to friends</Link>
        </div>
      </MSShell>
    );
  }

  // ── ok: build slots then render ───────────────────────────────────
  const showPending = isPendingFromMe || localPendingFromMe;
  const isPreview = !isFriend && !showPending;

  const overflowItems = [
    { icon: Flag, label: "Report user", onClick: () => setReportFormOpen(true) },
    { icon: ShieldOff, label: "Block user", destructive: true, onClick: () => setBlockModalOpen(true) },
  ];

  const headerAction = currentUserId && currentUserId !== friend.id
    ? (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href={`/messages/${handle}`}
          aria-label="Message"
          style={{ color: "var(--po-text-dim)", display: "flex", alignItems: "center" }}
        >
          <MessageCircle size={20} />
        </Link>
        <OverflowMenu targetHandle={friend.handle} items={overflowItems} />
      </div>
    )
    : null;

  const afterStats = (isPreview || showPending) ? (
    <div style={{ marginBottom: 16 }}>
      {isPreview && mutualCount > 0 && (
        <div style={{ fontSize: 12, color: "var(--po-text-dim)", marginBottom: 10 }}>
          {mutualCount} mutual {mutualCount === 1 ? "friend" : "friends"}
        </div>
      )}
      {isPreview && !isPendingFromThem && !isAnonymous && (
        <button
          type="button"
          onClick={async () => {
            const { error: insErr } = await supabase
              .from("friendships")
              .insert({ user_a: currentUserId, user_b: friend.id, status: "pending" });
            if (insErr) { console.error("Failed to send friend request:", insErr.message); return; }
            const senderName = currentUserProfile?.display_name || `@${currentUserProfile?.handle}` || "Someone";
            await supabase.from("notifications").insert({
              user_id: friend.id,
              type: "friend_request",
              title: "New friend request",
              body: `${senderName} sent you a friend request.`,
              link: currentUserProfile?.handle
                ? `/friend/${currentUserProfile.handle}`
                : "/friends",
            });
            setLocalPendingFromMe(true);
          }}
          className="w-full px-4 py-3 bg-[var(--po-green)] text-black font-bold rounded-lg po-glow-green"
        >
          Add @{friend.handle} as a friend
        </button>
      )}
      {isPreview && isAnonymous && (
        <Link
          href={`/welcome?returnTo=/friend/${friend.handle}`}
          className="block w-full px-4 py-3 bg-[var(--po-green)] text-black font-bold rounded-lg po-glow-green text-center"
        >
          Sign in to view profile
        </Link>
      )}
      {isPendingFromThem && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={async () => {
              const { error } = await supabase
                .from("friendships")
                .update({ status: "accepted" })
                .eq("user_a", friend.id)
                .eq("user_b", currentUserId);
              if (error) { console.error("Failed to accept friend request:", error.message); return; }
              const acceptorName = currentUserProfile?.display_name || `@${currentUserProfile?.handle}` || "Someone";
              if (currentUserProfile?.handle) {
                await supabase.from("notifications").insert({
                  user_id: friend.id,
                  type: "friend_accepted",
                  title: "Friend request accepted",
                  body: `${acceptorName} accepted your friend request.`,
                  link: `/friend/${currentUserProfile.handle}`,
                });
              }
              window.location.reload();
            }}
            style={{
              flex: 1,
              padding: "12px",
              background: "var(--po-green)",
              color: "black",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={async () => {
              const { error } = await supabase
                .from("friendships")
                .delete()
                .eq("user_a", friend.id)
                .eq("user_b", currentUserId);
              if (error) { console.error("Failed to decline friend request:", error.message); return; }
              router.push("/friends");
            }}
            style={{
              flex: 1,
              padding: "12px",
              background: "var(--po-bg-soft)",
              color: "var(--po-text-dim)",
              border: "0.5px solid var(--po-border)",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Decline
          </button>
        </div>
      )}
      {showPending && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(244,244,246,0.04)",
          border: "0.5px solid rgba(244,244,246,0.08)",
          borderRadius: 10,
          textAlign: "center",
          fontSize: 13,
          color: "var(--po-text-dim)",
        }}>
          Request sent · awaiting response
        </div>
      )}
    </div>
  ) : null;

  const footer = (
    <>
      {/* ── Mutual friends ─────────────────────────────────────── */}
      {/* In preview: hidden when 0, count-only text when >0 (names require
          service-role queries that belong in the endpoint, not client-side) */}
      {(!isPreview || mutualCount > 0) && (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--po-text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Mutual Friends
          </span>
        </div>
        {isPreview ? (
          // Preview: count only — names not surfaced (friendships are friend-readable only)
          <div style={{ fontSize: 13, color: "var(--po-text-dim)", padding: "4px 0" }}>
            {mutualCount} mutual {mutualCount === 1 ? "friend" : "friends"}
          </div>
        ) : (
          // Friends: avatar face-pile
          mutualFriends.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--po-text-faint)", padding: "4px 0" }}>
              No mutual friends.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center" }}>
              {mutualFriends.map((f, i) => (
                <div
                  key={f.handle ?? i}
                  style={{
                    marginLeft: i === 0 ? 0 : -10,
                    position: "relative",
                    zIndex: mutualFriends.length - i,
                    borderRadius: "50%",
                    border: "2px solid var(--po-bg)",
                    lineHeight: 0,
                    flexShrink: 0,
                  }}
                >
                  <Avatar profile={f} size={38} />
                </div>
              ))}
              {mutualCount > 6 && (
                <div style={{
                  marginLeft: -10,
                  width: 38, height: 38,
                  borderRadius: "50%",
                  background: "rgba(244,244,246,0.1)",
                  border: "2px solid var(--po-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  color: "var(--po-text-dim)",
                  position: "relative",
                  zIndex: 0,
                  flexShrink: 0,
                }}>
                  +{mutualCount - 6}
                </div>
              )}
            </div>
          )
        )}
      </div>
      )} {/* end (!isPreview || mutualCount > 0) */}

      {/* ── Want Lists (friends-only) ──────────────────────────── */}
      {friendWantLists.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--po-text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Want Lists
          </div>
          {friendWantLists.map(list => {
            const dateStr = new Date(list.created_at).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            });
            return (
              <Link
                key={list.id}
                href={`/wants/${list.slug}`}
                style={{
                  display: "block", textDecoration: "none",
                  marginBottom: 8, padding: "12px 14px",
                  background: "rgba(244,244,246,0.03)",
                  border: "0.5px solid var(--po-border)",
                  borderRadius: "var(--border-radius-md)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--po-text)", marginBottom: 2 }}>
                  {list.title || `${list.card_count} card${list.card_count !== 1 ? "s" : ""}`}
                </div>
                <div style={{ fontSize: 11, color: "var(--po-text-faint)" }}>
                  {list.title
                    ? `${list.card_count} card${list.card_count !== 1 ? "s" : ""} · ${dateStr}`
                    : dateStr}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Collection (set list) ───────────────────────────────── */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: "var(--po-text-dim)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          Collection
        </div>
        {isPreview ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            🔒 @{friend.handle}&apos;s sets are visible only to their friends.
          </div>
        ) : friendSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            {friend.handle} hasn&apos;t added any sets yet.
          </div>
        ) : (
          <div className="space-y-3">
            {friendSets.map(set => {
              const total = set.masterPrintingCount || 0;
              const pct = total > 0 ? Math.round((set.checkedCount / total) * 100) : 0;
              const primary = set.theme_primary || "#b9ff3c";
              const secondary = set.theme_secondary || "#c084fc";
              const bg = set.theme_bg || "#050507";
              const val = (set.collectionValue || 0) * (RATES[currency]?.rate || 1);
              const inner = (
                <div className="p-4 flex items-center gap-3">
                  {set.logo_url ? (
                    <img src={set.logo_url} alt={set.name} className="w-20 h-20 object-contain flex-shrink-0" />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-lg flex items-center justify-center font-black text-2xl flex-shrink-0"
                      style={{ background: primary, color: bg }}
                    >
                      {set.code}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-base leading-tight truncate" style={{ color: primary }}>
                      {set.name}
                    </div>
                    {set.series && (
                      <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5 truncate">
                        {set.series}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black tabular-nums">{set.checkedCount}</span>
                        <span className="text-xs text-[var(--po-text-dim)]">/ {total} · {pct}%</span>
                      </div>
                      {val > 0 && (
                        <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: primary }}>
                          {fmtMoney(val, currency)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-1 w-full bg-[var(--po-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
                      />
                    </div>
                  </div>
                </div>
              );
              return isPreview ? (
                <div
                  key={set.id}
                  className="block rounded-2xl overflow-hidden border border-[var(--po-border)]"
                  style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
                >
                  {inner}
                </div>
              ) : (
                <Link
                  key={set.id}
                  href={`/friend/${handle}/${set.id}`}
                  className="ms-pressable block rounded-2xl overflow-hidden border border-[var(--po-border)]"
                  style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
        {/* BackButton above ProfileView */}
        <div style={{ padding: "8px 16px 0" }}>
          <BackButton />
        </div>
        <ProfileView
          isOwnProfile={false}
          handle={friend.handle}
          profile={friend}
          stats={stats}
          favourites={favourites}
          headerAction={headerAction}
          footer={footer}
          isPreview={isPreview}
          afterStats={afterStats}
          publicHuntingCount={publicHuntingCount}
        />
      </MSShell>
      <ReportUserForm
        isOpen={reportFormOpen}
        onClose={() => setReportFormOpen(false)}
        reportedUserId={friend.id}
        reportedUserHandle={friend.handle}
        context="profile"
        onBlockRequested={() => setBlockModalOpen(true)}
      />
      <BlockConfirmModal
        mode="block"
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        targetHandle={friend.handle}
        targetUserId={friend.id}
        onSuccess={() => router.push("/friends")}
      />
    </>
  );
}
