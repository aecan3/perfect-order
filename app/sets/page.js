"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Check, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SetBrowserPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [allSets, setAllSets] = useState([]);
  const [activeSetIds, setActiveSetIds] = useState(new Set());
  const [query, setQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const [{ data: sets }, { data: userSets }] = await Promise.all([
        supabase
          .from("sets")
          .select("id, code, name, series, total, total_with_secrets, release_date, logo_url, theme_primary, theme_secondary, theme_bg")
          .order("release_date", { ascending: false }),
        supabase.from("user_sets").select("set_id").eq("user_id", user.id),
      ]);

      setAllSets(sets || []);
      setActiveSetIds(new Set((userSets || []).map((r) => r.set_id)));
      setLoading(false);
    })();
  }, [router, supabase]);

  const seriesList = useMemo(() => {
    const s = new Set(allSets.map((x) => x.series).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [allSets]);

  const filteredSets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSets.filter((s) => {
      if (seriesFilter !== "all" && s.series !== seriesFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.series || "").toLowerCase().includes(q)
      );
    });
  }, [allSets, query, seriesFilter]);

  const addSet = async (setId) => {
    if (!user || activeSetIds.has(setId)) return;
    setAdding(setId);
    const { error } = await supabase
      .from("user_sets")
      .insert({ user_id: user.id, set_id: setId });
    if (error) {
      alert("Failed to add set: " + error.message);
      setAdding(null);
      return;
    }
    setActiveSetIds((prev) => new Set([...prev, setId]));
    setAdding(null);
    router.push(`/set/${setId}`);
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
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="po-wordmark text-xl">Add a Set</h1>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--po-text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg text-[var(--po-text)] placeholder-[var(--po-text-dim)] focus:outline-none focus:border-[var(--po-green)]"
          />
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {seriesList.map((s) => (
            <button
              key={s}
              onClick={() => setSeriesFilter(s)}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                seriesFilter === s
                  ? "bg-[var(--po-green)] text-black font-bold"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              }`}
            >
              {s === "all" ? "All series" : s}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-4 space-y-2 max-w-md mx-auto">
        {filteredSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            No sets match.
          </div>
        ) : (
          filteredSets.map((set) => {
            const total = set.total_with_secrets || set.total;
            const isActive = activeSetIds.has(set.id);
            const isAdding = adding === set.id;
            const primary = set.theme_primary || "#b9ff3c";
            const bg = set.theme_bg || "#0a0e0a";
            return (
              <div
                key={set.id}
                className="rounded-xl border border-[var(--po-border)] overflow-hidden flex items-center gap-3 p-3"
                style={{
                  background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)`,
                }}
              >
                {set.logo_url ? (
                  <img
                    src={set.logo_url}
                    alt={set.name}
                    className="w-14 h-14 object-contain flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={{ background: primary, color: bg }}
                  >
                    {set.code}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold text-sm leading-tight truncate"
                    style={{ color: primary }}
                  >
                    {set.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5 truncate">
                    {set.series || "—"} · {total} cards
                  </div>
                </div>
                {isActive ? (
                  <Link
                    href={`/set/${set.id}`}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold flex items-center gap-1"
                    style={{ background: primary, color: bg }}
                  >
                    <Check size={12} />
                    Open
                  </Link>
                ) : (
                  <button
                    onClick={() => addSet(set.id)}
                    disabled={isAdding}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] hover:border-[var(--po-green)] hover:text-[var(--po-green)] flex items-center gap-1 disabled:opacity-50"
                  >
                    {isAdding ? (
                      "..."
                    ) : (
                      <>
                        <Plus size={12} />
                        Add
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
