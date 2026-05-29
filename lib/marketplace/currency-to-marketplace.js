/**
 * Map a user's currency preference (po:currency from localStorage) to the
 * eBay marketplace ID used by the Browse API.
 *
 * Mirrors the convention used in lib/ebay.js and the FindOnline UI:
 * currency is the user-facing preference; marketplaceId is the API token.
 */
const CURRENCY_TO_MARKETPLACE = {
  AUD: "EBAY_AU",
  USD: "EBAY_US",
  GBP: "EBAY_GB",
  EUR: "EBAY_DE",
  CAD: "EBAY_CA",
};

export function currencyToMarketplace(currency) {
  return CURRENCY_TO_MARKETPLACE[currency] || "EBAY_AU";
}

/**
 * Read the user's stored currency preference and map to a marketplaceId.
 * Client-side only (relies on localStorage). Safe to call during render
 * with a default fallback — the SSR pass returns the fallback, the
 * client hydration corrects it.
 */
export function getUserMarketplaceId() {
  if (typeof window === "undefined") return "EBAY_AU";
  try {
    const currency = window.localStorage.getItem("po:currency");
    return currencyToMarketplace(currency);
  } catch {
    return "EBAY_AU";
  }
}
