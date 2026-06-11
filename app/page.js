"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, EyeOff, Eye, Trash2,
  MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, Clock, MessageCircle, GripVertical,
} from "lucide-react";
import { SetCardTile } from "@/components/home/SetCardTile";

// dnd-kit is code-split behind this lazy import: the chunk only downloads
// when the user enters reorder mode. While it loads, the Suspense fallback
// renders the same tiles statically (identical DOM via SetCardTile) so
// there is no blank list and no layout shift — drag just isn't armed yet.
const ReorderSetList = lazy(() =>
  import("@/components/home/ReorderSetList").then((m) => ({ default: m.ReorderSetList }))
);
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { useRefreshPrices } from "@/app/RefreshPricesProvider";
import PasskeyNudge from "@/components/PasskeyNudge";
import PushNudge from "@/components/PushNudge";
import { getSlotKey } from "@/lib/edition-utils";

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

  const {
    refreshing,
    refreshDone,
    refreshProgress,
    refreshErrors,
    portfolioTrend,
    trends,
    lastRefreshedAt,
    totalFlash,
    triggerRefresh,
    dismissErrors,
  } = useRefreshPrices();

  // Animation state
  const [displayValues, setDisplayValues] = useState({});
  const rafRef = useRef(null);
  const animTargetsRef = useRef({});

  // Reorder state
  const [isReordering, setIsReordering] = useState(false);
  const [orderedSets, setOrderedSets] = useState([]);
  const preReorderRef = useRef([]);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }
      setUser(user);

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
            .select("set_id, card_number, printing:printings!inner(price_usd, printing_type)")
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

      // Parallel batch: profile, user_sets, entries, and prefs all only
      // need user.id — none depend on each other.
      const [{ data: profileData }, { data: userSetsRows }, entries, { data: prefs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("user_sets")
          .select("set_id, added_at, hidden_at, prices_updated_at")
          .eq("user_id", user.id)
          .order("added_at", { ascending: false }),
        fetchAllEntries(user.id),
        supabase
          .from("user_set_preferences")
          .select("set_id, sort_order")
          .eq("user_id", user.id)
          .not("sort_order", "is", null),
      ]);
      setProfile(profileData);

      // Step 2: fetch set details at the top level.
      const setIds = (userSetsRows || []).map((r) => r.set_id).filter(Boolean);
      const [{ data: setsData }] = setIds.length > 0
        ? await Promise.all([
            supabase
              .from("sets")
              .select("id, code, name, series, total, total_with_secrets, logo_url, theme_primary, theme_secondary, theme_bg, cards(count)")
              .in("id", setIds),
          ])
        : [{ data: [] }];

      const setById = Object.fromEntries((setsData || []).map((s) => [s.id, s]));

      const slotCountById = {};
      if (setIds.length > 0) {
        const { data: slotRows } = await supabase.rpc("master_printing_counts", { set_ids: setIds });
        (slotRows || []).forEach((r) => { slotCountById[r.set_id] = Number(r.slot_count); });
      }

      const slotSets = {}, counts = {}, vals = {};
      (entries || []).forEach((e) => {
        if (!slotSets[e.set_id]) slotSets[e.set_id] = new Set();
        slotSets[e.set_id].add(getSlotKey(e.card_number, e.printing?.printing_type || ""));
        vals[e.set_id] = (vals[e.set_id] || 0) + (e.printing?.price_usd || 0);
      });
      for (const [sid, s] of Object.entries(slotSets)) counts[sid] = s.size;

      const enriched = (userSetsRows || [])
        .map((row) => {
          const s = setById[row.set_id];
          if (!s) return null;
          return {
            ...s,
            checkedCount: counts[s.id] || 0,
            slotCount: slotCountById[s.id] || 0,
            isHidden: row.hidden_at != null,
            pricesUpdatedAt: row.prices_updated_at,
          };
        })
        .filter(Boolean);

      const initDisplay = {};
      enriched.forEach((s) => { initDisplay[s.id] = 0; });

      const visibleEnriched = enriched.filter((s) => !s.isHidden);
      setUserSets(visibleEnriched);
      setHiddenSets(enriched.filter((s) => s.isHidden));
      setSetValues(vals);
      setDisplayValues(initDisplay);

      // Apply sort order preferences (resolved in parallel batch above)
      const prefMap = Object.fromEntries((prefs || []).map((p) => [p.set_id, p.sort_order]));
      const anyPrefs = (prefs || []).length > 0;
      const sorted = anyPrefs
        ? [...visibleEnriched].sort((a, b) => (prefMap[a.id] ?? -1) - (prefMap[b.id] ?? -1))
        : visibleEnriched;
      setOrderedSets(sorted);

      setLoading(false);

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
    triggerRefresh({
      visibleSets: userSets,
      user,
      displayValues,
      setValues,
      animTargetsRef,
      startAnimations,
      onSetValuesChange: (newValues) => {
        setSetValues((prev) => ({ ...prev, ...newValues }));
      },
      onUserSetsStamp: (refreshedIds, nowIso) => {
        const stamp = (s) => refreshedIds.has(s.id) ? { ...s, pricesUpdatedAt: nowIso } : s;
        setUserSets((prev) => prev.map(stamp));
        setHiddenSets((prev) => prev.map(stamp));
      },
    });
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  const enterReorderMode = () => {
    preReorderRef.current = orderedSets;
    setIsReordering(true);
  };

  const cancelReorder = () => {
    setOrderedSets(preReorderRef.current);
    setIsReordering(false);
  };

  const saveOrder = async () => {
    const rows = orderedSets.map((set, i) => ({
      user_id: user.id,
      set_id: set.id,
      sort_order: i,
    }));
    await supabase
      .from("user_set_preferences")
      .upsert(rows, { onConflict: "user_id,set_id" });
    setIsReordering(false);
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
      setOrderedSets((prev) => prev.filter((s) => s.id !== setId));
      setHiddenSets((prev) => [{ ...moving, isHidden: true }, ...prev]);
    }
  };

  const executeRemove = async (setId) => {
    setConfirmAction(null); setSwipeState({});
    await supabase.from("user_sets").delete()
      .eq("user_id", user.id).eq("set_id", setId);
    setUserSets((prev) => prev.filter((s) => s.id !== setId));
    setOrderedSets((prev) => prev.filter((s) => s.id !== setId));
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
      setOrderedSets((prev) => [setData, ...prev]);
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
    const total = set.slotCount || set.total_with_secrets || Number(set.cards?.[0]?.count) || 0;
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
            className="ms-pressable w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80"
            aria-label="More options"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuState[set.id] && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg shadow-xl overflow-hidden min-w-[130px]">
              <button
                onClick={() => { setMenuState({}); setConfirmAction({ type: "hide", setId: set.id, setName: set.name }); }}
                className="ms-pressable w-full px-4 py-2.5 text-left text-sm text-amber-400 hover:bg-[var(--po-border)] flex items-center gap-2"
              >
                <EyeOff size={14} /> Hide
              </button>
              <button
                onClick={() => { setMenuState({}); setConfirmAction({ type: "remove", setId: set.id, setName: set.name }); }}
                className="ms-pressable w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-[var(--po-border)] flex items-center gap-2"
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
            className="ms-pressable block"
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
              className="ms-pressable w-20 bg-amber-600 hover:bg-amber-500 flex flex-col items-center justify-center gap-1 text-white"
            >
              <EyeOff size={16} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Hide</span>
            </button>
            <button
              onClick={() => setConfirmAction({ type: "remove", setId: set.id, setName: set.name })}
              className="ms-pressable w-20 bg-rose-700 hover:bg-rose-600 flex flex-col items-center justify-center gap-1 text-white"
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
            <button onClick={(e) => { e.stopPropagation(); dismissErrors(); }} style={{ color: "var(--po-text-dim)" }}>✕</button>
          </div>
        )}
        <div className="relative mx-5 mb-5 h-10 overflow-hidden rounded-lg border border-[var(--po-border)]">
          {refreshDone && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(200,255,74,0.12)" }} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            className="ms-pressable relative w-full h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
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
        {!refreshing && !refreshDone && (
          <p
            className="mx-5 -mt-3 mb-5 text-[10px] text-center normal-case tracking-normal"
            style={{ color: "var(--po-text-dim)" }}
          >
            Takes up to ~20 seconds per set.
          </p>
        )}
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
          <PasskeyNudge />
          <PushNudge />
          {allSets.length > 0 && renderBanner()}

          <Link
            href="/sets"
            className="ms-pressable block w-full bg-[var(--po-bg-soft)] border-2 border-dashed border-[var(--po-border)] hover:border-[var(--po-green)] hover:text-[var(--po-green)] rounded-2xl py-6 text-center font-bold uppercase tracking-widest text-sm text-[var(--po-text-dim)] transition-colors"
          >
            <Plus size={20} className="inline mr-1 -mt-1" />
            Add a set
          </Link>

          {orderedSets.length === 0 && hiddenSets.length === 0 ? (
            <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
              No sets yet — tap above to start collecting.
            </div>
          ) : isReordering ? (
            <>
              <div className="flex items-center justify-between">
                <button
                  onClick={cancelReorder}
                  className="ms-pressable text-xs font-bold text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
                >
                  Cancel
                </button>
                <span className="text-[10px] uppercase tracking-widest text-[var(--po-text-faint)]">
                  Drag to reorder
                </span>
                <button
                  onClick={saveOrder}
                  className="ms-pressable text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "var(--po-green)", color: "#050507" }}
                >
                  Done
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="space-y-3">
                    {orderedSets.map((set) => (
                      <SetCardTile key={set.id} set={set} />
                    ))}
                  </div>
                }
              >
                <ReorderSetList sets={orderedSets} onReorder={setOrderedSets} />
              </Suspense>
            </>
          ) : (
            <>
              {orderedSets.length > 1 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={enterReorderMode}
                    className="ms-pressable flex items-center gap-1.5 text-[11px] font-bold text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
                  >
                    <GripVertical size={13} />
                    Edit Order
                  </button>
                </div>
              )}
              {orderedSets.map((set) => renderSetCard(set))}
            </>
          )}

          {hiddenSets.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowHidden((v) => !v)}
                className="ms-pressable w-full flex items-center justify-between px-1 py-2 text-[var(--po-text-dim)] hover:text-[var(--po-text)] transition-colors"
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
                            className="ms-pressable flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--po-border)] text-[var(--po-text-dim)] hover:text-[var(--po-text)] text-xs font-bold uppercase tracking-widest transition-colors"
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
                  className="ms-pressable flex-1 py-2 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-sm font-bold text-[var(--po-text)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmAction.type === "hide" ? executeHide(confirmAction.setId) : executeRemove(confirmAction.setId)}
                  className={`ms-pressable flex-1 py-2 rounded-lg text-sm font-bold text-white ${confirmAction.type === "hide" ? "bg-amber-600" : "bg-rose-700"}`}
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
