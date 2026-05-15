"use client";

import { useState, useEffect } from "react";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("suburb, postcode, state")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, []);

  async function handleSuburbChange(selection) {
    if (!selection) return;
    setSaving(true);
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("profiles").update({
      suburb: selection.suburb,
      postcode: selection.postcode,
      state: selection.state,
    }).eq("id", user.id);

    setProfile((prev) => ({ ...prev, ...selection }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const currentLocation = profile?.suburb
    ? { suburb: profile.suburb, postcode: profile.postcode, state: profile.state }
    : null;

  return (
    <MSShell>
      <MSPageTitle>Settings</MSPageTitle>

      <div style={{ padding: "24px 18px", fontFamily: '"IBM Plex Sans", sans-serif' }}>

        {/* ── Location ── */}
        {/* NOTE: SuburbAutocomplete is also the entry point for the location-
            fallback flow triggered by "Not now" on the GPS permission prompt
            (Parts 1-4 of the location-permission flow, not yet built). When
            that flow is implemented, render <SuburbAutocomplete> inline there
            and call the same handleSuburbChange-style save logic. */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ms-dim)",
            marginBottom: 12,
          }}>
            Location
          </h2>

          <p style={{ fontSize: 14, color: "var(--ms-dim)", marginBottom: 14, lineHeight: 1.5 }}>
            {currentLocation
              ? "Your suburb is used for trading location matching."
              : "Set your suburb so traders nearby can find you. No GPS required."}
          </p>

          <SuburbAutocomplete
            value={currentLocation}
            onChange={handleSuburbChange}
            placeholder="Search suburb..."
          />

          {saving && (
            <p style={{ fontSize: 12, color: "var(--ms-dim)", marginTop: 8 }}>Saving...</p>
          )}
          {saved && (
            <p style={{ fontSize: 12, color: "var(--ms-green)", marginTop: 8 }}>Location saved.</p>
          )}
        </section>

        {/* ── Placeholder for future sections ── */}
        <section style={{ fontSize: 14, color: "var(--ms-dim)", lineHeight: 1.6 }}>
          More settings coming soon.
        </section>

      </div>
    </MSShell>
  );
}
