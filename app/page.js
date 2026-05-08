"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Users, LogOut, EyeOff, Eye, Trash2, MoreHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10) return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

export default function HomePage() {
  "use no memo";
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userSets, setUserSets] = useState([]);
  const [hiddenSets, setHiddenSets] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [setValues, setSetValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("AUD");
  const [swipeState, setSwipeState] = useState({});
  const [menuState, setMenuState] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const touchStartRef = useRef({});

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

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

      const [{ data: sets }, { data: entries }] = await Promise.all([
        supabase
          .from("user_sets")
          .select(`
            added_at, hidden_at,
            set:sets (
              id, code, name, series, total, total_with_secrets,
              logo_url, theme_primary, theme_secondary, theme_bg,
              cards(count)
            )
          `)
          .eq("user_id", user.id)
          .order("added_at", { ascending: false }),
        supabase
          .from("collection_entries")
          .select("set_id, card_number, checked, printing:printings(price_usd)")
          .eq("user_id", user.id)
          .eq("checked", true),
      ]);

      const counts = {};
      const vals = {};
      const seen = new Set();
      (entries || []).forEach((e) => {
        const key = `${e.set_id}::${e.card_number}`;
        if (!seen.has(key)) {
          seen.add(key);
          counts[e.set_id] = (counts[e.set_id] || 0) + 1;
        }
        vals[e.set_id] = (vals[e.set_id] || 0) + (e.printing?.price_usd || 0);
      });

      const enriched = (sets || [])
        .filter((row) => row.set != null)
        .map((row) => ({
          ...row.set,
          checkedCount: counts[row.set.id] || 0,
          isHidden: row.hidden_at != null,
        }));

      setUserSets(enriched.filter((s) => !s.isHidden));
      setHiddenSets(enriched.filter((s) => s.isHidden));
      setSetValues(vals);
      setLoading(false);
    })();
  }, [router, supabase]);

  const switchCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("po:currency", c);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const executeHide = async (setId) => {
    setConfirmAction(null);
    setSwipeState({});
    await supabase
      .from("user_sets")
      .update({ hidden_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("set_id", setId);
    const moving = userSets.find((s) => s.id === setId);
    if (moving) {
      setUserSets((prev) => prev.filter((s) => s.id !== setId));
      setHiddenSets((prev) => [{ ...moving, isHidden: true }, ...prev]);
    }
  };

  const executeRemove = async (setId) => {
    setConfirmAction(null);
    setSwipeState({});
    await supabase
      .from("user_sets")
      .delete()
      .eq("user_id", user.id)
      .eq("set_id", setId);
    setUserSets((prev) => prev.filter((s) => s.id !== setId));
  };

  const executeUnhide = async (setId) => {
    await supabase
      .from("user_sets")
      .update({ hidden_at: null })
      .eq("user_id", user.id)
      .eq("set_id", setId);
    const moving = hiddenSets.find((s) => s.id === setId);
    if (moving) {
      setHiddenSets((prev) => prev.filter((s) => s.id !== setId));
      const { isHidden: _, ...setData } = moving;
      setUserSets((prev) => [setData, ...prev]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  const renderSetCard = (set) => {
    const total = set.cards?.[0]?.count || 0;
    const pct = total > 0 ? Math.round((set.checkedCount / total) * 100) : 0;
    const primary = set.theme_primary || "#b9ff3c";
    const secondary = set.theme_secondary || "#c084fc";
    const bg = set.theme_bg || "#0a0e0a";
    const val = (setValues[set.id] || 0) * (RATES[currency]?.rate || 1);

    return (
      <div
        key={set.id}
        className="group relative rounded-2xl overflow-hidden border border-[var(--po-border)]"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
      >
        {/* Desktop ··· menu — outside the sliding track so it doesn't move */}
        <div
          className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuState((prev) => ({ ...prev, [set.id]: !prev[set.id] }))}
            className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80"
            aria-label="More options"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuState[set.id] && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg shadow-xl overflow-hidden min-w-[130px]">
              <button
                onClick={() => { setMenuState({}); setConfirmAction({ type: "hide", setId: set.id, setName: set.name }); }}
                className="w-full px-4 py-2.5 text-left text-sm text-amber-400 hover:bg-[var(--po-border)] flex items-center gap-2"
              >
                <EyeOff size={14} /> Hide
              </button>
              <button
                onClick={() => { setMenuState({}); setConfirmAction({ type: "remove", setId: set.id, setName: set.name }); }}
                className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-[var(--po-border)] flex items-center gap-2"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          )}
        </div>

        {/* Sliding inner — contains the card link; action buttons are anchored to its right edge
            via left-full so they start outside the overflow-hidden boundary and are
            only revealed when the track translates left. */}
        <div
          className="relative transition-transform duration-300 ease-out"
          style={{ transform: swipeState[set.id] ? "translateX(-160px)" : "translateX(0)" }}
          onTouchStart={(e) => { touchStartRef.current[set.id] = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const startX = touchStartRef.current[set.id];
            if (startX == null) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (dx < -60) setSwipeState((prev) => ({ ...prev, [set.id]: true }));
            else if (dx > 60) setSwipeState((prev) => ({ ...prev, [set.id]: false }));
            delete touchStartRef.current[set.id];
          }}
        >
          <Link
            href={`/set/${set.id}`}
            className="block"
            onClick={(e) => {
              if (swipeState[set.id]) {
                e.preventDefault();
                setSwipeState((prev) => ({ ...prev, [set.id]: false }));
              }
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
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tabular-nums">
                      {set.checkedCount}
                    </span>
                    <span className="text-xs text-[var(--po-text-dim)]">
                      / {total} · {pct}%
                    </span>
                  </div>
                  {val > 0 && (
                    <span className="text-xs tabular-nums font-bold" style={{ color: primary }}>
                      {fmtMoney(val, currency)}
                    </span>
                  )}
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

          {/* Action buttons — left-full positions them just past the card's right edge,
              hidden by the outer overflow-hidden until the track slides left */}
          <div className="absolute inset-y-0 left-full flex">
            <button
              onClick={() => setConfirmAction({ type: "hide", setId: set.id, setName: set.name })}
              className="w-20 bg-amber-600 hover:bg-amber-500 flex flex-col items-center justify-center gap-1 text-white"
            >
              <EyeOff size={16} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Hide</span>
            </button>
            <button
              onClick={() => setConfirmAction({ type: "remove", setId: set.id, setName: set.name })}
              className="w-20 bg-rose-700 hover:bg-rose-600 flex flex-col items-center justify-center gap-1 text-white"
            >
              <Trash2 size={16} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Remove</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]" onClick={() => setMenuState({})}>
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="po-wordmark text-2xl">My Sets</h1>
            <p className="text-[10px] text-[var(--po-text-dim)] mt-0.5">
              @{profile?.handle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => switchCurrency(e.target.value)}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] px-2 py-1 border border-[var(--po-border)] rounded bg-[var(--po-bg)] cursor-pointer"
            >
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
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

        {userSets.length === 0 && hiddenSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            No sets yet — tap above to start collecting.
          </div>
        ) : (
          userSets.map((set) => renderSetCard(set))
        )}

        {hiddenSets.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="w-full flex items-center justify-between px-1 py-2 text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
            >
              <span className="text-xs uppercase tracking-widest font-bold">
                Hidden Sets ({hiddenSets.length})
              </span>
              {showHidden ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showHidden && (
              <div className="space-y-2 mt-1">
                {hiddenSets.map((set) => {
                  const primary = set.theme_primary || "#b9ff3c";
                  const bg = set.theme_bg || "#0a0e0a";
                  return (
                    <div
                      key={set.id}
                      className="rounded-2xl overflow-hidden border border-[var(--po-border)] opacity-50"
                      style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
                    >
                      <div className="p-3 flex items-center gap-3">
                        {set.logo_url ? (
                          <img
                            src={set.logo_url}
                            alt={set.name}
                            className="w-12 h-12 object-contain flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
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
                          {set.series && (
                            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5 truncate">
                              {set.series}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => executeUnhide(set.id)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--po-border)] text-[var(--po-text-dim)] hover:text-[var(--po-text)] text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                          <Eye size={12} />
                          Unhide
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {confirmAction && (
        <div
          className="fixed inset-0 z-30 bg-black/80 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-2xl w-full max-w-sm p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={`text-base font-bold mb-2 ${confirmAction.type === "remove" ? "text-rose-300" : "text-amber-300"}`}>
              {confirmAction.type === "hide" ? "Hide set?" : "Remove set?"}
            </h2>
            <p className="text-sm text-[var(--po-text-dim)] mb-4">
              {confirmAction.type === "hide" ? (
                <>Hide <strong className="text-[var(--po-text)]">{confirmAction.setName}</strong> from your list? Your collection data is preserved.</>
              ) : (
                <>Remove <strong className="text-[var(--po-text)]">{confirmAction.setName}</strong> from your list? Your collection data is preserved.</>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-sm font-bold text-[var(--po-text)]"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmAction.type === "hide" ? executeHide(confirmAction.setId) : executeRemove(confirmAction.setId)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold text-white ${confirmAction.type === "hide" ? "bg-amber-600" : "bg-rose-700"}`}
              >
                {confirmAction.type === "hide" ? "Hide it" : "Remove it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
