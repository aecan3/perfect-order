"use client";

import { memo } from "react";
import { Check } from "lucide-react";
import { FindOnline } from "@/components/FindOnline";
import { CardArt } from "./CardArt";

// One card bubble + its under-row, extracted from the set page's renderCard
// closure. Every prop is a primitive, a stable-identity object (card row,
// active-prints array from the page's memoised map), or a stable callback —
// so React.memo (and the React Compiler) can skip cells whose card didn't
// change when a sibling is toggled. Do not pass page-level aggregate objects
// (ownedPrintings / favourites) into this component.
function CardCellInner({
  card,
  prints,
  checkedCount,
  modeTotal,
  completionState,
  priceLabel,
  photoUrl,
  tint,
  dotPattern,
  dupCount,
  tradeFlagged,
  isFav,
  isJustCollected,
  collectorNumber,
  themePrimary,
  userCountry,
  isAnonymous,
  onTapCard,
  onOpenPicker,
  onToggleFavourite,
  onDupChange,
  onFlagToggle,
}) {
  const photoImgClass =
    completionState === "complete" ? "" :
    completionState === "partial"  ? "opacity-60" :
    "grayscale opacity-30";
  const first = prints[0];

  return (
    <div className="flex flex-col">
      <div
        onClick={() => onTapCard(card)}
        className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden cursor-pointer select-none active:scale-[0.98] transition-transform"
        style={{
          boxShadow: isJustCollected
            ? "0 0 0 2px #22c55e, 0 0 18px rgba(34,197,94,0.5)"
            : completionState === "complete"
            ? `0 4px 20px rgba(0,0,0,0.5), 0 0 16px ${tint ? tint.replace(/[\d.]+\)$/, "0.4)") : "rgba(255,255,255,0.12)"}`
            : "0 2px 10px rgba(0,0,0,0.4)",
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={card.name}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-all duration-300 ${photoImgClass}`}
          />
        ) : (
          <CardArt src={card.image_small || card.image_large} name={card.name} ownershipState={completionState} themePrimary={themePrimary} />
        )}
        {completionState !== "complete" && tint && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: tint }} />
        )}
        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
          {String(card.number).padStart(3, "0")}
        </div>
        {completionState === "complete" && (
          <div
            className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: themePrimary, color: "#000", boxShadow: `0 0 8px ${themePrimary}80` }}
          >
            <Check size={16} strokeWidth={3} />
          </div>
        )}
        {completionState === "partial" && (
          <div
            className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
            style={{ background: `${themePrimary}30`, color: themePrimary, border: `1px solid ${themePrimary}80` }}
          >
            {checkedCount}/{modeTotal}
          </div>
        )}
        {priceLabel !== null && (
          <div
            className="absolute bottom-1 right-1 bg-black/70 text-[9px] px-1 py-0.5 rounded font-mono leading-none"
            style={{ color: themePrimary }}
          >
            {priceLabel}
          </div>
        )}
        {prints.length === 1 && tradeFlagged && (
          <div
            className="absolute top-1 left-1 text-[8px] font-bold px-1 py-0.5 rounded leading-none"
            style={{ background: "rgba(200,255,74,0.18)", color: "#c8ff4a", border: "1px solid rgba(200,255,74,0.45)" }}
          >
            TRADE
          </div>
        )}
        {completionState !== "complete" && (
          <FindOnline
            cardName={card.name}
            collectorNumber={collectorNumber}
            rarity={card.rarity}
            userCountry={userCountry}
          />
        )}
        {completionState !== "complete" && prints.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleFavourite(card, first.id, isFav);
            }}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              zIndex: 10,
              background: "rgba(7,7,10,0.75)",
              backdropFilter: "blur(4px)",
              border: "none",
              borderRadius: "50%",
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 15,
              color: isFav ? "#FFB830" : "rgba(244,244,246,0.35)",
              lineHeight: 1,
            }}
          >
            {isFav ? "★" : "☆"}
          </button>
        )}
      </div>
      {prints.length === 1 ? (
        checkedCount > 0 && (
          <div
            className="flex items-center justify-center gap-1 mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            {dupCount > 0 && (
              <>
                <button
                  onClick={() => onDupChange(first.id, -1)}
                  className="w-5 h-5 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-xs flex items-center justify-center leading-none hover:text-[var(--po-text)]"
                >
                  −
                </button>
                <span
                  className="text-[10px] font-bold tabular-nums w-4 text-center"
                  style={{ color: themePrimary }}
                >
                  {dupCount}
                </span>
              </>
            )}
            <button
              onClick={() => onDupChange(first.id, 1)}
              className="w-5 h-5 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-xs flex items-center justify-center leading-none hover:text-[var(--po-text)]"
            >
              +
            </button>
            {!isAnonymous && (
              <button
                onClick={() => onFlagToggle(first.id)}
                title={tradeFlagged ? "Remove from trade binder" : "Add to trade binder"}
                className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center leading-none"
                style={{
                  background: tradeFlagged ? "rgba(200,255,74,0.15)" : "var(--po-bg-soft)",
                  border: `1px solid ${tradeFlagged ? "#c8ff4a" : "var(--po-border)"}`,
                  color: tradeFlagged ? "#c8ff4a" : "var(--po-text-dim)",
                }}
              >
                ⇄
              </button>
            )}
          </div>
        )
      ) : (
        <div
          style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 4, cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); onOpenPicker(card); }}
        >
          {prints.map((p, i) => {
            const isOwnedDot = dotPattern[i] === "1";
            return (
              <div
                key={p.id}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isOwnedDot ? themePrimary : "transparent",
                  border: `1.5px solid ${isOwnedDot ? themePrimary : "var(--po-border)"}`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export const CardCell = memo(CardCellInner);
