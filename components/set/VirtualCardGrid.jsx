"use client";

import { useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// Windowed 2-column card grid for the set page's binder/missing views.
// Row-virtualizes (pairs of cards per row) against MSShell's
// [data-scroll-container] <main>, which is the app's real scroll element —
// the window never scrolls. Dynamic measurement handles the variable
// under-row (stepper appears when a single-print card is owned).
export function VirtualCardGrid({ items, renderItem }) {
  const containerRef = useRef(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  useEffect(() => {
    const el = containerRef.current;
    const scroller = document.querySelector("[data-scroll-container]");
    if (!el || !scroller) return;
    // Grid offset from the top of the scroller's content (header, stats,
    // view toggle all sit above the grid).
    const margin =
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    setScrollMargin(Math.max(0, Math.round(margin)));
  }, [items.length]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => document.querySelector("[data-scroll-container]"),
    estimateSize: () => 290,
    overscan: 6,
    scrollMargin,
  });

  return (
    <div
      ref={containerRef}
      style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
    >
      {virtualizer.getVirtualItems().map((vr) => (
        <div
          key={vr.key}
          data-index={vr.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${vr.start - scrollMargin}px)`,
          }}
        >
          <div
            className="grid grid-cols-2 gap-3"
            style={{ paddingBottom: vr.index < rows.length - 1 ? 12 : 0 }}
          >
            {rows[vr.index].map(renderItem)}
          </div>
        </div>
      ))}
    </div>
  );
}
