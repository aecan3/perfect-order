"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Star, Users, Settings, LogOut, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

export default function YouPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ sets: 0, grandMasters: 0, cards: 0, favs: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      const [
        { data: profileData },
        { count: setCount },
        { count: gmCount },
        { count: cardsCount },
        { count: favsCount },
      ] = await Promise.all([
        supabase.from("profiles").select("handle, display_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_sets").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("grand_master_completions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("collection_entries")
          .select("printing:printings!inner(collection_tier)", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("checked", true)
          .eq("printing.collection_tier", "master"),
        supabase.from("favourites").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setProfile(profileData);
      setStats({
        sets: setCount || 0,
        grandMasters: gmCount || 0,
        cards: cardsCount || 0,
        favs: favsCount || 0,
      });
      setLoading(false);
    })();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/welcome");
  };

  if (loading) {
    return (
      <MSShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  const handle = profile?.handle || "";
  const displayName = profile?.display_name || handle;
  const initials = handle.slice(0, 2).toUpperCase() || "??";

  const menuRows = [
    { Icon: User, label: "Profile", href: "/settings", hint: null },
    { Icon: Star, label: "Favourites", href: "/favourites", hint: `${stats.favs} / 6`, iconColor: "var(--ms-gold)" },
    { Icon: Users, label: "Friends", href: "/friends", hint: null },
    { Icon: Settings, label: "Settings", href: "/settings", hint: null },
  ];

  return (
    <MSShell>
      <div style={{ padding: "0 16px 32px" }}>
        <MSPageTitle sub={`@${handle}`}>You</MSPageTitle>

        {/* Profile card */}
        <div style={{
          marginTop: 12,
          padding: 16,
          borderRadius: 4,
          background: "var(--ms-bg-elev)",
          border: "1px solid var(--ms-rule)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Accent top glow */}
          <div aria-hidden="true" style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 1,
            background: "var(--ms-accent)",
            boxShadow: "0 0 14px var(--ms-accent)",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Avatar */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 4,
              background: "var(--ms-accent)",
              color: "var(--ms-accent-ink)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}>
              {initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "space-between" }}>
                <span style={{
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  fontWeight: 700,
                  fontSize: 18,
                  color: "var(--ms-ink)",
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  @{handle}
                </span>
                <Link href="/settings" style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 10,
                  color: "var(--ms-accent)",
                  letterSpacing: "0.18em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  textDecoration: "none",
                  flexShrink: 0,
                }}>
                  EDIT
                </Link>
              </div>
              <div style={{
                marginTop: 4,
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 10,
                color: "var(--ms-dim)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}>
                {stats.sets} {stats.sets === 1 ? "SET" : "SETS"} · {stats.grandMasters} {stats.grandMasters === 1 ? "GRAND MASTER" : "GRAND MASTERS"} · {stats.cards} {stats.cards === 1 ? "CARD" : "CARDS"}
              </div>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 11,
          color: "var(--ms-faint)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          margin: "24px 0 8px 0",
        }}>
          Account
        </div>

        {/* Menu rows */}
        <div style={{ borderRadius: 4, overflow: "hidden", border: "1px solid var(--ms-rule)" }}>
          {menuRows.map(({ Icon, label, href, hint, iconColor }, i) => (
            <Link
              key={label}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 16px",
                background: "var(--ms-bg-elev)",
                textDecoration: "none",
                borderBottom: i < menuRows.length - 1 ? "1px solid var(--ms-rule-soft)" : "none",
              }}
            >
              <span style={{ display: "inline-flex", color: iconColor || "var(--ms-dim)", flexShrink: 0 }}>
                <Icon size={22} strokeWidth={2} />
              </span>
              <span style={{
                flex: 1,
                fontFamily: '"IBM Plex Sans", sans-serif',
                fontWeight: 500,
                fontSize: 15,
                color: "var(--ms-ink)",
                letterSpacing: "-0.005em",
              }}>
                {label}
              </span>
              {hint && (
                <span style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 12,
                  color: "var(--ms-faint)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {hint}
                </span>
              )}
              <span style={{ display: "inline-flex", color: "var(--ms-faint)", flexShrink: 0 }}>
                <ChevronRight size={18} strokeWidth={2} />
              </span>
            </Link>
          ))}

          {/* Sign out — button, not link, no chevron */}
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 16px",
              background: "var(--ms-bg-elev)",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", color: "var(--ms-danger)", flexShrink: 0 }}>
              <LogOut size={22} strokeWidth={2} />
            </span>
            <span style={{
              flex: 1,
              fontFamily: '"IBM Plex Sans", sans-serif',
              fontWeight: 500,
              fontSize: 15,
              color: "var(--ms-danger)",
              letterSpacing: "-0.005em",
            }}>
              Sign out
            </span>
          </button>
        </div>
      </div>
    </MSShell>
  );
}
