"use client";

import { useEffect } from "react";

// iOS Safari only applies :active styles during touch when at least one
// touchstart listener exists on the page. One passive document-level
// listener arms :active (and therefore .ms-pressable) app-wide. Passive
// means it can never block scrolling and cannot interfere with Discover's
// non-passive pull-to-refresh touchmove handler, which lives on its own
// container element.
export function TouchActiveShim() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
