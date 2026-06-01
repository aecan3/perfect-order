import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getListingsForUser } from "@/lib/marketplace/listings-for-user";

const MIN_PRICE_USD = 5;
const MAX_FAV_LIMIT = 6;
const VARIETY_MAX_AGE_MINUTES = 2880; // 2 days — wider window for variety pool coverage

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

async function handleListings(request, { excludeIds = [], tradeCount = 0, marketplaceId: bodyMarketplaceId } = {}) {
  const supabase = await getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const marketplaceId = bodyMarketplaceId || searchParams.get("marketplaceId")?.trim() || "EBAY_AU";

  try {
    const service = getServiceClient();

    // Tile count scales with friend trade density: new users get 36 tiles,
    // power users with many friend dupes get fewer (min 8).
    const desiredEbayCount = Math.max(8, Math.round(36 - tradeCount * 1.5));
    const favouriteQuotaCount = Math.floor(desiredEbayCount * 0.2);

    // Favourites get up to 20% of eBay tile slots (price-filtered, not already seen).
    // Unused favourite slots roll into variety.
    let favouriteIds = [];
    if (favouriteQuotaCount > 0) {
      const { data: favRows } = await service
        .from("favourites")
        .select("printing_id")
        .eq("user_id", user.id)
        .limit(MAX_FAV_LIMIT);

      const rawFavIds = (favRows || []).map((r) => r.printing_id).filter(Boolean);

      if (rawFavIds.length > 0) {
        const { data: priceRows } = await service
          .from("printings")
          .select("id")
          .in("id", rawFavIds)
          .gte("price_usd", MIN_PRICE_USD);

        favouriteIds = (priceRows || [])
          .map((r) => r.id)
          .filter((id) => !excludeIds.includes(id))
          .slice(0, favouriteQuotaCount);
      }
    }

    // Remaining slots filled from variety pool: cards in user's active sets
    // they don't own, with a warmed marketplace_pool entry.
    const varietyCount = desiredEbayCount - favouriteIds.length;
    const excludeForRpc = [...excludeIds, ...favouriteIds];

    const { data: varietyRows, error: rpcErr } = await service.rpc(
      "get_marketplace_variety_for_user",
      {
        viewer: user.id,
        marketplace_id_param: marketplaceId,
        exclude_printing_ids: excludeForRpc,
        limit_count: varietyCount,
      }
    );

    if (rpcErr) throw new Error(`variety RPC failed: ${rpcErr.message}`);

    const varietyIds = (varietyRows || []).map((r) => r.printing_id);
    const targetPrintingIds = [...favouriteIds, ...varietyIds];

    const { listings } = await getListingsForUser(targetPrintingIds, {
      marketplaceId,
      maxAgeMinutes: VARIETY_MAX_AGE_MINUTES,
    });

    return NextResponse.json({ mode: "variety", listings });
  } catch (err) {
    console.error("[marketplace/listings] failed:", err.message);
    return NextResponse.json({ error: "Failed to load marketplace listings" }, { status: 502 });
  }
}

export async function GET(request) {
  return handleListings(request);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return handleListings(request, {
    excludeIds: Array.isArray(body.excludeIds) ? body.excludeIds : [],
    tradeCount: typeof body.tradeCount === "number" ? body.tradeCount : 0,
    marketplaceId: typeof body.marketplaceId === "string" ? body.marketplaceId : undefined,
  });
}
