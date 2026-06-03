import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "@/lib/supabase/service";

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// Resolve each AI-identified card to matching master-tier printings.
// Returns the matched rows plus a resolution status tag.
async function matchBack(service, aiCard) {
  const { card_name, card_number, set_name, set_code_hint } = aiCard;

  if (!card_name) {
    return { aiCard, matches: [], status: "none", reason: "no card_name" };
  }

  // Build the query — set name + code both tried via OR so a partially-right
  // AI guess on either field still resolves.
  let query = service
    .from("printings")
    .select(`
      id,
      printing_type,
      collection_tier,
      card:cards!inner(
        name,
        number,
        set_id,
        rarity
      ),
      set:sets!inner(
        id,
        name,
        code
      )
    `)
    .eq("collection_tier", "master")
    .ilike("card.name", card_name);

  if (card_number !== null && card_number !== undefined) {
    query = query.eq("card.number", card_number);
  }

  // Set filter: match on set name OR set code if AI provided either
  const setFilters = [];
  if (set_name) setFilters.push(`set.name.ilike.%${set_name}%`);
  if (set_code_hint) setFilters.push(`set.code.ilike.${set_code_hint}`);
  if (setFilters.length > 0) {
    query = query.or(setFilters.join(","));
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("[scan/match-back] query error:", error.message);
    return { aiCard, matches: [], status: "none", reason: error.message };
  }

  const matches = (rows || []).map((p) => ({
    printing_id:   p.id,
    printing_type: p.printing_type,
    set_id:        p.card?.set_id,
    set_name:      p.set?.name,
    set_code:      p.set?.code,
    card_name:     p.card?.name,
    card_number:   p.card?.number,
    rarity:        p.card?.rarity,
  }));

  let status;
  if (matches.length === 0)     status = "none";
  else if (matches.length === 1) status = "auto";
  else if (matches.length === 2) status = "variant";   // typically normal + reverse_holofoil
  else                           status = "set";        // multiple sets or many printings

  return { aiCard, matches, status };
}

export async function POST(req) {
  // Auth gate — user session required
  const anonClient = await getAnonClient();
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.imageBase64) {
    return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
  }

  // Parse media type from the data URL prefix.
  // Anthropic supports: image/jpeg, image/png, image/gif, image/webp.
  // HEIC is not supported. Browsers usually transcode HEIC to JPEG when reading
  // via FileReader, but a raw HEIC upload would arrive as image/heic or image/heif.
  const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  const prefixMatch = body.imageBase64.match(/^data:(image\/[\w.+-]+);base64,/);
  const detectedType = prefixMatch ? prefixMatch[1].toLowerCase() : "image/jpeg";

  if (detectedType === "image/heic" || detectedType === "image/heif") {
    return NextResponse.json(
      { error: "HEIC images are not supported. Please use JPEG or PNG." },
      { status: 400 }
    );
  }
  if (!SUPPORTED_TYPES.has(detectedType)) {
    return NextResponse.json(
      { error: `Unsupported image format "${detectedType}". Supported: JPEG, PNG, GIF, WebP.` },
      { status: 400 }
    );
  }

  const base64Data = prefixMatch
    ? body.imageBase64.slice(prefixMatch[0].length)
    : body.imageBase64;

  // --- AI identification ---
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let identified;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: detectedType, data: base64Data },
            },
            {
              type: "text",
              text: `Identify every Pokémon TCG card visible in this photo.
Return ONLY a JSON array — no prose, no markdown, no explanation.
Each element must follow this exact shape:
{
  "card_name": "exact name printed on the card",
  "card_number": <integer from the card's collector number, e.g. 98, or null if unreadable>,
  "set_name": "full set name if visible, or null",
  "set_code_hint": "short set code printed on the card if visible (e.g. POR, SIT), or null",
  "printing_type_hint": "holofoil" | "reverse_holofoil" | "normal" | null,
  "confidence": "high" | "medium" | "low"
}
Rules:
- card_number is the number before the slash (e.g. for "098/102" return 98).
- printing_type_hint: "holofoil" if the card art is holographic; "reverse_holofoil" if only the card border/background shimmers but the art is flat; "normal" if no holo effect is visible; null if uncertain.
- Use "low" confidence rather than guessing a wrong name or number.
- Include every card you can see, even partially. Omit only cards where nothing is readable.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.text || "";
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    identified = arrayMatch ? JSON.parse(arrayMatch[0]) : null;
  } catch (err) {
    console.error("[scan] AI call failed:", err.message);
    return NextResponse.json({ error: "AI identification failed: " + err.message }, { status: 500 });
  }

  if (!Array.isArray(identified)) {
    console.error("[scan] AI response did not parse to array");
    return NextResponse.json({ error: "Could not parse AI response as array" }, { status: 500 });
  }

  // --- Match-back: resolve each identified card to DB printings ---
  const service = getServiceClient();
  const results = await Promise.all(identified.map((card) => matchBack(service, card)));

  // Summary counts for quick inspection
  const summary = {
    identified:  identified.length,
    auto:        results.filter((r) => r.status === "auto").length,
    variant:     results.filter((r) => r.status === "variant").length,
    set:         results.filter((r) => r.status === "set").length,
    none:        results.filter((r) => r.status === "none").length,
  };

  console.log("[scan] complete", summary);

  return NextResponse.json({ summary, results });
}
