"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { track, EVENTS } from "@/lib/track";

// Canonical short referral link for Instagram (/ig) — publish this in the bio.
// Renders nothing visible; fires referral_landing then lands in the set catalog
// so viewers browse immediately (Door B handles conversion). /start2 is the legacy alias.
export default function InstagramLandingPage() {
  const router = useRouter();
  const firedRef = useRef(false);
  useEffect(() => {
    // referral_landing — explicit named-source signal, fired before the redirect.
    // track() is sendBeacon-first so it survives the navigation.
    if (!firedRef.current) {
      firedRef.current = true;
      track(EVENTS.REFERRAL_LANDING, { source: "instagram" });
    }
    router.replace("/sets");
  }, [router]);
  return null;
}
