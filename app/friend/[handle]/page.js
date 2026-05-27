"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Flag, ShieldOff, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import { Avatar } from "@/components/Avatar";
import { selectMasterPrintings, fetchMasterPrintingCounts } from "@/lib/queries/printings";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
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

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/welcome");
        return;
      }
      setCurrentUserId(user.id);

      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!friendProfile) {
        setStatus("not-found");
        return;
      }

      const { data: blocked } = await supabase.rpc("is_blocked", { viewer: user.id, target: friendProfile.id });
      if (blocked) {
        setStatus("not-found");
        return;
      }

      setFriend(friendProfile);

      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_a.eq.${user.id},user_b.eq.${friendProfile.id}),and(user_a.eq.${friendProfile.id},user_b.eq.${user.id})`)
        .eq("status", "accepted")
        .maybeSingle();

      if (!friendship) {
        setStatus("not-friends");
        return;
      }

      // Paginated fetch — loops with .range() until a page returns fewer
      // rows than PAGE, guaranteeing all entries are returned regardless of
      // collection size.
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

      const [{ data: userSetsRows }, entries] = await Promise.all([
        supabase
          .from("user_sets")
          .select("set_id, added_at")
          .eq("user_id", friendProfile.id)
          .order("added_at", { ascending: false }),
        fetchAllEntries(friendProfile.id),
      ]);

      const setIds = (userSetsRows || []).map((r) => r.set_id).filter(Boolean);
      const [{ data: setsData }, masterCountBySet] = setIds.length > 0
        ? await Promise.all([
            supabase
              .from("sets")
              .select("id, code, name, series, logo_url, theme_primary, theme_secondary, theme_bg")
              .in("id", setIds),
            fetchMasterPrintingCounts(supabase),
          ])
        : [{ data: [] }, new Map()];

      const setById = Object.fromEntries((setsData || []).map((s) => [s.id, s]));

      const countMap = {}, vals = {};
      (entries || []).forEach((e) => {
        countMap[e.set_id] = (countMap[e.set_id] || 0) + 1;
        vals[e.set_id] = (vals[e.set_id] || 0) + (e.printing?.price_usd || 0);
      });

      setFriendSets(
        (userSetsRows || [])
          .map((row) => {
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
  }, [handle, router, supabase]);

  if (status === "loading") {
    return (
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>Loading…</div>
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

  const overflowItems = [
    {
      icon: Flag,
      label: "Report user",
      onClick: () => setReportFormOpen(true),
    },
    {
      icon: ShieldOff,
      label: "Block user",
      destructive: true,
      onClick: () => setBlockModalOpen(true),
    },
  ];

  return (
    <>
    <MSShell>
      <div style={{ position: "relative" }}>
        <MSPageTitle sub={`@${friend.handle}`}>{friend.display_name || friend.handle}</MSPageTitle>
        {currentUserId && currentUserId !== friend.id && (
          <div style={{ position: "absolute", top: 10, right: 12 }}>
            <OverflowMenu targetHandle={friend.handle} items={overflowItems} />
          </div>
        )}
      </div>

      <div className="px-4 pt-4 pb-0 max-w-md mx-auto">
        <div className="flex items-center gap-4 pb-4 mb-1" style={{ borderBottom: "1px solid var(--po-border)" }}>
          <BackButton />
          <Avatar profile={friend} size={56} />
          <div className="min-w-0">
            <div className="font-black text-lg leading-tight truncate text-[var(--po-text)]">
              {friend.display_name || friend.handle}
            </div>
            <div className="text-sm text-[var(--po-text-dim)] truncate mt-0.5">@{friend.handle}</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-0 max-w-md mx-auto">
        <Link
          href={`/friend/${handle}/favourites`}
          className="flex items-center gap-3 py-3 rounded-xl px-2 -mx-2 hover:bg-[var(--po-bg-soft)] active:bg-[var(--po-border)] transition-colors"
          style={{ borderBottom: "1px solid var(--po-border)" }}
        >
          <span style={{ fontSize: 16, color: "#FFB830", lineHeight: 1 }}>★</span>
          <span className="flex-1 font-bold text-sm text-[var(--po-text)]">Favourites</span>
          <ChevronRight size={16} className="text-[var(--po-text-dim)] flex-shrink-0" />
        </Link>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
        {friendSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            {friend.handle} hasn't added any sets yet.
          </div>
        ) : (
          friendSets.map((set) => {
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
          })
        )}
      </div>
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
