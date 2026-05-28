"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { fetchUserDuplicates } from "@/lib/queries/duplicates";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import BackButton from "@/components/BackButton";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};

function fmtMoney(priceUsd, currency) {
  const { rate, symbol } = RATES[currency] || RATES.AUD;
  const val = priceUsd * rate;
  return `${symbol}${val < 10 ? val.toFixed(2) : Math.round(val)}`;
}

export default function DuplicatesPage() {
  const { handle } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState("loading"); // loading | ok | not-found | not-friends
  const [viewerId, setViewerId] = useState(null);
  const [viewerHandle, setViewerHandle] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const currency = "AUD";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/welcome"); return; }

      // Resolve target handle → profile
      const { data: targetProf } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .eq("handle", handle)
        .maybeSingle();

      if (cancelled) return;
      if (!targetProf) { setStatus("not-found"); return; }

      // Resolve viewer's own handle for isOwnPage check
      const { data: viewerProf } = await supabase
        .from("profiles")
        .select("id, handle")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const isOwnPage = user.id === targetProf.id;

      if (!isOwnPage) {
        // Privacy: only friends can view each other's duplicates
        const { data: friendship } = await supabase
          .from("friendships")
          .select("id")
          .or(`and(user_a.eq.${user.id},user_b.eq.${targetProf.id}),and(user_a.eq.${targetProf.id},user_b.eq.${user.id})`)
          .eq("status", "accepted")
          .maybeSingle();

        if (cancelled) return;
        if (!friendship) { setStatus("not-friends"); return; }
      }

      setViewerId(user.id);
      setViewerHandle(viewerProf?.handle || "");
      setTargetProfile(targetProf);

      const data = await fetchUserDuplicates(supabase, targetProf.id, user.id);
      if (cancelled) return;

      setDuplicates(data);
      setStatus("ok");
    })();
    return () => { cancelled = true; };
  }, [handle, router, supabase]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <MSShell>
        <div style={{ padding: "2rem 1.25rem", color: "var(--po-text-dim)", textAlign: "center" }}>
          Loading…
        </div>
      </MSShell>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <MSShell>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>User not found.</p>
        </div>
      </MSShell>
    );
  }

  // ── Not friends (privacy gate) ───────────────────────────────────────────
  if (status === "not-friends") {
    return (
      <MSShell>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "var(--po-text-dim)", fontSize: 14, lineHeight: 1.55 }}>
            You can only view duplicates from friends.<br />Add @{handle} as a friend first.
          </p>
        </div>
      </MSShell>
    );
  }

  // ── Resolved ─────────────────────────────────────────────────────────────
  const isOwnPage = viewerId && targetProfile && viewerId === targetProfile.id;
  const huntCount = duplicates.filter((d) => d.hunted_by_viewer).length;

  return (
    <MSShell>
      <div style={{ padding: "0 16px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <BackButton />
        </div>
        <MSPageTitle sub={`${duplicates.length} card${duplicates.length !== 1 ? "s" : ""} available to trade`}>
          {isOwnPage ? "Your duplicates" : `@${handle}'s duplicates`}
        </MSPageTitle>

        {/* Hunting-match banner — friend view only */}
        {!isOwnPage && huntCount > 0 && (
          <div style={{
            margin: "0 0 16px",
            padding: "10px 14px",
            background: "rgba(200,255,74,0.08)",
            border: "0.5px solid rgba(200,255,74,0.25)",
            borderRadius: "var(--border-radius-md)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <Star size={14} style={{ color: "var(--po-green)", flexShrink: 0 }} fill="var(--po-green)" />
            <span style={{ color: "var(--po-green)", fontSize: 13, fontWeight: 500 }}>
              {huntCount} of these match cards you&apos;re hunting
            </span>
          </div>
        )}

        {/* Empty state */}
        {duplicates.length === 0 && (
          <div style={{ padding: "3rem 0", textAlign: "center" }}>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>No duplicates available.</p>
          </div>
        )}

        {/* Card grid */}
        {duplicates.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}>
            {duplicates.map((card) => (
              <div
                key={card.printing_id}
                style={{
                  position: "relative",
                  borderRadius: "var(--border-radius-md)",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.4)",
                  aspectRatio: "2.5/3.5",
                  outline: !isOwnPage && card.hunted_by_viewer ? "2px solid var(--po-green)" : "none",
                  outlineOffset: 2,
                }}
              >
                {/* Card image */}
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.card_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 8, textAlign: "center",
                    fontSize: 8, color: "var(--po-text-faint)", lineHeight: 1.3,
                  }}>
                    {card.card_name}
                  </div>
                )}

                {/* Bottom gradient overlay */}
                <div style={{
                  position: "absolute", inset: "auto 0 0",
                  padding: "20px 6px 6px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)",
                }}>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.set_name} · #{card.card_number}
                  </div>
                  {card.price_usd > 0 && (
                    <div style={{ fontSize: 9, fontWeight: 900, color: "var(--po-green)" }}>
                      {fmtMoney(Number(card.price_usd), currency)}
                    </div>
                  )}
                </div>

                {/* ×N duplicate badge */}
                <div style={{
                  position: "absolute", top: 5, left: 5,
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(4px)",
                  borderRadius: 4,
                  padding: "2px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.9)",
                  letterSpacing: "0.02em",
                }}>
                  ×{card.duplicate_count}
                </div>

                {/* Hunting star badge — friend view only */}
                {!isOwnPage && card.hunted_by_viewer && (
                  <div style={{
                    position: "absolute", top: 5, right: 5,
                    width: 20, height: 20,
                    borderRadius: "50%",
                    background: "var(--po-green)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Star size={11} color="#050507" fill="#050507" strokeWidth={0} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Propose Trade button — friend view only */}
        {!isOwnPage && duplicates.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Link
              href={`/trade/new?with=${handle}`}
              style={{
                display: "block",
                width: "100%",
                padding: "15px",
                background: "var(--po-green)",
                borderRadius: "var(--border-radius-md)",
                color: "#050507",
                fontWeight: 700,
                fontSize: 15,
                textAlign: "center",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              Propose Trade
            </Link>
          </div>
        )}
      </div>
    </MSShell>
  );
}
