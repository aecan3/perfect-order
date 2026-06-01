import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getListingsForUser } from "@/lib/marketplace/listings-for-user";

const MIN_PRICE_USD = 5;
const RANDOM_FILL_COUNT = 20;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function GET(request) {
  const supabase = await getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const marketplaceId = searchParams.get("marketplaceId")?.trim() || "EBAY_AU";

  try {
    const service = getServiceClient();

    // Determine which printings to show: favourites (price-filtered) or random pool sample.
    const { data: favRows } = await service
      .from("favourites")
      .select("printing_id")
      .eq("user_id", user.id)
      .limit(6);

    const rawFavIds = (favRows || []).map((r) => r.printing_id).filter(Boolean);

    let targetPrintingIds;
    let mode;

    if (rawFavIds.length > 0) {
      const { data: priceRows } = await service
        .from("printings")
        .select("id")
        .in("id", rawFavIds)
        .gte("price_usd", MIN_PRICE_USD);
      targetPrintingIds = (priceRows || []).map((r) => r.id);
      mode = "favourites";
    } else {
      const { data: pool } = await service
        .from("marketplace_pool")
        .select("printing_id")
        .eq("enabled", true)
        .not("last_refreshed_at", "is", null);
      const shuffled = (pool || []).slice().sort(() => Math.random() - 0.5);
      targetPrintingIds = shuffled.slice(0, RANDOM_FILL_COUNT).map((r) => r.printing_id);
      mode = "random";
    }

    const { listings } = await getListingsForUser(targetPrintingIds, { marketplaceId });

    return NextResponse.json({ mode, listings });
  } catch (err) {
    console.error("[marketplace/listings] failed:", err.message);
    return NextResponse.json(
      { error: "Failed to load marketplace listings" },
      { status: 502 }
    );
  }
}
