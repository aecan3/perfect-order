"use client";

import { useState, useEffect, useRef } from "react";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { BlockConfirmModal } from "@/components/BlockConfirmModal";
import PasskeySection from "@/components/PasskeySection";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase";
import { uploadAvatar } from "@/lib/avatar";
import BackButton from "@/components/BackButton";
import { subscribeToPush, unsubscribeFromPush, getPushState } from "@/lib/push/subscribe";
import { isPushSupported } from "@/lib/push/support";

export default function SettingsPage() {
  const supabase = createClient();
  const [userId, setUserId]               = useState(null);
  const [profile, setProfile]             = useState(null);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [blocks, setBlocks]               = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError]         = useState(null);
  // "loading" | "on" | "off" | "blocked" | "unsupported"
  const [pushState, setPushState]   = useState("loading");
  const [pushBusy, setPushBusy]     = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getPushState().then(setPushState);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [profileRes, blocksRes] = await Promise.all([
        supabase.from("profiles").select("handle, display_name, avatar_url, suburb, postcode, state").eq("id", user.id).single(),
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

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    fileInputRef.current.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const newUrl = await uploadAvatar(file, userId);
      setProfile((prev) => ({ ...prev, avatar_url: newUrl }));
    } catch (err) {
      setAvatarError(err.message || "Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  }

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
    <MSShell activeTab="you">
      <div style={{ padding: "8px 12px 0" }}>
        <BackButton href="/you" />
      </div>
      <MSPageTitle>Settings</MSPageTitle>

      <div style={{ padding: "24px 18px", fontFamily: '"IBM Plex Sans", sans-serif' }}>

        {/* ── Avatar ── */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ms-dim)",
            marginBottom: 12,
          }}>
            Profile photo
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar profile={profile} size={80} />
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid var(--ms-rule)",
                  borderRadius: 8,
                  color: avatarUploading ? "var(--ms-dim)" : "var(--ms-ink)",
                  fontSize: 14,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  cursor: avatarUploading ? "default" : "pointer",
                }}
              >
                {avatarUploading ? "Uploading…" : "Change photo"}
              </button>
              {avatarError && (
                <p style={{ fontSize: 12, color: "var(--ms-danger)", marginTop: 8 }}>{avatarError}</p>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: "none" }}
          />
        </section>

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

        {/* ── Sign-in / Passkey ── */}
        <PasskeySection />

        {/* ── Notifications ── */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ms-dim)",
            marginBottom: 12,
          }}>
            Notifications
          </h2>

          {pushState === "loading" && null}

          {pushState === "unsupported" && (
            <p style={{ fontSize: 13, color: "var(--po-text-dim)", lineHeight: 1.5 }}>
              Add Master Setter to your Home Screen to enable push notifications.
            </p>
          )}

          {pushState === "blocked" && (
            <p style={{ fontSize: 13, color: "var(--po-text-dim)", lineHeight: 1.5 }}>
              Notifications are blocked. To enable them, go to your device Settings and allow notifications for this app.
            </p>
          )}

          {(pushState === "on" || pushState === "off") && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--po-text)", margin: 0 }}>
                  Push notifications
                </p>
                <p style={{ fontSize: 12, color: "var(--po-text-dim)", margin: "2px 0 0" }}>
                  {pushState === "on" ? "You will receive push notifications." : "Enable to get notified about messages, trades, and more."}
                </p>
              </div>
              <button
                disabled={pushBusy}
                onClick={async () => {
                  setPushBusy(true);
                  if (pushState === "off") {
                    const sub = await subscribeToPush();
                    setPushState(sub ? "on" : (Notification.permission === "denied" ? "blocked" : "off"));
                  } else {
                    await unsubscribeFromPush();
                    setPushState("off");
                  }
                  setPushBusy(false);
                }}
                aria-label={pushState === "on" ? "Turn off push notifications" : "Turn on push notifications"}
                style={{
                  flexShrink: 0,
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  border: "none",
                  background: pushState === "on" ? "var(--po-green)" : "rgba(244,244,246,0.15)",
                  position: "relative",
                  cursor: pushBusy ? "default" : "pointer",
                  opacity: pushBusy ? 0.5 : 1,
                  transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: 3,
                  left: pushState === "on" ? 23 : 3,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                }} />
              </button>
            </div>
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
