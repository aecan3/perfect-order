import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// Map foil keywords to printing_type arrays.
// "holo" must NOT match reverse_holofoil — explicit list, no substring matching.
const MULTI_FOIL_PHRASES = [
  // Longer phrases first so "reverse holo" is caught before "holo" token
  ["first edition",  ["first_edition_holofoil"]],
  ["first ed",       ["first_edition_holofoil"]],
  ["1st edition",    ["first_edition_holofoil"]],
  ["reverse holo",   ["reverse_holofoil", "masterball_reverse_holofoil", "pokeball_reverse_holofoil"]],
  ["non-holo",       ["normal"]],
  ["non holo",       ["normal"]],
  ["master ball",    ["masterball_reverse_holofoil"]],
  ["poke ball",      ["pokeball_reverse_holofoil"]],
];

const SINGLE_TOKEN_FOIL = {
  holo:          ["holofoil"],
  holofoil:      ["holofoil"],
  reverse:       ["reverse_holofoil", "masterball_reverse_holofoil", "pokeball_reverse_holofoil"],
  rev:           ["reverse_holofoil", "masterball_reverse_holofoil", "pokeball_reverse_holofoil"],
  normal:        ["normal"],
  nonholo:       ["normal"],
  "non-holo":    ["normal"],
  "1st":         ["first_edition_holofoil"],
  unlimited:     ["unlimited", "unlimited_holofoil"],
  masterball:    ["masterball_reverse_holofoil"],
  pokeball:      ["pokeball_reverse_holofoil"],
};

function parseSearchQuery(raw) {
  let q = raw.toLowerCase().trim().replace(/\s+/g, " ");

  let printTypes = null;

  // Check multi-word foil phrases before splitting on whitespace
  for (const [phrase, types] of MULTI_FOIL_PHRASES) {
    if (q.includes(phrase)) {
      q = q.replace(phrase, " ").replace(/\s+/g, " ").trim();
      printTypes = types;
      break;
    }
  }

  const tokens = q.split(" ").filter(Boolean);
  const nameTokens = [];
  let cardNumber = null;

  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      cardNumber = parseInt(tok, 10);
    } else if (!printTypes && SINGLE_TOKEN_FOIL[tok]) {
      printTypes = SINGLE_TOKEN_FOIL[tok];
    } else if (tok.length >= 2) {
      nameTokens.push(tok);
    }
  }

  return { nameTokens, cardNumber, printTypes };
}

export async function GET(req) {
  // Auth gate
  const anonClient = await getAnonClient();
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("q") || "").trim();

  if (!raw || raw.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { nameTokens, cardNumber, printTypes } = parseSearchQuery(raw);

  // Require at least one meaningful filter so we don't return the whole catalogue
  if (nameTokens.length === 0 && cardNumber === null && printTypes === null) {
    return NextResponse.json({ results: [] });
  }

  const service = getServiceClient();
  const { data, error } = await service.rpc("search_tradeable_printings", {
    p_name_tokens:  nameTokens.length > 0 ? nameTokens : null,
    p_card_number:  cardNumber,
    p_print_types:  printTypes,
    p_limit:        24,
  });

  if (error) {
    console.error("[search] RPC error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data || []).map((row) => ({
    printing_id:    row.printing_id,
    card_id:        row.card_id,
    set_id:         row.set_id,
    card_number:    row.card_number,
    printing_type:  row.printing_type,
    collection_tier: row.collection_tier,
    card_name:      row.card_name,
    image_url:      row.image_large,
    set_name:       row.set_name,
    set_code:       row.set_code,
  }));

  return NextResponse.json({ results });
}
