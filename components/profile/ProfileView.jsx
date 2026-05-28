"use client";

import Link from "next/link";
import { Camera, Settings, LogOut, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";

export function ProfileView({
  isOwnProfile,
  handle,
  profile,
  stats,
  favourites,
  friends,
  onProposeTrade,
  onMessage,
  onChangePhoto,
  onSignOut,
}) {
  const displayName = profile?.display_name || handle;

  return (
    <div style={{ padding: "0 16px 32px" }}>

      {/* ── Identity header ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>

        {/* Avatar + camera badge (own view) */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar profile={profile} size={64} />
          {isOwnProfile && (
            <button
              onClick={onChangePhoto}
              aria-label="Change photo"
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 22, height: 22,
                borderRadius: "50%",
                background: "var(--po-green)",
                border: "2px solid var(--po-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Camera size={11} color="#050507" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Display name + @handle */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
          <div style={{
            fontSize: 18, fontWeight: 700,
            color: "var(--po-text)",
            letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {displayName}
          </div>
          <div style={{ fontSize: 13, color: "var(--po-text-dim)", marginTop: 2 }}>
            @{handle}
          </div>
        </div>

        {/* Gear → /settings (own view only) */}
        {isOwnProfile && (
          <Link
            href="/settings"
            aria-label="Settings"
            style={{ color: "var(--po-text-dim)", paddingTop: 6, flexShrink: 0 }}
          >
            <Settings size={20} />
          </Link>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>

        {/* Sets */}
        <div style={{
          flex: 1, padding: "12px 8px",
          background: "rgba(244,244,246,0.04)",
          border: "0.5px solid rgba(244,244,246,0.08)",
          borderRadius: "var(--border-radius-md)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--po-text)", letterSpacing: "-0.02em" }}>
            {stats.sets}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--po-text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>
            Sets
          </div>
        </div>

        {/* Cards */}
        <div style={{
          flex: 1, padding: "12px 8px",
          background: "rgba(244,244,246,0.04)",
          border: "0.5px solid rgba(244,244,246,0.08)",
          borderRadius: "var(--border-radius-md)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--po-text)", letterSpacing: "-0.02em" }}>
            {stats.cards}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--po-text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>
            Cards
          </div>
        </div>

        {/* Duplicates — lime, tappable → /duplicates/[handle] */}
        <Link
          href={`/duplicates/${handle}`}
          style={{
            flex: 1, padding: "12px 8px",
            background: "rgba(200,255,74,0.08)",
            border: "0.5px solid rgba(200,255,74,0.25)",
            borderRadius: "var(--border-radius-md)",
            textAlign: "center",
            textDecoration: "none",
            display: "block",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--po-green)", letterSpacing: "-0.02em" }}>
            {stats.duplicates}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--po-green)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3, opacity: 0.75 }}>
            Dupes ›
          </div>
        </Link>
      </div>

      {/* ── Friend-view action buttons (Stage 2 exercises these) ─── */}
      {!isOwnProfile && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button
            onClick={onProposeTrade}
            style={{
              flex: 1, padding: "12px",
              background: "var(--po-green)",
              border: "none",
              borderRadius: "var(--border-radius-md)",
              color: "#050507",
              fontWeight: 700, fontSize: 14,
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            Propose Trade
          </button>
          <button
            onClick={onMessage}
            style={{
              flex: 1, padding: "12px",
              background: "transparent",
              border: "0.5px solid rgba(244,244,246,0.2)",
              borderRadius: "var(--border-radius-md)",
              color: "var(--po-text)",
              fontWeight: 600, fontSize: 14,
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            Message
          </button>
        </div>
      )}

      {/* ── Hunting (hero) ────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--po-green)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Hunting
          </span>
          <Link
            href="/favourites"
            style={{ fontSize: 13, color: "var(--po-text-dim)", textDecoration: "none" }}
          >
            {favourites.length} / 6 ›
          </Link>
        </div>

        {favourites.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--po-text-faint)", padding: "8px 0" }}>
            {isOwnProfile ? "No favourites yet." : "Not hunting anything yet."}
          </div>
        ) : (
          <div style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
            {favourites.map((fav) => (
              <div
                key={fav.printing_id}
                style={{
                  flexShrink: 0,
                  width: 72,
                  aspectRatio: "2.5/3.5",
                  borderRadius: "var(--border-radius-md)",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.4)",
                }}
              >
                {fav.printing?.card?.image_large ? (
                  <img
                    src={fav.printing.card.image_large}
                    alt={fav.printing?.card?.name || ""}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 6, textAlign: "center",
                    fontSize: 7, color: "var(--po-text-faint)", lineHeight: 1.3,
                  }}>
                    {fav.printing?.card?.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Friends ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--po-text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Friends
          </span>
          <Link
            href="/friends"
            style={{ fontSize: 13, color: "var(--po-text-dim)", textDecoration: "none" }}
          >
            {friends.count} ›
          </Link>
        </div>

        {friends.count === 0 ? (
          <div style={{ fontSize: 13, color: "var(--po-text-faint)", padding: "4px 0" }}>
            No friends yet.{" "}
            {isOwnProfile && (
              <Link href="/friends" style={{ color: "var(--po-green)", textDecoration: "none" }}>
                Find some ›
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center" }}>
            {friends.sample.map((f, i) => (
              <div
                key={f.handle ?? i}
                style={{
                  marginLeft: i === 0 ? 0 : -10,
                  position: "relative",
                  zIndex: friends.sample.length - i,
                  borderRadius: "50%",
                  border: "2px solid var(--po-bg)",
                  lineHeight: 0,
                  flexShrink: 0,
                }}
              >
                <Avatar profile={f} size={38} />
              </div>
            ))}
            {friends.count > 5 && (
              <div style={{
                marginLeft: -10,
                width: 38, height: 38,
                borderRadius: "50%",
                background: "rgba(244,244,246,0.1)",
                border: "2px solid var(--po-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: "var(--po-text-dim)",
                position: "relative",
                zIndex: 0,
                flexShrink: 0,
              }}>
                +{friends.count - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Account menu (own view only) ─────────────────────────── */}
      {isOwnProfile && (
        <div style={{ borderTop: "0.5px solid rgba(244,244,246,0.08)", paddingTop: 20 }}>
          <Link
            href="/settings"
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 0",
              textDecoration: "none",
              borderBottom: "0.5px solid rgba(244,244,246,0.06)",
            }}
          >
            <Settings size={18} style={{ color: "var(--po-text-dim)", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--po-text)" }}>
              Settings
            </span>
            <ChevronRight size={16} style={{ color: "var(--po-text-faint)", flexShrink: 0 }} />
          </Link>
          <button
            onClick={onSignOut}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "14px 0",
              background: "none", border: "none",
              cursor: "pointer", textAlign: "left",
            }}
          >
            <LogOut size={18} style={{ color: "var(--ms-danger)", flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ms-danger)" }}>
              Sign out
            </span>
          </button>
        </div>
      )}

    </div>
  );
}
