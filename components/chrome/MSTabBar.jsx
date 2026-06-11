"use client";

import Link from "next/link";
import { Layers, Radar, MessageCircle, User } from "lucide-react";

function IconFeedPulse({ color = "currentColor" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M2 11 H6 L8 5 L11 17 L13 9 L15 11 H20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS = [
  { id: "sets",     label: "Sets",     href: "/",         Icon: Layers,        lucide: true  },
  { id: "discover", label: "Discover", href: "/discover", Icon: Radar,         lucide: true  },
  { id: "feed",     label: "Feed",     href: "/feed",     Icon: IconFeedPulse, lucide: false },
  { id: "messages", label: "Messages", href: "/messages", Icon: MessageCircle, lucide: true  },
  { id: "you",      label: "You",      href: "/you",      Icon: User,          lucide: true  },
];

function ActiveIndicator() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 14,
        right: 14,
        height: 10,
        pointerEvents: "none",
      }}
    >
      {/* Horizontal 2px line */}
      <span style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: "var(--ms-accent)",
      }} />
      {/* Left bracket tick */}
      <span style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 2,
        height: 5,
        background: "var(--ms-accent)",
      }} />
      {/* Right bracket tick */}
      <span style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 2,
        height: 5,
        background: "var(--ms-accent)",
      }} />
    </span>
  );
}

export function MSTabBar({ active, unreadMessages = 0 }) {
  return (
    <nav
      aria-label="Primary"
      style={{
        flexShrink: 0,
        height: "calc(64px + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        borderTop: "1px solid var(--ms-rule)",
        background: "var(--ms-bg)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
        display: "flex",
      }}
    >
      {TABS.map(({ id, label, href, Icon, lucide }) => {
        const isActive = id === active;
        const color = isActive ? "var(--ms-accent)" : "var(--ms-dim)";
        return (
          <Link
            key={id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className="ms-tab-link ms-pressable"
            style={{
              flex: 1,
              height: 64,
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              position: "relative",
              color,
              textDecoration: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {isActive && <ActiveIndicator />}
            {id === "messages" ? (
              <span style={{ display: "inline-flex", position: "relative" }}>
                <Icon size={22} strokeWidth={2} />
                {unreadMessages > 0 && (
                  <span aria-hidden="true" style={{
                    position: "absolute", top: -1, right: -1,
                    width: 8, height: 8, borderRadius: 9999,
                    background: "var(--ms-danger)",
                    boxShadow: "0 0 0 2px var(--ms-bg)",
                  }} />
                )}
              </span>
            ) : lucide ? (
              <Icon size={22} strokeWidth={2} />
            ) : (
              <Icon color={color} />
            )}
            <span
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 9,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
