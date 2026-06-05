import { getServiceClient } from "@/lib/supabase/service";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const service = getServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("handle, display_name")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) return { title: "Player Profile" };

  const displayName = profile.display_name || `@${profile.handle}`;
  const title = `${displayName}'s Collection`;
  const description = `Browse ${displayName}'s Pokémon TCG collection on Master Setter.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ["/brand/master-setter-stacked-email.png"],
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default function FriendLayout({ children }) {
  return children;
}
