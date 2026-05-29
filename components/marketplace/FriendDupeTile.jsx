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

      {/* Trade badge — top right, mirrors eBay badge position */}
      <span
        className="absolute top-1.5 right-1.5 inline-flex items-center rounded px-1.5 py-0.5"
        style={{ background: "var(--po-green)" }}
      >
        <ArrowLeftRight size={10} color="#050507" strokeWidth={2.5} />
      </span>

      {/* Set name + price — bottom gradient */}
      <div
        className="absolute inset-x-0 bottom-0 px-1.5 py-1"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0))" }}
      >
        <div className="truncate text-[7px] text-white/60">{dupe.setName}</div>
      </div>
    </button>
  );
}
