import { requireAdmin } from "@/lib/admin-server";
import { NextResponse } from "next/server";

const VALID_STATUSES = new Set(["open", "in_progress", "resolved", "dismissed"]);

export async function PATCH(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase } = guard;

  const { reportId } = await params;
  const body = await request.json().catch(() => ({}));
  const { status, resolution_note } = body;

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Build update payload based on target status:
  // - resolved / dismissed: set resolved_at + accept optional resolution_note
  // - open (reopen): clear resolved_at; resolution_note PRESERVED as history
  // - in_progress: status only, no date or note changes
  const updates = { status };

  if (status === "resolved" || status === "dismissed") {
    updates.resolved_at = new Date().toISOString();
    if (resolution_note !== undefined) {
      updates.resolution_note = resolution_note || null;
    }
  } else if (status === "open") {
    updates.resolved_at = null;
  }

  const { data, error } = await supabase
    .from("card_reports")
    .update(updates)
    .eq("id", reportId)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Silent-RLS-drop guard — same pattern as user_reports dismiss route.
  if (!data?.length) {
    console.error("[admin card-reports status] update returned no rows (silent RLS drop?):", { reportId, status });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
