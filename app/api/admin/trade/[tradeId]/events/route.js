import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { tradeId } = await params;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { supabase } = guard;

  const { data: events, error } = await supabase
    .from("trade_events")
    .select("id, trade_id, user_id, event_type, detail, created_at")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tradeId, events: events || [] });
}
