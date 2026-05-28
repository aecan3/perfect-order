"use client";

import { useState, useEffect } from "react";
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
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [stats, setStats] = useState({ sets: 0, cards: 0, duplicates: 0 });
  const [favourites, setFavourites] = useState([]);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [mutualCount, setMutualCount] = useState(0);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ── Gate 1: auth ──────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      const viewerId = user.id;
      setCurrentUserId(viewerId);

      // ── Gate 2: profile lookup ────────────────────────────────────
      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!friendProfile) { setStatus("not-found"); return; }

      // ── Gate 3: is_blocked RPC (safety gate — must not be removed) ─
      const { data: blocked } = await supabase.rpc("is_blocked", {
        viewer: viewerId,
        target: friendProfile.id,
      });
      if (blocked) { setStatus("not-found"); return; }

      setFriend(friendProfile);

      // ── Gate 4: friendship check ──────────────────────────────────
      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_a.eq.${viewerId},user_b.eq.${friendProfile.id}),and(user_a.eq.${friendProfile.id},user_b.eq.${viewerId})`)
        .eq("status", "accepted")
        .maybeSingle();

      if (!friendship) { setStatus("not-friends"); return; }
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

      // ── Parallel data fetches ─────────────────────────────────────
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
          .select("handle, avatar_url")
          .in("id", mutualIds.slice(0, 6));
        if (!cancelled) mutualFriendsData = mutualProfs || [];
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

      setStats({
        sets: (userSetsRows || []).length,
        cards: cardsCount || 0,
        duplicates: duplicatesData.length,
      });
      setFavourites(sortedFavs);
      setMutualFriends(mutualFriendsData);
      setMutualCount(mutualIds.length);
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
      setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [handle, router, supabase]);

  // ── Gate renders (unchanged) ──────────────────────────────────────
  if (status === "loading") {
    return (
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  if (status === "not-found") {
    return (
      <MSShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "0 16px", textAlign: "center" }}>
          <p className="text-[var(--po-text)] mb-3">No user with handle @{handle}.</p>
          <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Back to friends</Link>
        </div>
      </MSShell>
    );
  }

  if (status === "not-friends") {
    return (
      <MSShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "0 16px", textAlign: "center" }}>
          <p className="text-[var(--po-text)] mb-3">You're not friends with @{handle} yet.</p>
          <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Send them a request</Link>
        </div>
      </MSShell>
    );
  }

  // ── ok: build slots then render ───────────────────────────────────
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

  const footer = (
    <>
      {/* ── Mutual friends ─────────────────────────────────────── */}
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
        {mutualFriends.length === 0 ? (
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
        )}
      </div>

      {/* ── Collection (set list — existing rich row rendering) ─── */}
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
        {friendSets.length === 0 ? (
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
              return (
                <Link
                  key={set.id}
                  href={`/friend/${handle}/${set.id}`}
                  className="block rounded-2xl overflow-hidden border border-[var(--po-border)] active:scale-[0.99] transition-transform"
                  style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
                >
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
      <MSShell>
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
