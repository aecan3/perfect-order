"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Users, LogOut, EyeOff, Eye, Trash2,
  MoreHorizontal, ChevronDown, ChevronRight,
  RefreshCw, Clock, MessageCircle,
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

// Compact diff for inline trend: "â†‘44" or "â†“2.5"
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

  // Discover panel
  const [discoverCards, setDiscoverCards] = useState(null); // null=loading, []=empty, [...]=results
  const [discoverModal, setDiscoverModal] = useState(null); // card object when modal is open

  // Unread messages badge
  const [unreadCount, setUnreadCount] = useState(0);

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

      // Paginated fetch for collection_entries â€” loops with .range() until
      // a page returns fewer rows than PAGE, guaranteeing every row is
      // included regardless of collection size.
      const fetchAllEntries = async (userId) => {
        const PAGE = 1000;
        const rows = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("collection_entries")
            .select("set_id, printing:printings(price_usd)")
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
      // Nesting printings!printings_set_id_fkey(count) inside the user_sets
      // join silently returns [] for the aggregate, causing the denominator
      // to fall back to card count instead of printing count.
      // The flat sets query (same pattern as /sets browser) is reliable.
      const setIds = (userSetsRows || []).map((r) => r.set_id).filter(Boolean);
      const { data: setsData } = setIds.length > 0
        ? await supabase
            .from("sets")
            .select("id, code, name, series, total, total_with_secrets, logo_url, theme_primary, theme_secondary, theme_bg, cards(count), printings!printings_set_id_fkey(count)")
            .in("id", setIds)
        : { data: [] };

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
            isHidden: row.hidden_at != null,
            pricesUpdatedAt: row.prices_updated_at,
          };
        })
        .filter(Boolean);

      // Pre-zero displayValues so banner starts at $0 (no flash of real values)
      const initDisplay = {};
      enriched.forEach((s) => { initDisplay[s.id] = 0; });

      setUserSets(enriched.filter((s) => !s.isHidden));
      setHiddenSets(enriched.filter((s) => s.isHidden));
      setSetValues(vals);
      setDisplayValues(initDisplay);
      setLoading(false);

      // Non-blocking unread count fetch
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false)
        .then(({ count }) => setUnreadCount(count || 0));

      // Non-blocking discover fetch â€” runs after main load so it doesn't delay the page
      (async () => {
        try {
          const { data: fships } = await supabase
            .from("friendships")
            .select("user_a, user_b")
            .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
            .eq("status", "accepted");

          if (!fships?.length) { setDiscoverCards([]); return; }

          const friendIds = fships.map((f) => f.user_a === user.id ? f.user_b : f.user_a);

          const [{ data: friendDups }, { data: myMissing }] = await Promise.all([
            supabase
              .from("collection_entries")
              .select("user_id, printing_id, card_number, set_id, duplicate_count, printing:printings(price_usd, image_url, card:cards(name, image_large)), set:sets(name, code)")
              .in("user_id", friendIds)
              .gt("duplicate_count", 0),
            supabase
              .from("collection_entries")
              .select("printing_id, set_id, card_number")
              .eq("user_id", user.id)
              .eq("checked", false),
          ]);

          const missingPrintingIds = new Set((myMissing || []).map((e) => e.printing_id).filter(Boolean));
          const missingKeys = new Set((myMissing || []).map((e) => `${e.set_id}:${e.card_number}`));

          const friendProfileIds = [...new Set((friendDups || []).map((d) => d.user_id))];
          const { data: friendProfiles } = friendProfileIds.length > 0
            ? await supabase.from("profiles").select("id, handle").in("id", friendProfileIds)
            : { data: [] };
          const profileMap = Object.fromEntries((friendProfiles || []).map((p) => [p.id, p]));

          const results = (friendDups || [])
            .filter((entry) =>
              (entry.printing_id && missingPrintingIds.has(entry.printing_id)) ||
              missingKeys.has(`${entry.set_id}:${entry.card_number}`)
            )
            .map((entry) => ({
              printingId: entry.printing_id,
              cardNumber: entry.card_number,
              setId: entry.set_id,
              duplicateCount: entry.duplicate_count,
              friendHandle: profileMap[entry.user_id]?.handle || "unknown",
              priceUsd: entry.printing?.price_usd || 0,
              imageUrl: entry.printing?.image_url || entry.printing?.card?.image_large || null,
              setName: entry.set?.name || "",
              cardName: entry.printing?.card?.name || "",
            }))
            .sort((a, b) => b.priceUsd - a.priceUsd)
            .slice(0, 20);

          setDiscoverCards(results);
        } catch {
          setDiscoverCards([]);
        }
      })();

      // Staggered count-up from zero â€” fires on every page load / navigate-back
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

  // â”€â”€ Animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // targets: { [setId]: { from, to, delay? (ms), duration? (ms) } }
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

  // â”€â”€ Price refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      setRefreshProgress(`Updating ${set.name}â€¦ (${i + 1} of ${total})`);
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
        // silent per-set failure â€” continue
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

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const switchCurrency = (c) => { setCurrency(c); localStorage.setItem("po:currency", c); };
  const signOut = async () => { await supabase.auth.signOut(); router.replace("/welcome"); };
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
        Loading...
      </div>
    );
  }

  // â”€â”€ Computed portfolio values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const printingCount = Number(set.printings?.[0]?.count) || 0;
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

    // Shared inner card content â€” used inside both master wrapper and plain wrapper
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
                          {trend.dir === "up" ? "â†‘" : "â†“"}{formatDiff(trend.diff, currency)}
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

          {/* Swipe action buttons â€” revealed by translateX(-160px) */}
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

  // â”€â”€ Discover panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Portfolio banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderBanner = () => {
    const totalSets = allSets.length;
    const stale = isStale(portfolioUpdatedAt);
    const updatedLabel = pricesLabel(portfolioUpdatedAt);

    return (
      <div className="relative rounded-2xl overflow-hidden border border-[var(--po-border-strong)]"
           style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", borderTop: "1px solid rgba(200,255,74,0.35)" }}>
        {/* Iridescent conic glow behind content */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
             style={{ background: "conic-gradient(from 220deg at 30% 0%, rgba(200,255,74,0.06), rgba(215,107,255,0.06), rgba(95,182,255,0.06), rgba(200,255,74,0.06))", opacity: 0.8 }} />

        <div className="relative px-5 pt-5 pb-4">
          {/* Label */}
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: "var(--po-text-faint)" }}>
            Total Collection Value
          </div>

          {/* Big value */}
          <div
            className="mt-2.5 text-4xl font-black tabular-nums leading-none transition-colors duration-300"
            style={{ color: totalFlash ? "#ffffff" : "var(--po-green)", letterSpacing: "-0.02em", textShadow: `0 0 24px rgba(200,255,74,0.4)` }}
          >
            {fmtMoneyBig(bannerTotal, currency)}
          </div>

          {/* Meta: set count + staleness */}
          <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--po-text-dim)" }}>
            <span>Across {totalSets} set{totalSets !== 1 ? "s" : ""}</span>
            {updatedLabel && <><span style={{ color: "var(--po-text-faint)" }}>·</span><span className={stale ? "text-amber-400" : ""}>{stale && <Clock size={9} className="inline mr-0.5 -mt-0.5" />}{updatedLabel}</span></>}
          </div>

          {/* Trend line â€” hidden until first refresh */}
          {portfolioTrend && (
            <div
              className={`mt-1 text-xs font-bold ${
                portfolioTrend.diff >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {portfolioTrend.diff >= 0 ? "â–²" : "â–¼"}{" "}
              {fmtMoneyBig(
                Math.abs(portfolioTrend.diff) * (RATES[currency]?.rate || 1),
                currency
              )}
              {" "}
              {portfolioTrend.diff >= 0 ? "+" : ""}
              {portfolioTrend.pct.toFixed(1)}% since last refresh
            </div>
          )}

          {/* Meta: set count + staleness â€” kept for backward compat below, now merged above */}
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

        {/* Refresh button â€” becomes a progress bar during refresh */}
        <div className="relative mx-5 mb-5 h-10 overflow-hidden rounded-lg border border-[var(--po-border)]">
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${refreshProgressPct}%`,
              background: refreshDone
                ? "rgba(200,255,74,0.18)"
                : "rgba(200,255,74,0.12)",
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={refreshing}
            className="relative w-full h-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed"
            style={{
              color: refreshDone
                ? "var(--po-green)"
                : refreshing
                ? "var(--po-text)"
                : "var(--po-text-dim)",
            }}
          >
            {refreshDone ? (
              <>
                <RefreshCw size={12} />
                âœ“ Updated
              </>
            ) : refreshing ? (
              <>
                <RefreshCw size={12} className="animate-spin flex-shrink-0" />
                <span className="truncate min-w-0">{refreshProgress || "Refreshingâ€¦"}</span>
              </>
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
            <Link
              href="/friends"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-colors"
              style={{ background: "var(--po-bg-soft)", border: "1px solid var(--po-border)", color: "var(--po-green)" }}
              aria-label="Friends"
            >
              <Users size={14} />
              Friends
            </Link>
            <Link href="/messages" className="relative text-[var(--po-text-dim)] hover:text-[var(--po-green)]" aria-label="Messages">
              <MessageCircle size={18} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-black px-0.5"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <button onClick={signOut} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3 max-w-md mx-auto">
        {/* Portfolio banner â€” only shown when user has sets */}
        {allSets.length > 0 && renderBanner()}

        {/* Discover panel â€” friends' duplicates you're missing */}
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
            No sets yet â€” tap above to start collecting.
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
      </main>

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
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-[var(--po-border-strong)] mx-auto mb-4" />
            {/* Card preview */}
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
  );
}

