"use client";

import { useState } from "react";

// Moved verbatim from app/set/[setId]/page.js so both CardCell and the
// page (including the hidden-for-launch Grand Master section) can render it.
export function CardArt({ src, name, ownershipState, themePrimary }) {
  const [failed, setFailed] = useState(false);
  const imgClass =
    ownershipState === "complete" ? "" :
    ownershipState === "partial"  ? "opacity-60" :
    "grayscale opacity-55";
  if (failed || !src) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 text-center ${imgClass}`}
        style={{ background: `linear-gradient(135deg, ${themePrimary}33, #050507)` }}
      >
        <div className="text-[11px] font-bold leading-tight line-clamp-3" style={{ color: themePrimary }}>
          {name || "—"}
        </div>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover transition-all duration-300 ${imgClass}`}
    />
  );
}
