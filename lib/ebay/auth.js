const TOKEN_ENDPOINT = "https://api.ebay.com/identity/v1/oauth2/token";
const SCOPE = "https://api.ebay.com/oauth/api_scope";
const REFRESH_AT_SECONDS = 6300; // refresh at 105 min; eBay tokens are 7200s

// Keyed by "AppID:CertID" so dev and prod tokens don't collide in the same process
const cache = new Map();

export async function getEbayAccessToken() {
  const appId  = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    throw new Error("EBAY_APP_ID and EBAY_CERT_ID must be set as server-only env vars");
  }

  const cacheKey = `${appId}:${certId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay OAuth failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const token = json.access_token;
  const expiresAt = Date.now() + REFRESH_AT_SECONDS * 1000;

  cache.set(cacheKey, { token, expiresAt });
  return token;
}
