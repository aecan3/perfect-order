"use client";

import Link from "next/link";
import { Star, Bell } from "lucide-react";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

export function MSHeader({ unreadCount = 0, scrolled = false }) {
  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--ms-bg)",
        borderBottom: `1px solid ${scrolled ? "var(--ms-rule)" : "transparent"}`,
        transition: "border-color 200ms ease",
      }}
    >
      <MasterSetterLogo variant="inline" height={28} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href="/favourites"
          aria-label="Favourites"
          className="ms-icon-btn"
          style={{
            width: 40,
            height: 40,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Star size={20} fill="var(--ms-gold)" stroke="var(--ms-gold)" />
        </Link>

        <button
          aria-label="Notifications"
          className="ms-icon-btn"
          onClick={() => console.log("notifications: stub")}
          style={{
            width: 40,
            height: 40,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <span style={{ display: "inline-flex", color: "var(--ms-dim)", position: "relative" }}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: "var(--ms-danger)",
                  boxShadow: "0 0 0 2px var(--ms-bg)",
                }}
              />
            )}
          </span>
          {unreadCount > 0 && (
            <span className="sr-only">{unreadCount} unread notifications</span>
          )}
        </button>
      </div>
    </header>
  );
}
