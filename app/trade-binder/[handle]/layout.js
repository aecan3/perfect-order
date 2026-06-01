import { getServiceClient } from "@/lib/supabase/service";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const service = getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("handle, display_name, avatar_url")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) {
    return { title: "Trade Binder — Master Setter" };
  }

  const displayName = profile.display_name || `@${profile.handle}`;
  const title = `${displayName}'s Trade Binder — Master Setter`;
  const description = `Browse ${displayName}'s tradeable Pokémon TCG cards on Master Setter.`;
  const ogImage = profile.avatar_url || null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default function TradeBinderLayout({ children }) {
  return children;
}
