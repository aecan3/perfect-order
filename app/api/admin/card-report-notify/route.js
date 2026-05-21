import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const WEBHOOK_SECRET    = process.env.CARD_REPORT_WEBHOOK_SECRET;
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY    = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = "hello@mastersettertcg.com";
const FROM_ADDRESS      = "Master Setter <noreply@send.mastersettertcg.com>";

// TEMPORARY — remove once env var issue is resolved
console.log("[card-report-notify] module load env:", {
  has_secret: !!WEBHOOK_SECRET,
  secret_len: WEBHOOK_SECRET?.length ?? 0,
  has_resend: !!RESEND_API_KEY,
  has_service_key: !!SUPABASE_SERVICE_KEY,
  has_supabase_url: !!SUPABASE_URL,
});

const CATEGORY_LABELS = {
  wrong_image:            "Wrong image",
  wrong_name_or_number:   "Wrong name or number",
  wrong_rarity:           "Wrong rarity",
  wrong_price:            "Wrong price",
  missing_card_or_variant:"Missing card or variant",
  other:                  "Other",
};

export async function POST(request) {
  // 1. Shared-secret auth — Supabase sends this in the Authorization header.
  const authHeader = request.headers.get("authorization");
  // TEMPORARY — remove once env var issue is resolved
  console.log("[card-report-notify] request auth check:", {
    header_present: !!authHeader,
    header_starts_with_bearer: authHeader?.startsWith("Bearer ") ?? false,
    env_secret_present_at_request_time: !!WEBHOOK_SECRET,
    match: authHeader === `Bearer ${WEBHOOK_SECRET}`,
  });
  if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse payload (Supabase webhook shape: { type, table, record, ... })
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "card_reports") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const report = payload.record;
  if (!report?.id) {
    return NextResponse.json({ error: "missing_record" }, { status: 400 });
  }

  // 3. Fetch reporter handle — service role bypasses RLS.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: reporter } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", report.reporter_id)
    .single();

  const reporterHandle = reporter?.handle ?? "(unknown)";

  // 4. Build plain-text email body.
  const projectRef = SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const deepLink = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/editor?table=card_reports`
    : "https://supabase.com/dashboard";

  const categoryLabel = CATEGORY_LABELS[report.category] ?? report.category;

  const body = [
    "A new card report has been submitted.",
    "",
    `Category:  ${categoryLabel}`,
    `Submitted: ${new Date(report.created_at).toISOString()}`,
    `Reporter:  @${reporterHandle} (id: ${report.reporter_id})`,
    "",
    "Details:",
    report.details,
    "",
    `View in Supabase: ${deepLink}`,
    "",
    `Report ID: ${report.id}`,
  ].join("\n");

  // 5. Send via Resend.
  const resend = new Resend(RESEND_API_KEY);
  const { error: emailError } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: NOTIFICATION_EMAIL,
    subject: `New card report — ${categoryLabel}`,
    text: body,
  });

  if (emailError) {
    console.error("[card-report-notify] Resend error:", emailError);
    // Return 200 intentionally — the report is safe in the DB. A non-2xx
    // response would trigger Supabase webhook retries, causing duplicate
    // emails if Resend is degraded rather than fully down.
    return NextResponse.json({ ok: true, email_failed: true });
  }

  return NextResponse.json({ ok: true });
}
