import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { getServiceClient } from "@/lib/supabase/service";

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// Crop the full-photo base64 to the given normalized bbox, padded to avoid clipping
// the card's bottom edge (where the set symbol + collector number live).
async function cropCard(base64Data, bbox, padFraction = 0.12) {
  const buffer = Buffer.from(base64Data, "base64");
  const { width, height } = await sharp(buffer).metadata();

  const padX = bbox.w * padFraction;
  const padY = bbox.h * padFraction;
  const x0 = Math.max(0, bbox.x - padX);
  const y0 = Math.max(0, bbox.y - padY);
  const x1 = Math.min(1, bbox.x + bbox.w + padX);
  const y1 = Math.min(1, bbox.y + bbox.h + padY);

  const left  = Math.round(x0 * width);
  const top   = Math.round(y0 * height);
  const cropW = Math.max(1, Math.round((x1 - x0) * width));
  const cropH = Math.max(1, Math.round((y1 - y0) * height));

  const cropBuffer = await sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .jpeg({ quality: 80 })
    .toBuffer();

  return cropBuffer.toString("base64");
}

// Send a single card crop to the AI and ask only for set name/code + collector number.
// Returns { set_name, set_code, card_number } or null on parse/network failure.
async function refocusCard(anthropic, cropBase64, cardName) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: cropBase64 } },
          {
            type: "text",
            text: `This is a cropped photo of a single Pokémon TCG card named "${cardName}".
Look at the bottom of the card and return a single JSON object — no prose, no markdown:
{"set_name": "full set name or null", "set_code": "short code e.g. MEW, PAF or null", "card_number": <integer or null>}
- card_number: integer before the slash in the collector number (e.g. "098/102" → 98).
- set_code: short code printed near the collector number.
- Return null for any field you cannot read clearly.`,
          },
        ],
      }],
    });
    const text     = response.content[0]?.text || "";
    const objMatch = text.match(/\{[\s\S]*\}/);
    return objMatch ? JSON.parse(objMatch[0]) : null;
  } catch (err) {
    console.error("[scan/refocus] AI call failed:", err.message);
    return null;
  }
}

// Resolve each AI-identified card to matching master-tier printings.
// Returns the matched rows plus a resolution status tag.
//
// Uses 3 sequential queries so every filter lands on a root-table column.
// PostgREST embedded-resource filters (e.g. .ilike("card.name", x)) silently
// apply to the root table when the column doesn't exist there, returning 0 rows.
async function matchBack(service, aiCard) {
  const { card_name, card_number, set_name, set_code_hint } = aiCard;

  if (!card_name) {
    return { aiCard, matches: [], status: "none", reason: "no card_name" };
  }

  // Step 1: find matching card rows — name and optional number on root cards table.
  let cardQuery = service
    .from("cards")
    .select("id, name, number, set_id, rarity, image_large")
    .ilike("name", card_name);
  if (card_number !== null && card_number !== undefined) {
    cardQuery = cardQuery.eq("number", card_number);
  }
  const { data: cardRows, error: cardErr } = await cardQuery;
  if (cardErr) {
    console.error("[scan/match-back] cards query error:", cardErr.message);
    return { aiCard, matches: [], status: "none", reason: cardErr.message };
  }
  // TEMP DIAGNOSTIC — Stage 1 results
  console.log(`[scan/mb1] "${card_name}" #${card_number} → ${cardRows?.length ?? 0} card rows:`,
    (cardRows || []).map((c) => `id=${c.id} set_id=${c.set_id} num=${c.number}`).join(" | "));

  if (!cardRows?.length) {
    return { aiCard, matches: [], status: "none", reason: "no matching cards" };
  }

  // Step 2 (optional): resolve set IDs from name/code — root filters on sets table.
  let setIds = null;
  if (set_name || set_code_hint) {
    let setQuery = service.from("sets").select("id, name, code");
    if (set_name && set_code_hint) {
      setQuery = setQuery.or(`name.ilike.%${set_name}%,code.ilike.${set_code_hint}`);
    } else if (set_name) {
      setQuery = setQuery.ilike("name", `%${set_name}%`);
    } else {
      setQuery = setQuery.ilike("code", set_code_hint);
    }
    const { data: setRows } = await setQuery;
    if (setRows?.length) setIds = setRows.map((s) => s.id);
    // TEMP DIAGNOSTIC — Stage 2 results
    console.log(`[scan/mb2] "${card_name}" set hint name="${set_name}" code="${set_code_hint}" → ${setRows?.length ?? 0} set rows: setIds=${JSON.stringify(setIds)}`);
  } else {
    // TEMP DIAGNOSTIC — Stage 2 skipped
    console.log(`[scan/mb2] "${card_name}" no set hint — skipping set filter`);
  }

  // Step 3: find master printings — all filters on root printings columns.
  const cardIds = cardRows.map((c) => c.id);

  // TEMP DIAGNOSTIC — query without set filter to see tier count
  const { data: allPrintRows } = await service
    .from("printings")
    .select("id, printing_type, card_id, set_id, collection_tier")
    .in("card_id", cardIds);
  console.log(`[scan/mb3] "${card_name}" all printings for card_ids=${JSON.stringify(cardIds)}: ${allPrintRows?.length ?? 0} rows`);
  const masterRows = (allPrintRows || []).filter((p) => p.collection_tier === "master");
  console.log(`[scan/mb3] "${card_name}" after collection_tier=master: ${masterRows.length} rows`);
  const setFilteredRows = setIds ? masterRows.filter((p) => setIds.includes(p.set_id)) : masterRows;
  console.log(`[scan/mb3] "${card_name}" after set_id filter (setIds=${JSON.stringify(setIds)}): ${setFilteredRows.length} rows`);

  let printQuery = service
    .from("printings")
    .select("id, printing_type, card_id, set_id")
    .in("card_id", cardIds)
    .eq("collection_tier", "master");
  if (setIds) printQuery = printQuery.in("set_id", setIds);

  const { data: printRows, error: printErr } = await printQuery;
  if (printErr) {
    console.error("[scan/match-back] printings query error:", printErr.message);
    return { aiCard, matches: [], status: "none", reason: printErr.message };
  }
  if (!printRows?.length) {
    return { aiCard, matches: [], status: "none", reason: "no master printings" };
  }

  // Step 4: fetch set display names for the result set_ids.
  const resultSetIds = [...new Set(printRows.map((p) => p.set_id))];
  const { data: resultSets } = await service
    .from("sets")
    .select("id, name, code")
    .in("id", resultSetIds);
  const setMap  = Object.fromEntries((resultSets || []).map((s) => [s.id, s]));
  const cardMap = Object.fromEntries(cardRows.map((c) => [c.id, c]));

  const matches = printRows.map((p) => ({
    printing_id:   p.id,
    printing_type: p.printing_type,
    set_id:        p.set_id,
    set_name:      setMap[p.set_id]?.name,
    set_code:      setMap[p.set_id]?.code,
    card_name:     cardMap[p.card_id]?.name,
    card_number:   cardMap[p.card_id]?.number,
    rarity:        cardMap[p.card_id]?.rarity,
    image_url:     cardMap[p.card_id]?.image_large,
  }));

  // Sort candidates so the most-likely match leads:
  //   1. printing_type matches AI's hint → rank 0 (best)
  //   2. hint absent or no match → rank 1
  //   Secondary: stable by set_id so order is deterministic across renders.
  const hint = aiCard.printing_type_hint;
  matches.sort((a, b) => {
    const ra = (hint && a.printing_type === hint) ? 0 : 1;
    const rb = (hint && b.printing_type === hint) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return (a.set_id || "").localeCompare(b.set_id || "");
  });

  let status;
  if (matches.length === 0)     status = "none";
  else if (matches.length === 1) status = "auto";
  else if (matches.length === 2) status = "variant";
  else                           status = "set";

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
      max_tokens: 2000,
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
  "card_number": <integer from the card's collector number, e.g. 98, or null if truly unreadable>,
  "set_name": "full set name if visible, or null",
  "set_code_hint": "short set code printed on the card if visible (e.g. POR, SIT), or null",
  "printing_type_hint": "holofoil" | "reverse_holofoil" | "normal" | null,
  "confidence": "high" | "medium" | "low",
  "bbox": {"x": <0-1>, "y": <0-1>, "w": <0-1>, "h": <0-1>}
}
Rules:
- card_number: Look carefully at the bottom of the card for a number like "098/102" or "25/185". Return the integer before the slash (e.g. 98). Try hard — zoom in mentally, use context clues like card art and name to infer the set total. Only return null if the number is genuinely obscured or outside the frame.
- printing_type_hint: "holofoil" if the card art is holographic; "reverse_holofoil" if only the card border/background shimmers but the art is flat; "normal" if no holo effect is visible; null if uncertain.
- bbox: normalized bounding box of where this card sits in the photo. x and y are the top-left corner (0=left/top edge of photo, 1=right/bottom edge). w and h are the card's width and height as a fraction of the full photo dimensions. For a 3×3 binder grid, each card occupies roughly 0.33 of the photo in each axis.
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

  // TEMP DIAGNOSTIC — log the exact AI read for every card before matchBack
  identified.forEach((card) => {
    console.log("[scan/aiCard]", JSON.stringify({
      card_name:           card.card_name,
      card_number:         card.card_number,
      set_name:            card.set_name,
      set_code_hint:       card.set_code_hint,
      printing_type_hint:  card.printing_type_hint,
      confidence:          card.confidence,
    }));
  });

  const results = await Promise.all(identified.map((card) => matchBack(service, card)));

  // --- Refocus: one cropped-image AI call per ambiguous card (status === "set") ---
  // Skips auto (already resolved), variant (foil choice — user picks anyway), none (wrong name).
  const toRefocus = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "set" && r.aiCard.bbox);

  if (toRefocus.length > 0) {
    await Promise.all(toRefocus.map(async ({ r, i }) => {
      try {
        const cropBase64  = await cropCard(base64Data, r.aiCard.bbox);
        const refocusData = await refocusCard(anthropic, cropBase64, r.aiCard.card_name);
        if (!refocusData) return;

        console.log(`[scan/refocus] "${r.aiCard.card_name}" read: set="${refocusData.set_name}", code="${refocusData.set_code}", num=${refocusData.card_number}`);

        const refinedAiCard = {
          ...r.aiCard,
          set_name:      refocusData.set_name    || r.aiCard.set_name,
          set_code_hint: refocusData.set_code    || r.aiCard.set_code_hint,
          card_number:   refocusData.card_number ?? r.aiCard.card_number,
        };

        const refined = await matchBack(service, refinedAiCard);
        // Only upgrade if refocus found matches — don't replace with an empty list
        if (refined.matches.length > 0) {
          console.log(`[scan/refocus] "${r.aiCard.card_name}" ${r.matches.length} → ${refined.matches.length} candidates (${r.status} → ${refined.status})`);
          results[i] = refined;
        }
      } catch (err) {
        console.error(`[scan/refocus] "${r.aiCard.card_name}" failed:`, err.message);
      }
    }));
  }

  // Summary counts (computed after refocus so counts reflect refined results)
  const summary = {
    identified: identified.length,
    auto:       results.filter((r) => r.status === "auto").length,
    variant:    results.filter((r) => r.status === "variant").length,
    set:        results.filter((r) => r.status === "set").length,
    none:       results.filter((r) => r.status === "none").length,
    refocused:  toRefocus.length,
  };

  console.log("[scan] complete", summary);

  return NextResponse.json({ summary, results });
}
