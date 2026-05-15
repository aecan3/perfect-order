"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, EyeOff, Eye, Trash2,
  MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, Clock, MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { fetchMasterPrintingCounts } from "@/lib/queries/printings";
import { getFriendIds } from "@/lib/queries/friends";
import { getDiscoverMatches } from "@/lib/queries/discover";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

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
  const [refreshErrors, setRefreshErrors] = useState([]);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const refreshTimerRef = useRef(null);

  // Trend state: { [setId]: { dir: "up"|"down", diff: number (USD) } }
  const [trends, setTrends] = useState({});
  const [portfolioTrend, setPortfolioTrend] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [totalFlash, setTotalFlash] = useState(false);

  // Animation state
  const [displayValues, setDisplayValues] = useState({});
  const rafRef = useRef(null);
  const animTargetsRef = useRef({});

  // Discover panel
  const [discoverCards, setDiscoverCards] = useState(null);
  const [discoverModal, setDiscoverModal] = useState(null);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(profileData);

      // Paginated fetch for collection_entries — loops with .range() until
      // a page returns fewer rows than PAGE, guaranteeing every row is
      // included regardless of collection size.
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

      // Step 1: user_sets metadata + all checked entries in parallel.
      const [{ data: userSetsRows }, entries] = await Promise.all([
        supabase
          .from("user_sets")
          .select("set_id, added_at, hidden_at, prices_updated_at")
          .eq("user_id", user.id)
          .order("added_at", { ascending: false }),
        fetchAllEntries(user.id),
      ]);

      // Step 2: fetch set details at the top level.
      const setIds = (userSetsRows || []).map((r) => r.set_id).filter(Boolean);
      const [{ data: setsData }, masterCountBySet] = setIds.length > 0
        ? await Promise.all([
            supabase
              .from("sets")
              .select("id, code, name, series, total, total_with_secrets, logo_url, theme_primary, theme_secondary, theme_bg, cards(count)")
              .in("id", setIds),
            fetchMasterPrintingCounts(supabase),
          ])
        : [{ data: [] }, new Map()];

      const setById = Object.fromEntries((setsData || []).map((s) => [s.id, s]));

      const counts = {}, vals = {};
      (entries || []).forEach((e) => {
        counts[e.set_id] = (counts[e.set_id] || 0) + 1;
        vals[e.set_id] = (vals[e.set_id] || 0) + (e.printing?.price_usd || 0);
      });

      const enriched = (userSetsRows || [])
        .map((row) => {
          const s = setById[row.set_id];
          if (!s) return null;
          return {
            ...s,
            checkedCount: counts[s.id] || 0,
            masterPrintingCount: masterCountBySet.get(s.id) || 0,
            isHidden: row.hidden_at != null,
            pricesUpdatedAt: row.prices_updated_at,
          };
        })
        .filter(Boolean);

      const initDisplay = {};
      enriched.forEach((s) => { initDisplay[s.id] = 0; });

      setUserSets(enriched.filter((s) => !s.isHidden));
      setHiddenSets(enriched.filter((s) => s.isHidden));
      setSetValues(vals);
      setDisplayValues(initDisplay);
      setLoading(false);

      // Non-blocking discover fetch — runs after main load so it doesn't delay the page
      (async () => {
        try {
          const friendIds = await getFriendIds(supabase, user.id);
          if (!friendIds.length) { setDiscoverCards([]); return; }
          const results = await getDiscoverMatches({ supabase, viewerUserId: user.id, friendIds });
          setDiscoverCards(results.slice(0, 20));
        } catch {
          setDiscoverCards([]);
        }
      })();

      // Staggered count-up from zero — fires on every page load / navigate-back
      const loadTargets = {};
      enriched.forEach((set, i) => {
        const target = vals[set.id] || 0;
        if (target > 0) loadTargets[set.id] = { from: 0, to: target, delay: i * 100, duration: 1500 };
      });
      if (Object.keys(loadTargets).length > 0) startAnimations(loadTargets);
    })();
  }, [router, supabase]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // ── Animation ────────────────────────────────────────────────────────────
  const startAnimations = (targets) => {
    const now = performance.now();
    for (const [sid, { from, to, delay = 0, duration = 1200 }] of Object.entries(targets)) {
      animTargetsRef.current[sid] = { from, to, startTime: now + delay, duration };
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (ts) => {
      let hasActive = false;
      const updates = {};
      for (const [sid, anim] of Object.entries(animTargetsRef.current)) {
        if (ts < anim.startTime) {
          updates[sid] = anim.from;
          hasActive = true;
          continue;
        }
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

  // ── Price refresh ─────────────────────────────────────────────────────────
  const handleRefresh = () => {
    if (refreshing || !user) return;

    const visible = userSets;
    if (visible.length === 0) return;

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setRefreshing(true);
    setRefreshDone(false);
    setRefreshErrors([]);
    setPortfolioTrend(null);
    setRefreshProgress({ done: 0, total: visible.length, name: "" });

    const acc = { done: 0, allPrev: 0, allNew: 0, newValues: {}, newTrends: {}, errors: [] };

    const promises = visible.map((set) =>
      fetch("/api/refresh-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setIds: [set.id] }),
      })
        .then((res) => res.json())
        .then((data) => {
          const r = data.results?.[0];
          acc.done++;
          setRefreshProgress({ done: acc.done, total: visible.length, name: set.name });

          if (r && !r.error) {
            const { setId, previousValue, newValue } = r;
            acc.newValues[setId] = newValue;
            const oldDisplay =
              animTargetsRef.current[setId]?.to ??
              displayValues[setId] ??
              setValues[setId] ??
              0;
            if (Math.abs(newValue - oldDisplay) > 0.005) {
              startAnimations({ [setId]: { from: oldDisplay, to: newValue } });
            }
            const prev = previousValue ?? 0;
            const diff = newValue - prev;
            if (Math.abs(diff) > 0.005) {
              acc.newTrends[setId] = { dir: diff > 0 ? "up" : "down", diff: Math.abs(diff) };
            }
            acc.allPrev += prev;
            acc.allNew += newValue;
          } else {
            acc.errors.push(set.name);
          }
        })
        .catch(() => {
          acc.done++;
          acc.errors.push(set.name);
          setRefreshProgress({ done: acc.done, total: visible.length, name: set.name });
        })
    );

    Promise.all(promises).then(() => {
      setSetValues((prev) => ({ ...prev, ...acc.newValues }));
      setTrends(acc.newTrends);

      const now = new Date().toISOString();
      const refreshedIds = new Set(visible.map((s) => s.id));
      const stampUpdatedAt = (s) => refreshedIds.has(s.id) ? { ...s, pricesUpdatedAt: now } : s;
      setUserSets((prev) => prev.map(stampUpdatedAt));
      setHiddenSets((prev) => prev.map(stampUpdatedAt));
      setLastRefreshedAt(now);

      if (acc.allPrev > 0.01) {
        const diff = acc.allNew - acc.allPrev;
        setPortfolioTrend({ diff, pct: (diff / acc.allPrev) * 100 });
      }

      setTotalFlash(true);
      setTimeout(() => setTotalFlash(false), 600);

      if (acc.errors.length) setRefreshErrors(acc.errors);
      setRefreshProgress(null);
      setRefreshing(false);
      setRefreshDone(true);
      refreshTimerRef.current = setTimeout(() => setRefreshDone(false), 3000);
    }).catch(() => {
      setRefreshErrors(["Network error — prices not updated"]);
      setRefreshProgress(null);
      setRefreshing(false);
    });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const switchCurrency = (c) => { setCurrency(c); localStorage.setItem("po:currency", c); };
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
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading...
        </div>
      </MSShell>
    );
  }

  // ── Computed portfolio values ─────────────────────────────────────────────
  const allSets = [...userSets, ...hiddenSets];
  const totalUsd = allSets.reduce(
    (s, set) => s + (displayValues[set.id] ?? setValues[set.id] ?? 0),
    0
  );
  const bannerTotal = totalUsd * (RATES[currency]?.rate || 1);

  const portfolioUpdatedAt =
    lastRefreshedAt ||
    allSets.reduce((latest, s) => {
      if (!s.pricesUpdatedAt) return latest;
      if (!latest) return s.pricesUpdatedAt;
      return new Date(s.pricesUpdatedAt) > new Date(latest) ? s.pricesUpdatedAt : latest;
    }, null);

  const renderSetCard = (set) => {
    const printingCount = set.masterPrintingCount || 0;
    const total = printingCount > 0 ? printingCount : (Number(set.cards?.[0]?.count) || 0);
    const pct = total > 0 ? Math.round((set.checkedCount / total) * 100) : 0;
    const isMaster = total > 0 && set.checkedCount >= total;
    const primary = set.theme_primary || "#b9ff3c";
    const secondary = set.theme_secondary || "#c084fc";
    const bg = set.theme_bg || "#050507";

    const dispUsd = displayValues[set.id] ?? (setValues[set.id] || 0);
    const val = dispUsd * (RATES[currency]?.rate || 1);
    const trend = trends[set.id];

    const touch = makeTouchHandlers(set.id);

    const cardContent = (
      <div
        className="relative rounded-[16px] overflow-hidden"
        style={{
          background: isMaster
            ? `radial-gradient(ellipse at 0% 55%, ${primary}28 0%, transparent 58%), linear-gradient(135deg, ${bg} 0%, #050507 100%)`
            : `linear-gradient(135deg, ${bg} 0%, #050507 100%)`,
        }}
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
                    <span className="text-xs text-[var(--po-text-dim)]">
                      / {total}{!isMaster && ` · ${pct}%`}
                    </span>
                  </div>
                  {val > 0 && (
                    <div className="flex items-center gap-1 text-xs tabular-nums flex-shrink-0">
                      <span className="font-bold" style={{ color: primary }}>
                        {fmtMoney(val, currency)}
                      </span>
                      {trend && (
                        <span className={`font-bold ${trend.dir === "up" ? "text-green-400" : "text-red-400"}`}>
                          {trend.dir === "up" ? "↑" : "↓"}{formatDiff(trend.diff, currency)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isMaster ? (
                  <div
                    className="mt-2.5 w-full flex items-center justify-center gap-2 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.14em] leading-none"
                    style={{
                      color: primary,
                      background: `${primary}1a`,
                      border: `1px solid ${primary}55`,
                      boxShadow: `0 0 12px ${primary}30, inset 0 0 8px ${primary}10`,
                    }}
                  >
                    <span className="po-master-star">&#10022;</span>
                    Master Set
                    <span className="po-master-star po-master-star-b">&#10022;</span>
                  </div>
                ) : (
                  <div className="mt-2.5 w-full rounded-full overflow-hidden" style={{ height: 4, background: "var(--po-progress-track)" }}>
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${primary}, ${secondary})`,
                        boxShadow: `0 0 10px ${primary}80`,
                      }}
                    />
                  </div>
                )}
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

    if (isMaster) {
      return (
        <div
          key={set.id}
          className="group po-master-border-wrap rounded-[18px]"
          style={{
            "--glow-a":      primary,
            "--glow-a-soft": `${primary}55`,
            "--glow-a-faint":`${primary}1a`,
            "--glow-b":      secondary,
            "--glow-b-soft": `${secondary}55`,
            "--glow-b-faint":`${secondary}1a`,
          }}
        >
          {cardContent}
        </div>
      );
    }

    return (
      <div
        key={set.id}
        className="group relative rounded-2xl overflow-hidden border border-[var(--po-border)]"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, #050507 100%)` }}
      >
        {cardContent}
      </div>
    );
  };

  // ── Discover panel ────────────────────────────────────────────────────────
  const renderDiscoverPanel = () => {
    if (!discoverCards || discoverCards.length === 0) return null;

    return (
      <div className="rounded-2xl overflow-hidden border border-[var(--po-border)] bg-[var(--po-bg-soft)]">
        <Link href="/discover" className="flex items-center gap-2 px-4 pt-3 pb-2">
          <span
            className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "var(--po-green)", color: "#050507" }}
          >
            NEW
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--po-text-dim)] flex-1 truncate">
            Discover &mdash; {discoverCards.length} cards your friends have
          </span>
          <ChevronRight size={14} className="text-[var(--po-text-faint)] flex-shrink-0" />
        </Link>
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-3"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {discoverCards.map((card, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setDiscoverModal(card); }}
              className="flex-none relative rounded-lg overflow-hidden bg-black/40 text-left"
              style={{ width: "calc(33.333% - 6px)", scrollSnapAlign: "start", aspectRatio: "2/3" }}
            >
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-1 text-center text-[8px] text-[var(--po-text-faint)] leading-tight">
                  {card.cardName || card.setName}
                </div>
              )}
              <div
                className="absolute inset-x-0 bottom-0 px-1.5 py-1 flex items-end justify-between gap-1"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)" }}
              >
                <span className="text-[8px] text-white/75 font-bold truncate min-w-0">@{card.friendHandle}</span>
                {card.priceUsd > 0 && (
                  <span className="text-[8px] font-black flex-shrink-0" style={{ color: "var(--po-green)" }}>
                    {fmtMoney(card.priceUsd * (RATES[currency]?.rate || 1), currency)}
                  </span>
                )}
              </div>
            </button>
          ))}
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
      <div className="relative rounded-2xl overflow-hidden border border-[var(--po-border-strong)]"
           style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", borderTop: "1px solid rgba(200,255,74,0.35)" }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
             style={{ background: "conic-gradient(from 220deg at 30% 0%, rgba(200,255,74,0.06), rgba(215,107,255,0.06), rgba(95,182,255,0.06), rgba(200,255,74,0.06))", opacity: 0.8 }} />

        <div className="relative px-5 pt-5 pb-4">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold flex items-center gap-2" style={{ color: "var(--po-text-faint)" }}>
            Total Collection Value
            {refreshing && (
              <span className="flex items-center gap-1" style={{ color: "var(--po-green)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="text-[9px] normal-case tracking-normal">
                  {refreshProgress && refreshProgress.total > 1
                    ? `${refreshProgress.done}/${refreshProgress.total}`
                    : "Updating"}
                </span>
              </span>
            )}
          </div>

          <div
            className="mt-2.5 text-4xl font-black tabular-nums leading-none transition-colors duration-300"
            style={{ color: totalFlash ? "#ffffff" : "var(--po-green)", letterSpacing: "-0.02em", textShadow: `0 0 24px rgba(200,255,74,0.4)` }}
          >
            {fmtMoneyBig(bannerTotal, currency)}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--po-text-dim)" }}>
            <span>Across {totalSets} set{totalSets !== 1 ? "s" : ""}</span>
            {updatedLabel && <><span style={{ color: "var(--po-text-faint)" }}>·</span><span className={stale ? "text-amber-400" : ""}>{stale && <Clock size={9} className="inline mr-0.5 -mt-0.5" />}{updatedLabel}</span></>}
          </div>

          {portfolioTrend && (
            <div
              className={`mt-1 text-xs font-bold ${
                portfolioTrend.diff >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {portfolioTrend.diff >= 0 ? "▲" : "▼"}{" "}
              {fmtMoneyBig(
                Math.abs(portfolioTrend.diff) * (RATES[currency]?.rate || 1),
                currency
              )}
              {" "}
              {portfolioTrend.diff >= 0 ? "+" : ""}
              {portfolioTrend.pct.toFixed(1)}% since last refresh
            </div>
          )}

          <div
            className={`hidden items-center gap-1 text-[10px] ${
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

        {refreshErrors.length > 0 && (
          <div className="mx-5 mb-2 flex items-center justify-between gap-2 text-[11px] text-amber-400">
            <span>⚠ {refreshErrors.length === 1 ? refreshErrors[0] : `${refreshErrors.length} sets`} failed to update</span>
            <button onClick={(e) => { e.stopPropagation(); setRefreshErrors([]); }} style={{ color: "var(--po-text-dim)" }}>✕</button>
          </div>
        )}
        <div className="relative mx-5 mb-5 h-10 overflow-hidden rounded-lg border border-[var(--po-border)]">
          {refreshDone && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(200,255,74,0.12)" }} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            className="relative w-full h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
              color: refreshDone ? "var(--po-green)" : refreshing ? "var(--po-text)" : "var(--po-text-dim)",
            }}
          >
            {refreshDone ? (
              <><RefreshCw size={12} /> ✓ Updated</>
            ) : refreshing ? (
              <>
                <RefreshCw size={12} className="animate-spin flex-shrink-0" />
                <span className="truncate normal-case">
                  {refreshProgress?.name || "Updating…"}
                </span>
                {refreshProgress && refreshProgress.total > 1 && (
                  <span className="flex-shrink-0 opacity-60">
                    ({refreshProgress.done}/{refreshProgress.total})
                  </span>
                )}
              </>
            ) : (
              <><RefreshCw size={12} /> Refresh Prices</>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <MSShell>
      <div onClick={() => { closeAllSwipes(); setMenuState({}); }}>
        <MSPageTitle sub={`@${profile?.handle || ""}`}>My Sets</MSPageTitle>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px 8px" }}>
          <select
            value={currency}
            onChange={(e) => switchCurrency(e.target.value)}
            className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] px-2 py-1 border border-[var(--po-border)] rounded bg-[var(--po-bg)] cursor-pointer"
          >
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        <div className="px-4 pb-4 space-y-3 max-w-md mx-auto">
          {allSets.length > 0 && renderBanner()}

          {renderDiscoverPanel()}

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
                    const bg = set.theme_bg || "#050507";
                    return (
                      <div
                        key={set.id}
                        className="rounded-2xl overflow-hidden border border-[var(--po-border)] opacity-50"
                        style={{ background: `linear-gradient(135deg, ${bg} 0%, #050507 100%)` }}
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
        </div>

        {/* Discover card action modal */}
        {discoverModal && (
          <div
            className="fixed inset-0 z-30 bg-black/70 flex items-end justify-center"
            onClick={() => setDiscoverModal(null)}
          >
            <div
              className="w-full max-w-md bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-t-2xl p-5 pb-8 shadow-2xl overflow-y-auto"
              style={{ maxHeight: "80vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-[var(--po-border-strong)] mx-auto mb-4" />
              <div className="flex items-center gap-3 mb-5">
                {discoverModal.imageUrl && (
                  <img src={discoverModal.imageUrl} alt={discoverModal.cardName} className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[var(--po-text)] truncate">{discoverModal.cardName}</p>
                  <p className="text-[11px] text-[var(--po-text-dim)] truncate">{discoverModal.setName}</p>
                  {discoverModal.priceUsd > 0 && (
                    <p className="text-[11px] font-black mt-0.5" style={{ color: "var(--po-green)" }}>
                      {fmtMoney(discoverModal.priceUsd * (RATES[currency]?.rate || 1), currency)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  href={`/friend/${discoverModal.friendHandle}/${discoverModal.setId}?from=discover`}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-[var(--po-border)] bg-[var(--po-bg)] text-sm font-bold text-[var(--po-text)] hover:border-[var(--po-green)] transition-colors"
                  onClick={() => setDiscoverModal(null)}
                >
                  <span>View in @{discoverModal.friendHandle}{"'"}s collection</span>
                  <ChevronRight size={16} className="text-[var(--po-text-faint)]" />
                </Link>
                <Link
                  href={`/messages/${discoverModal.friendHandle}?card=${encodeURIComponent(JSON.stringify({ cardName: discoverModal.cardName, setName: discoverModal.setName, imageUrl: discoverModal.imageUrl, priceUsd: discoverModal.priceUsd }))}`}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-bold transition-colors"
                  style={{ background: "var(--po-green)", color: "#050507" }}
                  onClick={() => setDiscoverModal(null)}
                >
                  <span>Message @{discoverModal.friendHandle}</span>
                  <MessageCircle size={16} />
                </Link>
              </div>
            </div>
          </div>
        )}

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
    </MSShell>
  );
}
