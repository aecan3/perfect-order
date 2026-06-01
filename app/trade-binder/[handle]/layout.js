import { getServiceClient } from "@/lib/supabase/service";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const service = getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("handle, display_name")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) {
    return { title: "Trade Binder — Master Setter" };
  }

  const displayName = profile.display_name || `@${profile.handle}`;
  const title = `${displayName}'s Trade Binder — Master Setter`;
  const description = `Browse ${displayName}'s tradeable Pokémon TCG cards on Master Setter.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function TradeBinderLayout({ children }) {
  return children;
}
