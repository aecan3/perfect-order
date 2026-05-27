"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

const RefreshPricesContext = createContext(null);

const SESSION_KEY = "ms_refresh_started_at";
const RECOVERY_WINDOW_MS = 2 * 60 * 1000;
const DONE_AUTO_CLEAR_MS = 3000;
const RECOVERED_AUTO_CLEAR_MS = 30 * 1000;

export function RefreshPricesProvider({ children }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshDone, setRefreshDone] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [refreshErrors, setRefreshErrors] = useState([]);
  const [portfolioTrend, setPortfolioTrend] = useState(null);
  const [trends, setTrends] = useState({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [totalFlash, setTotalFlash] = useState(false);
  const [recoveredFromReload, setRecoveredFromReload] = useState(false);

  const doneTimerRef = useRef(null);
  const recoveredTimerRef = useRef(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stamp = window.sessionStorage.getItem(SESSION_KEY);
      if (!stamp) return;
      const startedAt = new Date(stamp).getTime();
      if (Number.isNaN(startedAt)) {
        window.sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      const age = Date.now() - startedAt;
      if (age > 0 && age < RECOVERY_WINDOW_MS) {
        setRecoveredFromReload(true);
        recoveredTimerRef.current = setTimeout(() => {
          setRecoveredFromReload(false);
          try { window.sessionStorage.removeItem(SESSION_KEY); } catch {}
        }, RECOVERED_AUTO_CLEAR_MS);
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // sessionStorage unavailable — no-op
    }
  }, []);

  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
      if (recoveredTimerRef.current) clearTimeout(recoveredTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const dismissErrors = useCallback(() => {
    setRefreshErrors([]);
  }, []);

  const triggerRefresh = useCallback(
    ({
      visibleSets,
      user,
      displayValues,
      setValues,
      animTargetsRef,
      startAnimations,
      onSetValuesChange,
      onUserSetsStamp,
    }) => {
      if (refreshing || !user) return;
      if (!visibleSets || visibleSets.length === 0) return;

      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }

      setRefreshing(true);
      setRefreshDone(false);
      setRefreshErrors([]);
      setPortfolioTrend(null);
      setRecoveredFromReload(false);
      setRefreshProgress({ done: 0, total: visibleSets.length, name: "" });

      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(SESSION_KEY, new Date().toISOString());
        }
      } catch {}

      const acc = {
        done: 0,
        allPrev: 0,
        allNew: 0,
        newValues: {},
        newTrends: {},
        errors: [],
      };

      const promises = visibleSets.map((set) =>
        fetch("/api/refresh-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setIds: [set.id] }),
        })
          .then((res) => res.json())
          .then((data) => {
            const r = data.results?.[0];
            acc.done++;
            setRefreshProgress({
              done: acc.done,
              total: visibleSets.length,
              name: set.name,
            });

            if (r && !r.error) {
              const { setId, previousValue, newValue } = r;
              acc.newValues[setId] = newValue;
              const oldDisplay =
                animTargetsRef?.current?.[setId]?.to ??
                displayValues?.[setId] ??
                setValues?.[setId] ??
                0;
              if (Math.abs(newValue - oldDisplay) > 0.005) {
                startAnimations?.({ [setId]: { from: oldDisplay, to: newValue } });
              }
              const prev = previousValue ?? 0;
              const diff = newValue - prev;
              if (Math.abs(diff) > 0.005) {
                acc.newTrends[setId] = {
                  dir: diff > 0 ? "up" : "down",
                  diff: Math.abs(diff),
                };
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
            setRefreshProgress({
              done: acc.done,
              total: visibleSets.length,
              name: set.name,
            });
          })
      );

      Promise.all(promises)
        .then(() => {
          onSetValuesChange?.(acc.newValues);
          setTrends(acc.newTrends);

          const now = new Date().toISOString();
          const refreshedIds = new Set(visibleSets.map((s) => s.id));
          onUserSetsStamp?.(refreshedIds, now);
          setLastRefreshedAt(now);

          if (acc.allPrev > 0.01) {
            const diff = acc.allNew - acc.allPrev;
            setPortfolioTrend({ diff, pct: (diff / acc.allPrev) * 100 });
          }

          setTotalFlash(true);
          flashTimerRef.current = setTimeout(() => setTotalFlash(false), 600);

          if (acc.errors.length) setRefreshErrors(acc.errors);
          setRefreshProgress(null);
          setRefreshing(false);
          setRefreshDone(true);
          doneTimerRef.current = setTimeout(
            () => setRefreshDone(false),
            DONE_AUTO_CLEAR_MS
          );

          try {
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem(SESSION_KEY);
            }
          } catch {}
        })
        .catch(() => {
          setRefreshErrors(["Network error — prices not updated"]);
          setRefreshProgress(null);
          setRefreshing(false);
          try {
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem(SESSION_KEY);
            }
          } catch {}
        });
    },
    [refreshing]
  );

  const value = {
    refreshing,
    refreshDone,
    refreshProgress,
    refreshErrors,
    portfolioTrend,
    trends,
    lastRefreshedAt,
    totalFlash,
    recoveredFromReload,
    triggerRefresh,
    dismissErrors,
  };

  return (
    <RefreshPricesContext.Provider value={value}>
      {children}
    </RefreshPricesContext.Provider>
  );
}

export function useRefreshPrices() {
  const ctx = useContext(RefreshPricesContext);
  if (!ctx) {
    throw new Error("useRefreshPrices must be used inside <RefreshPricesProvider>");
  }
  return ctx;
}
