// HIDDEN FOR LAUNCH: Grand Master stat cell deliberately disabled in this file.
// To re-enable: add stats.grandMasters to the stats row in ProfileView.
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, LogOut, ChevronRight, Share2, QrCode } from "lucide-react";
import { LazyQRCode } from "@/components/LazyQRCode";
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
  const [shareCopied, setShareCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [wantLists, setWantLists] = useState([]);
  const [wantListCopied, setWantListCopied] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmDeleteTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      const uid = user.id;

      const [
        { data: profileData },
        { count: setCount },
        { data: cardsCount },
        duplicatesData,
        { data: favData },
        { data: friendshipRows },
        { data: wantListsData },
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
        supabase.rpc("get_cards_count", { p_user_id: uid }),
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
        supabase
          .from("want_lists")
          .select("id, slug, created_at, title")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
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

      // Fetch per-list card counts (two-query split — PostgREST can't aggregate nested)
      const listIds = (wantListsData || []).map(l => l.id);
      let wantListsWithCount = (wantListsData || []).map(l => ({ ...l, card_count: 0 }));
      if (listIds.length > 0) {
        const { data: cardRows } = await supabase
          .from("want_list_cards")
          .select("want_list_id")
          .in("want_list_id", listIds)
          .limit(5000);
        if (!cancelled) {
          const countMap = {};
          for (const r of (cardRows || [])) {
            countMap[r.want_list_id] = (countMap[r.want_list_id] || 0) + 1;
          }
          wantListsWithCount = wantListsWithCount.map(l => ({ ...l, card_count: countMap[l.id] || 0 }));
        }
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
      setWantLists(wantListsWithCount);
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

  const handleShare = async () => {
    const url = `${window.location.origin}/trade-binder/${profile?.handle}`;
    const text = `Check out my Pokémon TCG Trade Binder on Master Setter`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url, text, title: "My Trade Binder" });
      } catch (e) {
        // user cancelled — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch (e) {
        console.error("Clipboard write failed:", e);
      }
    }
  };

  const openQr = () => {
    setQrOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setQrVisible(true)));
  };
  const closeQr = () => {
    setQrVisible(false);
    setTimeout(() => setQrOpen(false), 260);
  };

  useEffect(() => {
    if (!qrOpen) return;
    const fn = (e) => { if (e.key === "Escape") closeQr(); };
    document.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/welcome");
  };

  const handleDeleteWantList = async (slug, id) => {
    clearTimeout(confirmDeleteTimerRef.current);
    setConfirmDeleteId(null);
    const res = await fetch(`/api/want-lists/${slug}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      setWantLists(prev => prev.filter(l => l.id !== id));
    }
  };

  const handleDeleteTap = (slug, id) => {
    if (confirmDeleteId === id) {
      handleDeleteWantList(slug, id);
    } else {
      clearTimeout(confirmDeleteTimerRef.current);
      setConfirmDeleteId(id);
      confirmDeleteTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3500);
    }
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

  const binderUrl = profile?.handle
    ? `${window.location.origin}/trade-binder/${profile.handle}`
    : null;

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

      {/* My Want Lists */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--po-text-dim)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>
            My Want Lists
          </span>
        </div>

        {wantLists.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--po-text-faint)", padding: "4px 0 12px" }}>
            No want lists yet.
          </div>
        ) : (
          wantLists.map(list => {
            const dateStr = new Date(list.created_at).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            });
            const wantUrl = `${window.location.origin}/wants/${list.slug}`;
            const confirming = confirmDeleteId === list.id;
            const copied = wantListCopied === list.slug;
            return (
              <div
                key={list.id}
                onClick={() => router.push(`/wants/${list.slug}`)}
                style={{
                  marginBottom: 8, padding: "12px 14px",
                  background: "rgba(244,244,246,0.03)",
                  border: "0.5px solid var(--po-border)",
                  borderRadius: "var(--border-radius-md)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--po-text)", marginBottom: 2 }}>
                      {list.title || `${list.card_count} card${list.card_count !== 1 ? "s" : ""}`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--po-text-faint)" }}>
                      {list.title
                        ? `${list.card_count} card${list.card_count !== 1 ? "s" : ""} · ${dateStr}`
                        : dateStr}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        await navigator.clipboard.writeText(wantUrl).catch(() => {});
                        setWantListCopied(list.slug);
                        setTimeout(() => setWantListCopied(null), 2000);
                      }}
                      style={{
                        padding: "6px 10px",
                        background: copied ? "rgba(200,255,74,0.18)" : "rgba(200,255,74,0.08)",
                        border: "0.5px solid rgba(200,255,74,0.25)",
                        borderRadius: 6,
                        color: "var(--po-green)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {copied ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteTap(list.slug, list.id); }}
                      style={{
                        padding: "6px 10px",
                        background: confirming ? "rgba(255,90,106,0.15)" : "rgba(244,244,246,0.06)",
                        border: `0.5px solid ${confirming ? "rgba(255,90,106,0.4)" : "rgba(244,244,246,0.15)"}`,
                        borderRadius: 6,
                        color: confirming ? "var(--ms-danger)" : "var(--po-text-faint)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s, color 0.15s",
                      }}
                    >
                      {confirming ? "Confirm?" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <Link
          href="/want-lists/new"
          style={{
            display: "block", textAlign: "center", padding: "12px 16px",
            background: "none",
            border: "0.5px solid var(--po-border)",
            borderRadius: "var(--border-radius-md)",
            color: "var(--po-text-dim)", fontSize: 13, fontWeight: 500,
            textDecoration: "none",
          }}
        >
          + Create Want List
        </Link>
      </div>

      {/* Share Trade Binder */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 16px",
              background: shareCopied ? "rgba(200,255,74,0.18)" : "rgba(200,255,74,0.08)",
              border: "0.5px solid rgba(200,255,74,0.25)",
              borderRadius: "var(--border-radius-md)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <Share2 size={16} style={{ color: "var(--po-green)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--po-green)" }}>
              {shareCopied ? "Link copied!" : "Share my Trade Binder"}
            </span>
          </button>
          {binderUrl && (
            <button
              onClick={openQr}
              aria-label="Show QR code"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "13px",
                background: "rgba(200,255,74,0.08)",
                border: "0.5px solid rgba(200,255,74,0.25)",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <QrCode size={16} style={{ color: "var(--po-green)" }} />
            </button>
          )}
        </div>
      </div>

      {/* QR sheet portal */}
      {qrOpen && binderUrl && createPortal(
        <>
          <div
            onClick={closeQr}
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              background: "rgba(0,0,0,0.65)",
              opacity: qrVisible ? 1 : 0,
              transition: "opacity 260ms ease",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Trade binder QR code"
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
              background: "#0a0a0b",
              transform: qrVisible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 260ms ease",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
              borderRadius: "16px 16px 0 0",
              padding: "12px 20px 32px",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#3f3f46", margin: "0 auto 16px" }} />
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--po-text-dim)", marginBottom: 20 }}>
              Scan to see my trade binder
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
                <LazyQRCode value={binderUrl} size={200} fgColor="#000000" bgColor="#ffffff" />
              </div>
            </div>
            <p style={{
              textAlign: "center", fontSize: 11, color: "var(--po-text-faint)",
              fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
              marginBottom: 20, wordBreak: "break-all", padding: "0 8px",
            }}>
              {binderUrl}
            </p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(binderUrl);
                  setQrCopied(true);
                  setTimeout(() => setQrCopied(false), 2000);
                } catch (e) {
                  console.error("Clipboard write failed:", e);
                }
              }}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 16px",
                background: qrCopied ? "rgba(200,255,74,0.18)" : "rgba(200,255,74,0.08)",
                border: "0.5px solid rgba(200,255,74,0.25)",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                transition: "background 0.15s",
                marginBottom: 12,
              }}
            >
              <Share2 size={16} style={{ color: "var(--po-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--po-green)" }}>
                {qrCopied ? "Link copied!" : "Copy link"}
              </span>
            </button>
            <button
              type="button"
              onClick={closeQr}
              style={{
                display: "block", width: "100%", padding: "12px 0",
                textAlign: "center", fontSize: 14, color: "#a1a1aa",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </>,
        document.body
      )}

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
