"use client";

import { useState } from "react";
import { MSHeader } from "./MSHeader";
import { MSTabBar } from "./MSTabBar";

export function MSShell({ activeTab, unreadCount = 0, children }) {
  const [scrolled, setScrolled] = useState(false);

  const onScroll = (e) => {
    setScrolled(e.currentTarget.scrollTop > 0);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--ms-bg)",
        color: "var(--ms-ink)",
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      }}
    >
      <MSHeader unreadCount={unreadCount} scrolled={scrolled} />
      <main
        onScroll={onScroll}
        style={{ flex: 1, overflowY: "auto", minHeight: 0 }}
      >
        {children}
      </main>
      <MSTabBar active={activeTab} />
    </div>
  );
}
