import { getEbayAccessToken } from "./auth";

const SEARCH_ENDPOINT = "https://api.ebay.com/buy/browse/v1/item_summary/search";

const MARKETPLACE_TO_COUNTRY = {
  EBAY_AU: "AU",
  EBAY_US: "US",
  EBAY_GB: "GB",
  EBAY_DE: "DE",
  EBAY_CA: "CA",
};

let epnWarningLogged = false;

/**
 * Search eBay Buy It Now listings and return normalised results.
 *
 * @param {{ query: string, marketplaceId: string, limit?: number }} options
 * @returns {Promise<Array>}
 */
export async function searchBuyItNow({ query, marketplaceId, limit = 200 }) {
  const token = await getEbayAccessToken();

  const countryCode = MARKETPLACE_TO_COUNTRY[marketplaceId] || "AU";
  const params = new URLSearchParams({
    q: query,
    filter: `buyingOptions:{FIXED_PRICE},itemLocationCountry:${countryCode}`,
    limit: String(limit),
  });

  const headers = {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
  };

  const campaignId = process.env.EBAY_EPN_CAMPAIGN_ID;
  if (campaignId) {
    headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${campaignId}`;
  } else if (!epnWarningLogged) {
    console.warn("[ebay/browse] EBAY_EPN_CAMPAIGN_ID is not set — listings will use bare itemWebUrl, not EPN-tagged URLs. Enrol at partnernetwork.ebay.com to earn commissions.");
    epnWarningLogged = true;
  }

  const res = await fetch(`${SEARCH_ENDPOINT}?${params}`, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay Browse API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  const items = json.itemSummaries || [];

  return items.map((item) => ({
    sourceListingId: item.itemId ?? null,
    title:           item.title ?? null,
    price: {
      amount:   item.price?.value   ? Number(item.price.value) : null,
      currency: item.price?.currency ?? null,
    },
    imageUrl:   item.image?.imageUrl ?? null,
    listingUrl: item.itemAffiliateWebUrl ?? item.itemWebUrl ?? null,
    seller: {
      username:    item.seller?.username        ?? null,
      feedbackPct: item.seller?.feedbackPercentage
        ? Number(item.seller.feedbackPercentage)
        : null,
    },
    condition: item.condition ?? null,
  }));
}
