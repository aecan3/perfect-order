import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getAnonClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// Owner delete — authed client, RLS enforces ownership
// Public read is handled server-side by app/wants/[slug]/page.js (no API consumer)
export async function DELETE(_req, { params }) {
  const { slug } = await params;
  const supabase = await getAnonClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error, count } = await supabase
    .from("want_lists")
    .delete({ count: "exact" })
    .eq("slug", slug)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new Response(null, { status: 204 });
}
