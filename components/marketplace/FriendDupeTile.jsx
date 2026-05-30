"use client";

import { ArrowLeftRight } from "lucide-react";

/**
 * Friend-dupe tile for the Discover merged grid. Visual sibling to
 * MarketplaceTile — same aspect ratio, same badge position — but with
 * a green trade badge instead of the blue eBay badge.
 */
export function FriendDupeTile({ dupe, onTap }) {
  return (
    <button
      type="button"
      onClick={() => onTap(dupe)}
      className="relative block w-full overflow-hidden rounded-lg bg-black/40"
      style={{ aspectRatio: "2.5/3.5" }}
    >
      {dupe.imageUrl ? (
        <img
          src={dupe.imageUrl}
          alt={dupe.cardName}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[8px] leading-tight text-[var(--po-text-faint)]">
          {dupe.cardName || dupe.setName}
        </div>
      )}

      {/* Set logo — top left */}
      <div
        style={{
          position: "absolute",
          top: "6px",
          left: "6px",
          background: "rgba(7,7,10,0.75)",
          backdropFilter: "blur(4px)",
          borderRadius: "4px",
          padding: "3px 5px",
          maxWidth: "56px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {dupe.setLogoUrl ? (
          <img
            src={dupe.setLogoUrl}
            alt={dupe.setName || "Set"}
            style={{ height: "18px", width: "auto", maxWidth: "48px", display: "block" }}
          />
        ) : (
          <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.7)", lineHeight: 1, whiteSpace: "nowrap" }}>
            {dupe.setName || ""}
          </span>
        )}
      </div>

      {/* Trade badge — top right, mirrors eBay badge position */}
      <span
        className="absolute top-1.5 right-1.5 inline-flex items-center rounded px-1.5 py-0.5"
        style={{ background: "var(--po-green)" }}
      >
        <ArrowLeftRight size={10} color="#050507" strokeWidth={2.5} />
      </span>
    </button>
  );
}
