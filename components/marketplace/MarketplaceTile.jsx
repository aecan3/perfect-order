"use client";

/**
 * One marketplace listing as a tile in the Discover grid.
 *
 * CRITICAL: image is from cards.image_large (listing.card_image_large),
 * NEVER listing.image_url (the seller's photo — overlay only).
 */
export function MarketplaceTile({ listing, onTap }) {
  const cardArt = listing.card_image_large;

  return (
    <button
      type="button"
      onClick={() => onTap(listing)}
      className="relative block w-full overflow-hidden rounded-lg"
      style={{
        aspectRatio: "2.5/3.5",
        boxShadow:
          "0 0 0 1px rgba(0,99,217,0.4), 0 0 12px rgba(0,99,217,0.25)",
      }}
    >
      {cardArt ? (
        <img
          src={cardArt}
          alt={listing.card_name || listing.title || "Marketplace listing"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}

      {/* eBay badge — official wordmark from eBay's creative pack */}
      <img
        src="/marketplace/ebay-logo.png"
        alt="eBay"
        style={{
          position: "absolute",
          top: "6px",
          right: "6px",
          width: "32px",
          height: "32px",
          borderRadius: "6px",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.3)",
        }}
      />

      {/* Price — bottom gradient overlay */}
      <div
        className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-left"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))",
        }}
      >
        <div className="text-sm font-bold leading-tight text-white">
          {formatPrice(listing.price_amount, listing.price_currency)}
        </div>
      </div>
    </button>
  );
}

function formatPrice(amount, currency) {
  const n = Number(amount);
  if (Number.isNaN(n)) return "";
  return `${currency || "USD"} ${n.toFixed(2)}`;
}
