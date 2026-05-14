"use client";

import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

export default function SettingsPage() {
  return (
    <MSShell>
      <MSPageTitle>Settings</MSPageTitle>
      <div style={{
        padding: "24px 18px",
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontSize: 15,
        color: "var(--ms-dim)",
        lineHeight: 1.6,
      }}>
        Settings will live here. Coming soon.
      </div>
    </MSShell>
  );
}
