import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getServiceClient } from "@/lib/supabase/service";
import { ANALYTICS_EVENT_SET } from "@/lib/analytics-events";

const MAX_ID = 100;
const MAX_STR = 500;
const MAX_PROPS_BYTES = 4096;

function clean(v, max) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

async function deriveUserId() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null; // never let auth resolution break event ingestion
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const event_name =
    typeof body.event_name === "string" ? body.event_name : null;
  if (!event_name || !ANALYTICS_EVENT_SET.has(event_name)) {
    return NextResponse.json({ error: "invalid event_name" }, { status: 400 });
  }

  const anon_id = clean(body.anon_id, MAX_ID);
  const session_id = clean(body.session_id, MAX_ID);
  if (!anon_id || !session_id) {
    return NextResponse.json(
      { error: "anon_id and session_id required" },
      { status: 400 }
    );
  }

  let props = {};
  if (body.props != null) {
    if (typeof body.props !== "object" || Array.isArray(body.props)) {
      return NextResponse.json(
        { error: "props must be an object" },
        { status: 400 }
      );
    }
    if (Buffer.byteLength(JSON.stringify(body.props), "utf8") > MAX_PROPS_BYTES) {
      return NextResponse.json({ error: "props too large" }, { status: 400 });
    }
    props = body.props;
  }

  const user_id = await deriveUserId();

  const row = {
    event_name,
    anon_id,
    session_id,
    user_id,
    utm_source: clean(body.utm_source, MAX_ID),
    utm_medium: clean(body.utm_medium, MAX_ID),
    utm_campaign: clean(body.utm_campaign, MAX_ID),
    referrer: clean(body.referrer, MAX_STR),
    path: clean(body.path, MAX_STR),
    props,
  };

  try {
    const admin = getServiceClient();
    const { error } = await admin.from("analytics_events").insert(row);
    if (error) {
      Sentry.captureException(error, { tags: { location: "track-insert" } });
      return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { location: "track-insert-throw" } });
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
