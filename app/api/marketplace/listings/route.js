import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { refreshStaleForUser } from "@/lib/marketplace/fetch";
import { getListingsForUser } from "@/lib/marketplace/listings-for-user";

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
    const { mode, targetPrintingIds, refreshed, skipped, errors } = await refreshStaleForUser(user.id, {
      marketplaceId,
    });

    const { listings } = await getListingsForUser(targetPrintingIds, {
      marketplaceId,
    });

    return NextResponse.json({ mode, listings });
  } catch (err) {
    console.error("[marketplace/listings] failed:", err.message);
    return NextResponse.json(
      { error: "Failed to load marketplace listings" },
      { status: 502 }
    );
  }
}
