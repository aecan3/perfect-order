"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ensureAttribution, track } from "@/lib/track";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    ensureAttribution();   // idempotent; captures first-touch on first call
    track("page_view");
  }, [pathname]);
  return null;
}
