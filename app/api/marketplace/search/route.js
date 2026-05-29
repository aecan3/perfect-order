import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { searchBuyItNow } from "@/lib/ebay/browse";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q             = searchParams.get("q")?.trim();
  const marketplaceId = searchParams.get("marketplaceId")?.trim() || "EBAY_AU";

  if (!q) {
    return NextResponse.json({ error: "q parameter is required" }, { status: 400 });
  }

  try {
    const listings = await searchBuyItNow({ query: q, marketplaceId });
    return NextResponse.json({ listings });
  } catch (err) {
    console.error("[marketplace/search] eBay call failed:", err.message);
    return NextResponse.json({ error: "Failed to fetch listings from eBay" }, { status: 502 });
  }
}
