"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/Avatar";

export function ProfileView({
  isOwnProfile,
  handle,
  profile,
  stats,
  favourites,
  headerAction,     // React node — top-right of identity header (gear, overflow, etc.)
  footer,           // React node — rendered below Hunting strip
  onChangePhoto,
  isPreview = false, // disables tappable elements (Dupes link, Hunting count link)
  afterStats,        // React node — inserted between stats row and Hunting strip
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

        {/* Top-right slot: gear (own view), overflow (friend view), etc. */}
        {headerAction && (
          <div style={{ paddingTop: 6, flexShrink: 0 }}>
            {headerAction}
          </div>
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

        {/* Duplicates — lime; tappable in full view, static in preview */}
        {isPreview ? (
          <div
            style={{
              flex: 1, padding: "12px 8px",
              background: "rgba(200,255,74,0.08)",
              border: "0.5px solid rgba(200,255,74,0.25)",
              borderRadius: "var(--border-radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--po-green)", letterSpacing: "-0.02em" }}>
              {stats.duplicates}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--po-green)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3, opacity: 0.75 }}>
              Dupes
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* ── afterStats slot (Add Friend CTA, pending UI, etc.) ──── */}
      {afterStats}

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
          {isPreview ? (
            <span style={{ fontSize: 13, color: "var(--po-text-dim)" }}>
              {favourites.length} / 6
            </span>
          ) : (
            <Link
              href="/favourites"
              style={{ fontSize: 13, color: "var(--po-text-dim)", textDecoration: "none" }}
            >
              {favourites.length} / 6 ›
            </Link>
          )}
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

      {/* ── Footer slot (friends + account menu for /you; mutual friends +
           set list for /friend) ──────────────────────────────────── */}
      {footer}

    </div>
  );
}
