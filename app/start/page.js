"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Attribution landing page for TikTok links.
// Renders nothing visible — the Analytics component in the root layout
// records the /start pageview before router.replace fires.
export default function StartPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/welcome");
  }, [router]);
  return null;
}
