"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Users, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userSets, setUserSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(profileData);

      const { data: sets } = await supabase
        .from("user_sets")
        .select(`
          added_at,
          set:sets (
            id, code, name, series, total, total_with_secrets,
            logo_url, theme_primary, theme_secondary, theme_bg
          )
        `)
        .eq("user_id", user.id)
        .order("added_at", { ascending: false });

      const { data: entries } = await supabase
        .from("collection_entries")
        .select("set_id, checked")
        .eq("user_id", user.id)
        .eq("checked", true);

      const counts = {};
      (entries || []).forEach((e) => {
        counts[e.set_id] = (counts[e.set_id] || 0) + 1;
      });

      const enriched = (sets || []).map((row) => ({
        ...row.set,
        checkedCount: counts[row.set.id] || 0,
      }));
      setUserSets(enriched);
      setLoading(false);
    })();
  }, [router, supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="po-wordmark text-2xl">My Sets</h1>
            <p className="text-[10px] text-[var(--po-text-dim)] mt-0.5">
              @{profile?.handle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/friends"
              className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
              aria-label="Friends"
            >
              <Users size={18} />
            </Link>
            <button
              onClick={signOut}
              className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3 max-w-md mx-auto">
        <Link
          href="/sets"
          className="block w-full bg-[var(--po-bg-soft)] border-2 border-dashed border-[var(--po-border)] hover:border-[var(--po-green)] hover:text-[var(--po-green)] rounded-2xl py-6 text-center font-bold uppercase tracking-widest text-sm text-[var(--po-text-dim)] transition-colors"
        >
          <Plus size={20} className="inline mr-1 -mt-1" />
          Add a set
        </Link>

        {userSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            No sets yet — tap above to start collecting.
          </div>
        ) : (
          userSets.map((set) => {
            const total = set.total_with_secrets || set.total;
            const pct = total > 0 ? Math.round((set.checkedCount / total) * 100) : 0;
            const primary = set.theme_primary || "#b9ff3c";
            const secondary = set.theme_secondary || "#c084fc";
            const bg = set.theme_bg || "#0a0e0a";
            return (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="block rounded-2xl overflow-hidden border border-[var(--po-border)] active:scale-[0.99] transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)`,
                }}
              >
                <div className="p-4 flex items-center gap-3">
                  {set.logo_url ? (
                    <img
                      src={set.logo_url}
                      alt={set.name}
                      className="w-20 h-20 object-contain flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-lg flex items-center justify-center font-black text-2xl flex-shrink-0"
                      style={{ background: primary, color: bg }}
                    >
                      {set.code}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-extrabold text-base leading-tight truncate"
                      style={{ color: primary }}
                    >
                      {set.name}
                    </div>
                    {set.series && (
                      <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5 truncate">
                        {set.series}
                      </div>
                    )}
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black tabular-nums">
                        {set.checkedCount}
                      </span>
                      <span className="text-xs text-[var(--po-text-dim)]">
                        / {total} · {pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-1 w-full bg-[var(--po-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${primary}, ${secondary})`,
                        }}
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
