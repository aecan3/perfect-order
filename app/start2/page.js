"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Attribution landing page for Instagram links.
// Renders nothing visible — the Analytics component in the root layout
// records the /start2 pageview before router.replace fires.
export default function Start2Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/welcome");
  }, [router]);
  return null;
}
