"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function FriendOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const handle = params.handle;

  const [friend, setFriend] = useState(null);
  const [friendSets, setFriendSets] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!friendProfile) {
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

      const [{ data: sets }, { data: entries }] = await Promise.all([
        supabase
          .from("user_sets")
          .select(`added_at, set:sets (id, code, name, series, logo_url, theme_primary, theme_secondary, theme_bg, cards(count))`)
          .eq("user_id", friendProfile.id)
          .order("added_at", { ascending: false }),
        supabase
          .from("collection_entries")
          .select("set_id, card_number, checked")
          .eq("user_id", friendProfile.id)
          .eq("checked", true),
      ]);

      const countMap = {};
      const seen = new Set();
      (entries || []).forEach((e) => {
        const key = `${e.set_id}::${e.card_number}`;
        if (seen.has(key)) return;
        seen.add(key);
        countMap[e.set_id] = (countMap[e.set_id] || 0) + 1;
      });

      setFriendSets((sets || []).map((row) => ({ ...row.set, checkedCount: countMap[row.set.id] || 0 })));
      setCounts(countMap);
      setStatus("ok");
    })();
  }, [handle, router, supabase]);

  if (status === "loading") {
    return <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">Loading…</div>;
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--po-text)] mb-3">No user with handle @{handle}.</p>
        <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Back to friends</Link>
      </div>
    );
  }

  if (status === "not-friends") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--po-text)] mb-3">You're not friends with @{handle} yet.</p>
        <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Send them a request</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/friends" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-none">{friend.display_name || friend.handle}</h1>
            <p className="text-[10px] text-[var(--po-text-dim)]">@{friend.handle}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3 max-w-md mx-auto">
        {friendSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            {friend.handle} hasn't added any sets yet.
          </div>
        ) : (
          friendSets.map((set) => {
            const total = set.cards?.[0]?.count || 0;
            const pct = total > 0 ? Math.round((set.checkedCount / total) * 100) : 0;
            const primary = set.theme_primary || "#b9ff3c";
            const secondary = set.theme_secondary || "#c084fc";
            const bg = set.theme_bg || "#0a0e0a";
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
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black tabular-nums">{set.checkedCount}</span>
                      <span className="text-xs text-[var(--po-text-dim)]">/ {total} · {pct}%</span>
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
      </main>
    </div>
  );
}
