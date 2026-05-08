import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const PTCG = "https://api.pokemontcg.io/v2/cards";

// camelCase → snake_case  (reverseHolofoil → reverse_holofoil)
const toSnake = (s) => s.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`);

export async function POST(request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse body ──────────────────────────────────────────────────────────
  let setIds;
  try {
    ({ setIds } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(setIds) || setIds.length === 0) {
    return Response.json({ error: "setIds required" }, { status: 400 });
  }

  // ── Admin client (bypasses RLS for printings writes) ────────────────────
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Process sets sequentially ───────────────────────────────────────────
  const results = [];
  for (const setId of setIds) {
    try {
      results.push(await processSet(admin, user.id, setId));
    } catch (err) {
      results.push({ setId, error: err.message });
    }
  }

  return Response.json({ results });
}

async function processSet(admin, userId, setId) {
  // 1. Load existing printings + user's owned set for this set in parallel
  const [{ data: allPrintings, error: pErr }, { data: owned, error: oErr }] = await Promise.all([
    admin.from("printings").select("id, price_usd").eq("set_id", setId),
    admin
      .from("collection_entries")
      .select("printing_id")
      .eq("user_id", userId)
      .eq("set_id", setId)
      .eq("checked", true),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (oErr) throw new Error(oErr.message);

  const existingIds = new Set((allPrintings || []).map((p) => p.id));
  const ownedIds = new Set((owned || []).map((e) => e.printing_id));

  // Previous collection value (USD) = sum of current prices for owned printings
  const previousValue = (allPrintings || [])
    .filter((p) => ownedIds.has(p.id))
    .reduce((s, p) => s + (Number(p.price_usd) || 0), 0);

  // 2. Fetch cards from pokemontcg.io (paginated)
  const priceMap = new Map(); // printingId → market price
  let page = 1, fetched = 0, totalCount = Infinity;

  while (fetched < totalCount) {
    const res = await fetch(
      `${PTCG}?q=set.id:${encodeURIComponent(setId)}&pageSize=250&page=${page}&select=id,tcgplayer`,
      {
        headers: {
          "X-Api-Key": process.env.POKEMON_TCG_API_KEY,
          "Accept": "application/json",
        },
      }
    );
    if (!res.ok) throw new Error(`TCG API ${res.status}`);
    const json = await res.json();

    totalCount = json.totalCount ?? json.count ?? 0;
    const cards = json.data || [];
    fetched += cards.length;

    for (const card of cards) {
      const prices = card.tcgplayer?.prices || {};
      for (const [tcgType, data] of Object.entries(prices)) {
        const market = data?.market;
        if (!market || market <= 0) continue;
        const pid = `${card.id}-${toSnake(tcgType)}`;
        if (existingIds.has(pid)) priceMap.set(pid, market);
      }
    }

    if (!cards.length || fetched >= totalCount) break;
    page++;
  }

  // 3. Bulk-update printings in batches of 200
  const updates = Array.from(priceMap.entries()).map(([id, price_usd]) => ({
    id,
    price_usd,
    updated_at: new Date().toISOString(),
  }));
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const { error: uErr } = await admin
      .from("printings")
      .upsert(updates.slice(i, i + BATCH), { onConflict: "id" });
    if (uErr) throw new Error(uErr.message);
  }

  // 4. New collection value = sum of refreshed prices for owned printings
  const newValue = Array.from(ownedIds).reduce((s, pid) => {
    const price = priceMap.has(pid)
      ? priceMap.get(pid)
      : Number((allPrintings || []).find((p) => p.id === pid)?.price_usd || 0);
    return s + price;
  }, 0);

  // 5. Stamp user_sets with previous_value + prices_updated_at
  await admin
    .from("user_sets")
    .update({
      previous_value: previousValue,
      prices_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("set_id", setId);

  return { setId, cardsUpdated: updates.length, previousValue, newValue };
}
