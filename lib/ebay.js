const EBAY_MARKETS = {
  AU: { campaignId: process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_AU, domain: "ebay.com.au", siteId: 15 },
  US: { campaignId: process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_US, domain: "ebay.com",    siteId: 0  },
  UK: { campaignId: process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_UK, domain: "ebay.co.uk",  siteId: 3  },
  DE: { campaignId: process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_DE, domain: "ebay.de",     siteId: 77 },
  CA: { campaignId: process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_CA, domain: "ebay.ca",     siteId: 2  },
};

export function buildEbayUrl({ cardName, collectorNumber, rarity, userCountry }) {
  const market = EBAY_MARKETS[userCountry] ?? EBAY_MARKETS["AU"];
  const rarityTerm = rarity || "";
  const searchParts = [cardName, collectorNumber, rarityTerm, "Pokemon TCG"].filter(Boolean).join(" ");
  const searchTerm = encodeURIComponent(searchParts);
  return `https://www.${market.domain}/sch/i.html?_nkw=${searchTerm}&LH_PrefLoc=1&mkcid=1&mkrid=705-53470-19255-0&siteid=${market.siteId}&campid=${market.campaignId}&customid=&toolid=10001&mkevt=1`;
}
