"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

function BracketHairline({ side }) {
  const w = 12, h = 16;
  const path = side === "left"
    ? `M${w - 1} 1.5 L1 1.5 L1 ${h - 1.5} L${w - 1} ${h - 1.5}`
    : `M1 1.5 L${w - 1} 1.5 L${w - 1} ${h - 1.5} L1 ${h - 1.5}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={path} stroke="var(--ms-accent)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function Avatar({ size = 28, initial, bg, ink }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 4, flexShrink: 0,
      background: bg, color: ink,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontWeight: 700, fontSize: Math.round(size * 0.45), letterSpacing: "-0.02em",
    }}>
      {initial}
    </div>
  );
}

function FeedCard({ children, topGlow }) {
  return (
    <div style={{
      position: "relative",
      background: "var(--ms-elev, #0c0c10)",
      borderRadius: 4,
      border: "1px solid var(--ms-rule)",
      overflow: "hidden",
    }}>
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: topGlow, boxShadow: `0 0 14px ${topGlow}`,
      }} />
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 56,
        background: `linear-gradient(180deg, ${topGlow}22, transparent)`,
        pointerEvents: "none",
      }} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function CardSetStarted() {
  return (
    <FeedCard topGlow="#5fb6ff">
      <div style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={28} initial="S" bg="#5fb6ff" ink="#06121a" />
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            color: "var(--ms-faint)", letterSpacing: "0.2em", textTransform: "uppercase",
          }}>@sarah · STARTED · 2H</span>
        </div>
        <div style={{
          marginTop: 8, fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 700, fontSize: 16, color: "var(--ms-ink)",
          letterSpacing: "-0.01em", lineHeight: 1.2,
        }}>Sarah started Black Bolt</div>
        <div style={{
          marginTop: 4, fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
          color: "var(--ms-dim)", letterSpacing: "0.18em", textTransform: "uppercase",
        }}>SCARLET & VIOLET · 178 CARDS</div>
      </div>
      <div style={{
        padding: "10px 14px 12px",
        borderTop: "1px solid var(--ms-rule)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            color: "var(--ms-accent)", letterSpacing: "0.18em",
            textTransform: "uppercase", fontWeight: 700,
          }}>DUPLICATE MATCH</span>
          <span style={{
            fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 500,
            fontSize: 13, color: "var(--ms-ink)", letterSpacing: "-0.005em",
          }}>You have 12 of her missing cards</span>
        </div>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700,
          fontSize: 18, color: "var(--ms-accent)",
          fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
        }}>12</span>
      </div>
    </FeedCard>
  );
}

function CardSetCompleted() {
  return (
    <FeedCard topGlow="#c8ff4a">
      <div style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={28} initial="A" bg="#c8ff4a" ink="#07070a" />
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            color: "var(--ms-faint)", letterSpacing: "0.2em", textTransform: "uppercase",
          }}>@alex · COMPLETED · 14H</span>
        </div>
        <div style={{
          marginTop: 8, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{
            fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700,
            fontSize: 16, color: "var(--ms-ink)", letterSpacing: "-0.01em", lineHeight: 1.2,
          }}>Alex completed Perfect Order</span>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            color: "var(--ms-accent)", letterSpacing: "0.18em", fontWeight: 700,
          }}>MASTER</span>
        </div>
        <div style={{
          marginTop: 4, fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
          color: "var(--ms-dim)", letterSpacing: "0.18em", textTransform: "uppercase",
        }}>MEGA EVOLUTION</div>
        <div style={{
          marginTop: 12, display: "flex", alignItems: "baseline",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700,
              fontSize: 28, color: "var(--ms-ink)",
              fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", lineHeight: 1,
            }}>124</span>
            <span style={{
              color: "var(--ms-faint)", fontSize: 14, fontVariantNumeric: "tabular-nums",
            }}>/ 124</span>
          </div>
          <div style={{
            fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700,
            fontSize: 16, color: "var(--ms-accent)", fontVariantNumeric: "tabular-nums",
          }}>A$4,210</div>
        </div>
      </div>
    </FeedCard>
  );
}

function CardSocialProof() {
  const friends = [
    { initial: "R", bg: "#f72585", ink: "#1a0510" },
    { initial: "K", bg: "#f5b942", ink: "#1a1206" },
    { initial: "S", bg: "#5fb6ff", ink: "#06121a" },
  ];
  return (
    <FeedCard topGlow="#f5b942">
      <div style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {friends.map((f, i) => (
              <div key={i} style={{
                marginLeft: i === 0 ? 0 : -8,
                boxShadow: "0 0 0 2px var(--ms-elev, #0c0c10)",
                borderRadius: 4,
              }}>
                <Avatar {...f} />
              </div>
            ))}
          </div>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            color: "var(--ms-faint)", letterSpacing: "0.2em", textTransform: "uppercase",
          }}>TRENDING · 3 IN YOUR CIRCLE</span>
        </div>
        <div style={{
          marginTop: 10, fontFamily: '"IBM Plex Sans", sans-serif',
          fontWeight: 700, fontSize: 16, color: "var(--ms-ink)",
          letterSpacing: "-0.01em", lineHeight: 1.2,
        }}>3 friends are collecting Destined Rivals</div>
        <div style={{
          marginTop: 4, fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
          color: "var(--ms-dim)", letterSpacing: "0.18em", textTransform: "uppercase",
        }}>SCARLET & VIOLET · 244 CARDS</div>
      </div>
      <div style={{
        padding: "10px 14px 12px",
        borderTop: "1px solid var(--ms-rule)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace', fontSize: 9,
            color: "var(--ms-accent)", letterSpacing: "0.18em",
            textTransform: "uppercase", fontWeight: 700,
          }}>YOUR DUPLICATES</span>
          <span style={{
            fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 500,
            fontSize: 13, color: "var(--ms-ink)", letterSpacing: "-0.005em",
          }}>Could help 2 of them</span>
        </div>
        <span style={{
          fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700,
          fontSize: 18, color: "var(--ms-accent)",
          fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
        }}>27</span>
      </div>
    </FeedCard>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace("/welcome");
    })();
  }, [router, supabase]);

  return (
    <MSShell>
      <div style={{ padding: "0 16px 32px" }}>
        <MSPageTitle sub="COMING SOON · IN DEVELOPMENT">Feed</MSPageTitle>

        <div style={{ padding: "16px 18px 22px" }}>
          <p style={{
            margin: 0,
            fontFamily: '"IBM Plex Sans", sans-serif',
            fontWeight: 500, fontSize: 17, color: "var(--ms-ink)",
            letterSpacing: "-0.005em", lineHeight: 1.4,
          }}>
            See what your circle is collecting.{" "}
            See who can finish your sets.
          </p>
        </div>

        {/* Preview section */}
        <div style={{ position: "relative", marginTop: 2 }}>
          {/* [ PREVIEW ] label */}
          <div style={{
            position: "absolute", top: -8, left: 14,
            background: "var(--ms-bg)", padding: "0 8px", zIndex: 1,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <BracketHairline side="left" />
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 700,
              color: "var(--ms-faint)", letterSpacing: "0.2em", textTransform: "uppercase",
            }}>Preview</span>
            <BracketHairline side="right" />
          </div>

          <div style={{
            border: "1px dashed var(--ms-faint)",
            borderRadius: 4,
            padding: "20px 14px 16px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <CardSetStarted />
            <CardSetCompleted />
            <CardSocialProof />
          </div>
        </div>

        <div style={{
          marginTop: 20, padding: "14px 0 8px",
          textAlign: "center",
          fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 500,
          color: "var(--ms-faint)", letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          IN DEVELOPMENT · MAY 2026
        </div>
      </div>
    </MSShell>
  );
}
