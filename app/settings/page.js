"use client";

import { useState, useEffect } from "react";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { BlockConfirmModal } from "@/components/BlockConfirmModal";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile]             = useState(null);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [blocks, setBlocks]               = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, blocksRes] = await Promise.all([
        supabase.from("profiles").select("suburb, postcode, state").eq("id", user.id).single(),
        fetch("/api/block/list"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      if (blocksRes.ok) {
        const { blocks: list } = await blocksRes.json();
        setBlocks(list || []);
      } else {
        setBlocks([]);
      }
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

        {/* ── Blocked Users ── */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ms-dim)",
            marginBottom: 12,
          }}>
            Blocked Users
          </h2>

          {blocks === null && null}

          {blocks?.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--ms-dim)" }}>You haven&apos;t blocked anyone.</p>
          )}

          {blocks?.length > 0 && (
            <div>
              {blocks.map((block) => (
                <div
                  key={block.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(244,244,246,0.07)",
                  }}
                >
                  <div>
                    {block.display_name && (
                      <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(244,244,246,0.9)", margin: 0 }}>
                        {block.display_name}
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: "rgba(244,244,246,0.4)", margin: block.display_name ? "2px 0 0" : 0 }}>
                      @{block.handle}
                    </p>
                  </div>
                  <button
                    onClick={() => setUnblockTarget({ blocked_id: block.blocked_id, handle: block.handle })}
                    style={{
                      padding: "7px 14px",
                      background: "transparent",
                      border: "1px solid rgba(244,244,246,0.2)",
                      borderRadius: 8,
                      color: "rgba(244,244,246,0.7)",
                      fontSize: 13,
                      fontFamily: '"IBM Plex Sans", sans-serif',
                      cursor: "pointer",
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      <BlockConfirmModal
        mode="unblock"
        open={!!unblockTarget}
        onClose={() => setUnblockTarget(null)}
        targetHandle={unblockTarget?.handle ?? ""}
        targetUserId={unblockTarget?.blocked_id ?? ""}
        onSuccess={() => {
          setBlocks((prev) => prev.filter((b) => b.blocked_id !== unblockTarget?.blocked_id));
          setUnblockTarget(null);
        }}
      />
    </MSShell>
  );
}
