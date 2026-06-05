"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Attribution landing page for TikTok links.
// Renders nothing visible — the Analytics component in the root layout
// records the /start pageview before router.replace fires.
// Lands in the set catalog so viewers browse immediately; Door B handles conversion.
export default function StartPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sets");
  }, [router]);
  return null;
}
