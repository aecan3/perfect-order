"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { track, EVENTS } from "@/lib/track";

// Attribution landing page for TikTok links.
// Renders nothing visible — the Analytics component in the root layout
// records the /start pageview before router.replace fires.
// Lands in the set catalog so viewers browse immediately; Door B handles conversion.
export default function StartPage() {
  const router = useRouter();
  const firedRef = useRef(false);
  useEffect(() => {
    // referral_landing — explicit named-source signal, fired before the redirect.
    // track() is sendBeacon-first so it survives the navigation.
    if (!firedRef.current) {
      firedRef.current = true;
      track(EVENTS.REFERRAL_LANDING, { source: "tiktok" });
    }
    router.replace("/sets");
  }, [router]);
  return null;
}
