import { requireAdmin } from "@/lib/admin-server";
import { NextResponse } from "next/server";

export async function PATCH(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase } = guard;

  const { reportId } = await params;
  const body = await request.json().catch(() => ({}));
  const resolution_note = body.resolution_note || null;

  const { data, error } = await supabase
    .from("user_reports")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolution_note,
    })
    .eq("id", reportId)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Silent-RLS-drop guard — same pattern as POST /api/block.
  // If the UPDATE matched no rows, Supabase returns { data: [], error: null }.
  if (!data?.length) {
    console.error("[admin dismiss] update returned no rows (silent RLS drop?):", { reportId });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ dismissed: true });
}
