"use client";

import { useEffect } from "react";

// Saves and restores the scroll position of MSShell's <main
// data-scroll-container> — the app's real scroll element, which remounts on
// every route change so the browser's own restoration never applies.
//
// key must include everything that changes what the offset means: the set
// page passes `${pathname}:${view}` so a binder-view offset never restores
// into rarity view. Restore fires whenever the user returns to the same key
// in this tab session ("resume where I was"), clamped to the scroller's max.
export function useScrollRestoration({ key, ready }) {
  const storageKey = `ms:scroll:${key}`;

  // Save: throttled trailing write on every scroll.
  useEffect(() => {
    const el = document.querySelector("[data-scroll-container]");
    if (!el) return;
    let timer = null;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        try {
          sessionStorage.setItem(storageKey, String(Math.round(el.scrollTop)));
        } catch { /* storage full/unavailable — restoration is best-effort */ }
      }, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [storageKey]);

  // Restore: once content for this key is ready, after first paint.
  useEffect(() => {
    if (!ready) return;
    const el = document.querySelector("[data-scroll-container]");
    if (!el) return;
    let saved = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch { /* ignore */ }
    if (saved == null) return;
    const target = Number(saved);
    if (!Number.isFinite(target) || target <= 0) return;
    const raf = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = Math.min(target, Math.max(0, max));
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, storageKey]);
}
