// HIDDEN FOR LAUNCH: Grand Master stat cell deliberately disabled in this file.
// To re-enable: add stats.grandMasters to the stats row in ProfileView.
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, LogOut, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { ProfileView } from "@/components/profile/ProfileView";
import { Avatar } from "@/components/Avatar";
import { uploadAvatar } from "@/lib/avatar";
import { fetchUserDuplicates } from "@/lib/queries/duplicates";

export default function YouPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ sets: 0, cards: 0, duplicates: 0 });
  const [favourites, setFavourites] = useState([]);
  const [friends, setFriends] = useState({ count: 0, sample: [] });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      const uid = user.id;

      const [
        { data: profileData },
        { count: setCount },
        { count: cardsCount },
        duplicatesData,
        { data: favData },
        { data: friendshipRows },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("handle, display_name, avatar_url")
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("user_sets")
          .select("*", { count: "exact", head: true })
          .eq("user_id", uid),
        supabase
          .from("collection_entries")
          .select("printing:printings!inner(collection_tier)", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("checked", true)
          .eq("printing.collection_tier", "master"),
        fetchUserDuplicates(supabase, uid, uid),
        supabase
          .from("favourites")
          .select("printing_id, printing:printings!inner(price_usd, card:cards!printings_card_id_fkey(name, image_large))")
          .eq("user_id", uid)
          .limit(50),
        supabase
          .from("friendships")
          .select("user_a, user_b")
          .or(`user_a.eq.${uid},user_b.eq.${uid}`)
          .eq("status", "accepted"),
      ]);

      if (cancelled) return;

      // Sort favourites by price DESC (nulls last), take top 6
      const sortedFavs = [...(favData || [])]
        .sort((a, b) => (Number(b.printing?.price_usd) || 0) - (Number(a.printing?.price_usd) || 0))
        .slice(0, 6);

      // Resolve friend profiles for the face-pile (up to 5)
      const friendIds = (friendshipRows || []).map(f => f.user_a === uid ? f.user_b : f.user_a);
      let sampleProfiles = [];
      if (friendIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("handle, avatar_url")
          .in("id", friendIds.slice(0, 5));
        if (!cancelled) sampleProfiles = profData || [];
      }

      if (cancelled) return;

      setUserId(uid);
      setProfile(profileData);
      setStats({
        sets: setCount || 0,
        cards: cardsCount || 0,
        duplicates: duplicatesData.length,
      });
      setFavourites(sortedFavs);
      setFriends({ count: friendIds.length, sample: sampleProfiles });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  const handleChangePhoto = () => {
    if (photoUploading) return;
    setPhotoError(null);
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const newUrl = await uploadAvatar(file, userId);
      setProfile(prev => ({ ...prev, avatar_url: newUrl }));
    } catch (err) {
      setPhotoError(err.message || "Upload failed.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/welcome");
  };

  if (loading) {
    return (
      <MSShell activeTab="you">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 200, color: "var(--ms-dim)",
        }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  // ── Slots passed into ProfileView ────────────────────────────────────────

  const headerAction = (
    <Link
      href="/settings"
      aria-label="Settings"
      style={{ color: "var(--po-text-dim)" }}
    >
      <Settings size={20} />
    </Link>
  );

  const footer = (
    <>
      {/* Friends face-pile — whole card taps to /friends */}
      <Link href="/friends" style={{ marginBottom: 24, display: "block", textDecoration: "none", color: "inherit" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--po-text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            Friends
          </span>
          <span style={{ fontSize: 13, color: "var(--po-text-dim)" }}>
            {friends.count} ›
          </span>
        </div>

        {friends.count === 0 ? (
          <div style={{ fontSize: 13, color: "var(--po-text-faint)", padding: "4px 0" }}>
            No friends yet.{" "}
            <span style={{ color: "var(--po-green)" }}>Find some ›</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center" }}>
            {friends.sample.map((f, i) => (
              <div
                key={f.handle ?? i}
                style={{
                  marginLeft: i === 0 ? 0 : -10,
                  position: "relative",
                  zIndex: friends.sample.length - i,
                  borderRadius: "50%",
                  border: "2px solid var(--po-bg)",
                  lineHeight: 0,
                  flexShrink: 0,
                }}
              >
                <Avatar profile={f} size={38} />
              </div>
            ))}
            {friends.count > 5 && (
              <div style={{
                marginLeft: -10,
                width: 38, height: 38,
                borderRadius: "50%",
                background: "rgba(244,244,246,0.1)",
                border: "2px solid var(--po-bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: "var(--po-text-dim)",
                position: "relative",
                zIndex: 0,
                flexShrink: 0,
              }}>
                +{friends.count - 5}
              </div>
            )}
          </div>
        )}
      </Link>

      {/* Account menu */}
      <div style={{ borderTop: "0.5px solid rgba(244,244,246,0.08)", paddingTop: 20 }}>
        <Link
          href="/settings"
          style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 0",
            textDecoration: "none",
            borderBottom: "0.5px solid rgba(244,244,246,0.06)",
          }}
        >
          <Settings size={18} style={{ color: "var(--po-text-dim)", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--po-text)" }}>
            Settings
          </span>
          <ChevronRight size={16} style={{ color: "var(--po-text-faint)", flexShrink: 0 }} />
        </Link>
        <button
          onClick={handleSignOut}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 14,
            padding: "14px 0",
            background: "none", border: "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <LogOut size={18} style={{ color: "var(--ms-danger)", flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ms-danger)" }}>
            Sign out
          </span>
        </button>
      </div>
    </>
  );

  return (
    <MSShell activeTab="you">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      {photoError && (
        <div style={{
          margin: "8px 16px 0",
          padding: "8px 12px",
          background: "rgba(255,90,106,0.1)",
          border: "0.5px solid rgba(255,90,106,0.3)",
          borderRadius: "var(--border-radius-md)",
          fontSize: 13,
          color: "var(--ms-danger)",
        }}>
          {photoError}
        </div>
      )}
      <ProfileView
        isOwnProfile={true}
        handle={profile?.handle || ""}
        profile={profile}
        stats={stats}
        favourites={favourites}
        headerAction={headerAction}
        footer={footer}
        onChangePhoto={handleChangePhoto}
      />
    </MSShell>
  );
}
