"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { track, EVENTS } from "@/lib/track";

// Canonical short referral link for TikTok (/tt) — publish this in the bio.
// Renders nothing visible; fires referral_landing then lands in the set catalog
// so viewers browse immediately (Door B handles conversion). /start is the legacy alias.
export default function TikTokLandingPage() {
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
