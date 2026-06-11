// Single source of truth for display currencies. Prices are stored in USD
// everywhere (priceUsd is canonical); these static rates and symbols are
// display-only. Pure constants, client-safe, no server imports.
//
// This file is generated-by-script on purpose: raw currency symbols in
// these lines have a history of encoding corruption when hand-edited.
export const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
  CAD: { rate: 1.37, symbol: "C$" },
};

// Selector options render from this, in insertion order: AUD, USD, GBP, CAD.
export const CURRENCY_OPTIONS = Object.keys(RATES);

// Currency preference -> FindOnline/eBay market region (lib/ebay.js keys).
export const CURRENCY_TO_COUNTRY = { AUD: "AU", USD: "US", GBP: "UK", CAD: "CA" };
