"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Users, LogOut, EyeOff, Eye, Trash2,
  MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

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

const fmtMoneyBig = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  return `${sym}${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Compact diff for inline trend: "↑44" or "↓2.5"
const formatDiff = (diffUsd, currency) => {
  const v = Math.abs(diffUsd) * (RATES[currency]?.rate || 1);
  return v >= 10 ? v.toFixed(0) : v.toFixed(1);
};

const daysSince = (ts) =>
  Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);

const pricesLabel = (ts) => {
  if (!ts) return null;
  const d = daysSince(ts);
  if (d === 0) return "Updated today";
  if (d === 1) return "Updated 1 day ago";
  return `Updated ${d} days ago`;
};

const isStale = (ts) => ts && daysSince(ts) > 7;

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

  // Swipe / menu state
  const [swipeState, setSwipeState] = useState({});
  const [menuState, setMenuState] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const touchStartRef = useRef({});
  const slidingRefs = useRef({});

  // Price refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState("");
  const [refreshProgressPct, setRefreshProgressPct] = useState(0);
  const refreshTimerRef = useRef(null);

  // Trend state: { [setId]: { dir: "up"|"down", diff: number (USD) } }
  const [trends, setTrends] = useState({});
  const [portfolioTrend, setPortfolioTrend] = useState(null); // { diff (USD), pct }
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [totalFlash, setTotalFlash] = useState(false);

  // Animation state
  const [displayValues, setDisplayValues] = useState({});
  const rafRef = useRef(null);
  const animTargetsRef = useRef({});

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(profileData);

      const [{ data: sets }, { data: entries }] = await Promise.all([
        supabase
          .from("user_sets")
          .select(`
            added_at, hidden_at, prices_updated_at,
            set:sets (
              id, code, name, series, total, total_with_secrets,
              logo_url, theme_primary, theme_secondary, theme_bg,
              cards(count), printings(count)
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

      const counts = {}, vals = {};
      (entries || []).forEach((e) => {
        counts[e.set_id] = (counts[e.set_id] || 0) + 1;
        vals[e.set_id] = (vals[e.set_id] || 0) + (e.printing?.price_usd || 0);
      });

      const enriched = (sets || [])
        .filter((row) => row.set != null)
        .map((row) => ({
          ...row.set,
          checkedCount: counts[row.set.id] || 0,
          isHidden: row.hidden_at != null,
          pricesUpdatedAt: row.prices_updated_at,
        }));

      setUserSets(enriched.filter((s) => !s.isHidden));
      setHiddenSets(enriched.filter((s) => s.isHidden));
      setSetValues(vals);
      setLoading(false);
    })();
  }, [router, supabase]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // ── Animation ────────────────────────────────────────────────────────────
  const startAnimations = (targets) => {
    const now = performance.now();
    for (const [sid, { from, to }] of Object.entries(targets)) {
      animTargetsRef.current[sid] = { from, to, startTime: now, duration: 1200 };
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (ts) => {
      let hasActive = false;
      const updates = {};
      for (const [sid, anim] of Object.entries(animTargetsRef.current)) {
        const t = Math.min((ts - anim.startTime) / anim.duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        updates[sid] = anim.from + (anim.to - anim.from) * eased;
        if (t < 1) hasActive = true;
        else delete animTargetsRef.current[sid];
      }
      setDisplayValues((prev) => ({ ...prev, ...updates }));
      rafRef.current = hasActive ? requestAnimationFrame(tick) : null;
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // ── Price refresh ────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (refreshing || !user) return;

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setRefreshing(true);
    setRefreshDone(false);
    setPortfolioTrend(null);
    setRefreshProgressPct(0);

    const visible = userSets;
    const total = visible.length;
    if (total === 0) { setRefreshing(false); return; }

    let allPreviousTotal = 0;
    let allNewTotal = 0;
    const newTrendsMap = {};

    for (let i = 0; i < total; i++) {
      const set = visible[i];
      setRefreshProgress(`Updating ${set.name}… (${i + 1} of ${total})`);
      setRefreshProgressPct((i / total) * 100);

      try {
        const res = await fetch("/api/refresh-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setIds: [set.id] }),
        });
        const data = await res.json();

        for (const r of (data.results || [])) {
          if (r.error) continue;
          const { setId, previousValue, newValue } = r;

          // Start this set's animation immediately (real-time count-up)
          const oldDisplay =
            animTargetsRef.current[setId]?.to ??
            displayValues[setId] ??
            setValues[setId] ??
            0;
          if (Math.abs(newValue - oldDisplay) > 0.005) {
            startAnimations({ [setId]: { from: oldDisplay, to: newValue } });
          }
          setSetValues((prev) => ({ ...prev, [setId]: newValue }));

          const prev = previousValue ?? 0;
          const diff = newValue - prev;
          if (Math.abs(diff) > 0.005) {
            newTrendsMap[setId] = { dir: diff > 0 ? "up" : "down", diff: Math.abs(diff) };
          }
          allPreviousTotal += prev;
          allNewTotal += newValue;
        }
      } catch {
        // silent per-set failure — continue
      }

      setRefreshProgressPct(((i + 1) / total) * 100);
    }

    const now = new Date().toISOString();
    const refreshedIds = new Set(visible.map((s) => s.id));
    const stampUpdatedAt = (s) =>
      refreshedIds.has(s.id) ? { ...s, pricesUpdatedAt: now } : s;
    setUserSets((prev) => prev.map(stampUpdatedAt));
    setHiddenSets((prev) => prev.map(stampUpdatedAt));

    setTrends(newTrendsMap);
    setLastRefreshedAt(now);

    if (allPreviousTotal > 0.01) {
      const diff = allNewTotal - allPreviousTotal;
      setPortfolioTrend({ diff, pct: (diff / allPreviousTotal) * 100 });
    }

    // Brief flash on total value
    setTotalFlash(true);
    setTimeout(() => setTotalFlash(false), 600);

    setRefreshing(false);
    setRefreshProgress("");
    setRefreshProgressPct(100);
    setRefreshDone(true);
    refreshTimerRef.current = setTimeout(() => {
      setRefreshDone(false);
      setRefreshProgressPct(0);
    }, 3000);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const switchCurrency = (c) => { setCurrency(c); localStorage.setItem("po:currency", c); };
  const signOut = async () => { await supabase.auth.signOut(); router.replace("/login"); };
  const closeAllSwipes = () => setSwipeState({});

  const executeHide = async (setId) => {
    setConfirmAction(null); setSwipeState({});
    await supabase.from("user_sets")
      .update({ hidden_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("set_id", setId);
    const moving = userSets.find((s) => s.id === setId);
    if (moving) {
      setUserSets((prev) => prev.filter((s) => s.id !== setId));
      setHiddenSets((prev) => [{ ...moving, isHidden: true }, ...prev]);
    }
  };

  const executeRemove = async (setId) => {
    setConfirmAction(null); setSwipeState({});
    await supabase.from("user_sets").delete()
      .eq("user_id", user.id).eq("set_id", setId);
    setUserSets((prev) => prev.filter((s) => s.id !== setId));
  };

  const executeUnhide = async (setId) => {
    await supabase.from("user_sets")
      .update({ hidden_at: null })
      .eq("user_id", user.id).eq("set_id", setId);
    const moving = hiddenSets.find((s) => s.id === setId);
    if (moving) {
      setHiddenSets((prev) => prev.filter((s) => s.id !== setId));
      const { isHidden: _, ...setData } = moving;
      setUserSets((prev) => [setData, ...prev]);
    }
  };

  const snapEl = (el, open) => {
    if (!el) return;
    el.style.transition = "transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    el.style.transform = open ? "translateX(-160px)" : "translateX(0)";
  };

  const makeTouchHandlers = (setId) => ({
    onTouchStart(e) {
      touchStartRef.current[setId] = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        baseX: swipeState[setId] ? -160 : 0,
        isHorizontal: null,
      };
      const el = slidingRefs.current[setId];
      if (el) el.style.transition = "none";
    },
    onTouchMove(e) {
      const start = touchStartRef.current[setId];
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (start.isHorizontal === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4))
        start.isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (!start.isHorizontal) return;
      const newX = Math.max(-160, Math.min(20, start.baseX + dx));
      const el = slidingRefs.current[setId];
      if (el) el.style.transform = `translateX(${newX}px)`;
    },
    onTouchEnd(e) {
      const start = touchStartRef.current[setId];
      if (!start) return;
      delete touchStartRef.current[setId];
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const el = slidingRefs.current[setId];
      const isHoriz = start.isHorizontal || (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4);
      if (!isHoriz) {
        if (swipeState[setId]) { snapEl(el, false); setSwipeState((p) => ({ ...p, [setId]: false })); }
        else snapEl(el, false);
        return;
      }
      const shouldOpen = dx < -60 ? true : dx > 60 ? false : !!swipeState[setId];
      snapEl(el, shouldOpen);
      setSwipeState((p) => ({ ...p, [setId]: shouldOpen }));
    },
    onTouchCancel() {
      delete touchStartRef.current[setId];
      const el = slidingRefs.current[setId];
      snapEl(el, !!swipeState[setId]);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  // ── Computed portfolio values ─────────────────────────────────────────────
  const allSets = [...userSets, ...hiddenSets];
  const totalUsd = allSets.reduce(
    (s, set) => s + (displayValues[set.id] ?? setValues[set.id] ?? 0),
    0
  );
  const bannerTotal = totalUsd * (RATES[currency]?.rate || 1);

  // Freshest pricesUpdatedAt across all sets (shown before user refreshes in session)
  const portfolioUpdatedAt =
    lastRefreshedAt ||
    allSets.reduce((latest, s) => {
      if (!s.pricesUpdatedAt) return latest;
      if (!latest) return s.pricesUpdatedAt;
      return new Date(s.pricesUpdatedAt) > new Date(latest) ? s.pricesUpdatedAt : latest;
    }, null);

  const renderSetCard = (set) => {
    const total = set.printings?.[0]?.count || set.cards?.[0]?.count || 0;
    const pct = total > 0 ? Math.round((set.checkedCount / total) * 100) : 0;
    const primary = set.theme_primary || "#b9ff3c";
    const secondary = set.theme_secondary || "#c084fc";
    const bg = set.theme_bg || "#0a0e0a";

    const dispUsd = displayValues[set.id] ?? (setValues[set.id] || 0);
    const val = dispUsd * (RATES[currency]?.rate || 1);
    const trend = trends[set.id];

    const touch = makeTouchHandlers(set.id);

    return (
      <div
        key={set.id}
        className="group relative rounded-2xl overflow-hidden border border-[var(--po-border)]"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
      >
        {/* Desktop ··· menu */}
        <div
          className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuState((p) => ({ ...p, [set.id]: !p[set.id] }))}
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

        {/* Sliding track */}
        <div
          ref={(el) => { slidingRefs.current[set.id] = el; }}
          className="relative"
          style={{
            transform: swipeState[set.id] ? "translateX(-160px)" : "translateX(0)",
            transition: "transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            touchAction: "pan-y",
          }}
          {...touch}
        >
          <Link
            href={`/set/${set.id}`}
            className="block"
            onClick={(e) => {
              if (swipeState[set.id]) {
                e.preventDefault();
                setSwipeState((p) => ({ ...p, [set.id]: false }));
                snapEl(slidingRefs.current[set.id], false);
              }
            }}
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
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tabular-nums">{set.checkedCount}</span>
                    <span className="text-xs text-[var(--po-text-dim)]">/ {total} · {pct}%</span>
                  </div>
                  {val > 0 && (
                    <div className="flex items-center gap-1 text-xs tabular-nums flex-shrink-0">
                      <span className="font-bold" style={{ color: primary }}>
                        {fmtMoney(val, currency)}
                      </span>
                      {trend && (
                        <span
                          className={`font-bold ${trend.dir === "up" ? "text-green-400" : "text-red-400"}`}
                        >
                          {trend.dir === "up" ? "↑" : "↓"}{formatDiff(trend.diff, currency)}
                        </span>
                      )}
                    </div>
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

          {/* Swipe action buttons — revealed by translateX(-160px) */}
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

  // ── Portfolio banner ──────────────────────────────────────────────────────
  const renderBanner = () => {
    const totalSets = allSets.length;
    const stale = isStale(portfolioUpdatedAt);
    const updatedLabel = pricesLabel(portfolioUpdatedAt);

    return (
      <div className="relative rounded-2xl overflow-hidden border border-[var(--po-border)] bg-[var(--po-bg-soft)]">
        {/* 2px shimmer accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 po-banner-shimmer" />

        <div className="px-4 pt-5 pb-4">
          {/* Label */}
          <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">
            Total Collection Value
          </div>

          {/* Big value */}
          <div
            className="mt-1 text-3xl font-black tabular-nums font-mono leading-none transition-colors duration-300"
            style={{ color: totalFlash ? "#ffffff" : "var(--po-green)" }}
          >
            {fmtMoneyBig(bannerTotal, currency)}
          </div>

          {/* Trend line — hidden until first refresh */}
          {portfolioTrend && (
            <div
              className={`mt-1.5 text-xs font-bold ${
                portfolioTrend.diff >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {portfolioTrend.diff >= 0 ? "↑" : "↓"}{" "}
              {fmtMoneyBig(
                Math.abs(portfolioTrend.diff) * (RATES[currency]?.rate || 1),
                currency
              )}
              {" · "}
              {portfolioTrend.diff >= 0 ? "+" : ""}
              {portfolioTrend.pct.toFixed(1)}% since last refresh
            </div>
          )}

          {/* Meta: set count + staleness */}
          <div
            className={`mt-1.5 flex items-center gap-1 text-[10px] ${
              stale ? "text-amber-400" : "text-[var(--po-text-dim)]"
            }`}
          >
            {stale && <Clock size={9} />}
            <span>
              Across {totalSets} set{totalSets !== 1 ? "s" : ""}
              {updatedLabel ? ` · ${updatedLabel}` : ""}
            </span>
          </div>
        </div>

        {/* Refresh button — becomes a progress bar during refresh */}
        <div className="relative mx-4 mb-4 h-10 overflow-hidden rounded-lg border border-[var(--po-border)]">
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${refreshProgressPct}%`,
              background: refreshDone
                ? "rgba(185,255,60,0.18)"
                : "rgba(185,255,60,0.12)",
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={refreshing}
            className="relative w-full h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
              color: refreshDone
                ? "var(--po-green)"
                : refreshing
                ? "var(--po-text)"
                : "var(--po-text-dim)",
            }}
          >
            {refreshDone ? (
              "✓ Prices updated"
            ) : refreshing ? (
              refreshProgress || "Refreshing…"
            ) : (
              <>
                <RefreshCw size={12} />
                Refresh Prices
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]"
      onClick={() => { closeAllSwipes(); setMenuState({}); }}
    >
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="po-wordmark text-2xl">My Sets</h1>
            <p className="text-[10px] text-[var(--po-text-dim)] mt-0.5">@{profile?.handle}</p>
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
            <Link href="/friends" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]" aria-label="Friends">
              <Users size={18} />
            </Link>
            <button onClick={signOut} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3 max-w-md mx-auto">
        {/* Portfolio banner — only shown when user has sets */}
        {allSets.length > 0 && renderBanner()}

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

        {/* Hidden sets section */}
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
                          <img src={set.logo_url} alt={set.name} className="w-12 h-12 object-contain flex-shrink-0" />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                            style={{ background: primary, color: bg }}
                          >
                            {set.code}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm leading-tight truncate" style={{ color: primary }}>
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

      {/* Confirm modal (Hide / Remove) */}
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
