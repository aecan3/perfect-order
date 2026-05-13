"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, X, Camera, Trash2, ArrowLeft, ChevronDown, LayoutGrid, BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { FindCard } from "@/components/FindCard";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const valueOf = (priceUsd, currency) => (priceUsd || 0) * (RATES[currency]?.rate || 1);
const daysSince = (ts) => Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
const isStale = (ts) => ts && daysSince(ts) > 7;
const pricesLabel = (ts) => {
  if (!ts) return "Prices not yet refreshed";
  const d = daysSince(ts);
  if (d === 0) return "Prices updated today";
  if (d === 1) return "Prices updated 1 day ago";
  return `Prices updated ${d} days ago`;
};
const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10) return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

function rarityBucket(rarity, subtypes, cardNumber, setPrintedTotal) {
  const r = (rarity || "").toLowerCase().trim();
  const subs = (subtypes || []).map((s) => s.toLowerCase());
  const num = cardNumber || 0;
  const prt = setPrintedTotal || 0;

  if (!rarity) return "unknown";

  // ── UNIVERSAL ────────────────────────────────────────────
  if (r === "common")    return "common";
  if (r === "uncommon")  return "uncommon";
  if (r === "rare")      return "rare";
  if (r === "rare holo") return "rare_holo";
  if (r === "promo")     return "promo";

  // ── SCARLET & VIOLET + MEGA EVOLUTION ────────────────────
  if (r === "double rare") {
    if (subs.includes("mega")) return "mega_ex";
    if (subs.includes("tera")) return "tera_ex";
    if (subs.includes("ex"))   return "ex";
    return "double_rare";
  }
  if (r === "ultra rare")                return "ultra_rare";
  if (r === "illustration rare")         return "illustration_rare";
  if (r === "special illustration rare") return "sir";
  if (r === "hyper rare")                return "hyper_rare";
  if (r === "shiny rare")                return "shiny_rare";
  if (r === "shiny ultra rare")          return "shiny_ultra_rare";
  if (r === "ace spec rare")             return "ace_spec";
  if (r === "mega attack rare")          return "mega_attack_rare";
  if (r === "mega hyper rare")           return "mega_hyper_rare";

  // ── SWORD & SHIELD ───────────────────────────────────────
  if (r === "rare holo v")    return "v";
  if (r === "rare holo vmax") return "vmax";
  if (r === "rare holo vstar") return "vstar";
  if (r === "rare ultra") {
    const hasV = subs.some((s) => s === "v" || s === "vmax" || s === "vstar");
    if (hasV) return num > prt ? "v_full_art" : "v";
    return "full_art";
  }
  if (r === "rare rainbow") return "rainbow_rare";
  if (r === "rare secret") {
    const hasV = subs.some((s) => s === "v" || s === "vmax");
    if (hasV && num > prt)       return "alt_art";
    if (!hasV && num > prt + 20) return "gold_rare";
    return "secret_rare";
  }
  if (r === "trainer gallery rare holo") return "trainer_gallery";
  if (r === "rare shiny")                return "shiny";
  if (r === "amazing rare")              return "amazing_rare";

  // ── SUN & MOON ───────────────────────────────────────────
  if (r === "rare holo gx")    return "gx";
  if (r === "rare prism star") return "prism_star";
  if (r === "rare shining")    return "shining";

  // ── FALLBACK ─────────────────────────────────────────────
  return "other";
}

const BUCKET_ORDER = [
  "common", "uncommon", "rare", "rare_holo",
  "gx", "v", "vmax", "vstar",
  "full_art", "prism_star", "shining",
  "v_full_art", "amazing_rare", "trainer_gallery", "shiny",
  "double_rare", "ex", "tera_ex", "mega_ex", "illustration_rare", "ace_spec",
  "rainbow_rare", "ultra_rare",
  "alt_art", "secret_rare", "gold_rare",
  "mega_attack_rare", "sir",
  "hyper_rare", "mega_hyper_rare",
  "shiny_rare", "shiny_ultra_rare", "promo",
];
const BUCKET_LABELS = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", rare_holo: "Rare Holo",
  gx: "GX", full_art: "Full Art", prism_star: "Prism Star ◇", shining: "Shining",
  rainbow_rare: "Rainbow Rare", secret_rare: "Secret Rare",
  v: "V", vmax: "VMAX", vstar: "VSTAR", v_full_art: "Full Art V",
  alt_art: "Alt Art", gold_rare: "Gold Rare", amazing_rare: "Amazing Rare",
  trainer_gallery: "Trainer Gallery", shiny: "Shiny",
  double_rare: "Double Rare", ex: "ex", tera_ex: "Tera ex", mega_ex: "Mega ex", illustration_rare: "Illustration Rare",
  ultra_rare: "Full Art", ace_spec: "ACE SPEC", mega_attack_rare: "Mega Attack Rare",
  sir: "Special Illustration Rare", hyper_rare: "Hyper Rare",
  mega_hyper_rare: "Mega Hyper Rare", shiny_rare: "Shiny Rare",
  shiny_ultra_rare: "Shiny Ultra Rare", promo: "Promo",
};
const RARITY_TINT = {
  gx:                "rgba(59,130,246,0.35)",
  v:                 "rgba(59,130,246,0.35)",
  double_rare:       "rgba(59,130,246,0.35)",
  ex:                "rgba(59,130,246,0.35)",
  tera_ex:           "rgba(20,184,166,0.35)",
  mega_ex:           "rgba(139,92,246,0.35)",
  vmax:              "rgba(139,92,246,0.35)",
  vstar:             "rgba(139,92,246,0.35)",
  illustration_rare: "rgba(34,197,94,0.35)",
  full_art:          "rgba(34,197,94,0.35)",
  v_full_art:        "rgba(34,197,94,0.35)",
  ultra_rare:        "rgba(249,115,22,0.35)",
  alt_art:           "rgba(249,115,22,0.35)",
  trainer_gallery:   "rgba(249,115,22,0.35)",
  rainbow_rare:      "rgba(244,63,94,0.35)",
  sir:               "rgba(215,107,255,0.35)",
  mega_attack_rare:  "rgba(244,63,94,0.35)",
  hyper_rare:        "rgba(234,179,8,0.35)",
  mega_hyper_rare:   "rgba(234,179,8,0.35)",
  gold_rare:         "rgba(234,179,8,0.35)",
  shiny_rare:        "rgba(20,184,166,0.35)",
  shiny_ultra_rare:  "rgba(20,184,166,0.35)",
  shiny:             "rgba(20,184,166,0.35)",
  ace_spec:          "rgba(239,68,68,0.35)",
  prism_star:        "rgba(99,102,241,0.35)",
};

// Solid dot colors for rarity section headers (matching RARITY_TINT hues)
const RARITY_DOT = {
  common:            "#5fb6ff",
  uncommon:          "#9b6bff",
  rare:              "#5cd9a3",
  rare_holo:         "#5cd9a3",
  gx:                "#3b82f6",
  v:                 "#3b82f6",
  double_rare:       "#60a5fa",
  ex:                "#ffb05a",
  tera_ex:           "#2dd4bf",
  mega_ex:           "#a78bfa",
  vmax:              "#a78bfa",
  vstar:             "#a78bfa",
  illustration_rare: "#fde68a",
  full_art:          "#4ade80",
  v_full_art:        "#4ade80",
  ultra_rare:        "#fb923c",
  alt_art:           "#fb923c",
  trainer_gallery:   "#fb923c",
  rainbow_rare:      "#f43f5e",
  sir:               "#d76bff",
  mega_attack_rare:  "#f43f5e",
  hyper_rare:        "#fbbf24",
  mega_hyper_rare:   "#fbbf24",
  gold_rare:         "#fbbf24",
  shiny_rare:        "#2dd4bf",
  shiny_ultra_rare:  "#2dd4bf",
  shiny:             "#2dd4bf",
  ace_spec:          "#ef4444",
  prism_star:        "#818cf8",
  promo:             "#94a3b8",
  other:             "#64748b",
};

function MasterSetCelebration({ themePrimary, themeSecondary, logoUrl, setName, onDismiss }) {
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Fade in on first paint
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 480);
  }, [onDismiss]);

  // Auto-dismiss after 4 s
  useEffect(() => {
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [dismiss]);

  // Canvas particle burst
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const COLORS = [themePrimary, themePrimary, themeSecondary, "#ffffff", "#fbbf24", "#f472b6"];

    // Radial burst — 100 particles fanning out from centre
    const burst = Array.from({ length: 100 }, (_, i) => {
      const angle = (i / 100) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const speed = 4 + Math.random() * 10;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w: 4 + Math.random() * 6,
        h: 2 + Math.random() * 3,
        life: 1,
        decay: 0.009 + Math.random() * 0.012,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.22,
      };
    });

    // Slow-drifting atmosphere particles that outlast the burst
    const drifters = Array.from({ length: 35 }, () => ({
      x: cx + (Math.random() - 0.5) * Math.min(canvas.width * 0.9, 600),
      y: cy - canvas.height * 0.25 + (Math.random() - 0.5) * canvas.height * 0.15,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.6 + Math.random() * 1.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 3 + Math.random() * 5,
      h: 2 + Math.random() * 3,
      life: 0,
      maxLife: 0.7 + Math.random() * 0.3,
      decay: 0.0025 + Math.random() * 0.003,
      startFrame: 30 + Math.floor(Math.random() * 50),
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.07,
    }));

    let frame = 0;
    let animId;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      burst.forEach((p) => {
        if (p.life <= 0) return;
        p.x += p.vx;  p.y += p.vy;
        p.vy += 0.18;  p.vx *= 0.985;
        p.rot += p.rotV;  p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);  ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      drifters.forEach((p) => {
        if (frame < p.startFrame) return;
        p.x += p.vx;  p.y += p.vy;
        p.rot += p.rotV;
        if (p.life < p.maxLife) p.life = Math.min(p.maxLife, p.life + 0.05);
        p.life -= p.decay;
        if (p.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);  ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (burst.some(p => p.life > 0) || drifters.some(p => p.life > 0 || frame < p.startFrame)) {
        animId = requestAnimationFrame(draw);
      }
    }

    // Slight delay so overlay fade-in settles before burst fires
    const t = setTimeout(() => { animId = requestAnimationFrame(draw); }, 350);
    return () => { clearTimeout(t); cancelAnimationFrame(animId); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 200,
        background: "rgba(5,5,7,0.87)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
      onClick={dismiss}
    >
      {/* Particle canvas sits behind text */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Content */}
      <div
        className="relative flex flex-col items-center text-center px-8 select-none"
        style={{ transform: "translateY(-8%)" }}
      >
        {/* Pulsing glow orb behind logo */}
        <div
          className="po-master-glow-orb absolute rounded-full pointer-events-none"
          style={{
            width: 280, height: 280,
            background: `radial-gradient(circle, ${themePrimary}55 0%, ${themePrimary}18 45%, transparent 72%)`,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Set logo */}
        {logoUrl && (
          <img
            src={logoUrl}
            alt={setName}
            className="po-master-logo relative w-52 h-auto object-contain mb-10"
            style={{ filter: `drop-shadow(0 0 28px ${themePrimary}bb) drop-shadow(0 0 8px ${themePrimary})` }}
          />
        )}

        {/* MASTER SET */}
        <div
          className="po-master-title-1 font-black uppercase text-white"
          style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: "clamp(1.1rem, 5vw, 1.6rem)",
            letterSpacing: "0.28em",
            textShadow: "0 2px 16px rgba(0,0,0,0.6)",
          }}
        >
          Master Set
        </div>

        {/* COMPLETE */}
        <div
          className="po-master-title-2 font-black uppercase"
          style={{
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: "clamp(3rem, 14vw, 5.5rem)",
            letterSpacing: "0.08em",
            lineHeight: 1,
            color: themePrimary,
            textShadow: `0 0 30px ${themePrimary}, 0 0 70px ${themePrimary}88`,
          }}
        >
          Complete
        </div>
      </div>
    </div>
  );
}

function RaritySection({ section, isOpen, dot, sectionOwned, sectionTotal, onToggle, children }) {
  const sectionPct = sectionTotal > 0 ? (sectionOwned / sectionTotal) * 100 : 0;
  const [barWidth, setBarWidth] = useState(0);
  const [shimmer, setShimmer] = useState(false);
  const [dotPop, setDotPop] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const prevPctRef = useRef(null);

  useEffect(() => {
    if (prevPctRef.current === null) {
      prevPctRef.current = sectionPct;
      if (sectionPct >= 100) setShowBadge(true);
      // Small delay so DOM paints at width=0 before CSS transition fires
      const t = setTimeout(() => setBarWidth(sectionPct), 40);
      return () => clearTimeout(t);
    }
    const prev = prevPctRef.current;
    prevPctRef.current = sectionPct;
    setBarWidth(sectionPct);
    if (prev < 100 && sectionPct >= 100) {
      setShowBadge(true);
      setShimmer(true);
      setDotPop(true);
      setTimeout(() => setShimmer(false), 950);
      setTimeout(() => setDotPop(false), 650);
    } else if (sectionPct < 100 && prev >= 100) {
      setShowBadge(false);
    }
  }, [sectionPct]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--po-border)", background: "var(--po-bg-soft)" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3">
        <span
          className={`flex-shrink-0 rounded-full${dotPop ? " po-dot-pop" : ""}`}
          style={{ width: 8, height: 8, background: dot, boxShadow: `0 0 10px ${dot}` }}
        />
        <div className="flex-1 text-left min-w-0">
          <div className="font-bold text-[15px] leading-none">{section.label}</div>
          <div className="flex items-center gap-2 mt-1.5">
            {showBadge ? (
              <span
                key="badge"
                className="po-badge-in text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none"
                style={{ background: `${dot}22`, color: dot, border: `1px solid ${dot}66` }}
              >
                ✓ Complete
              </span>
            ) : (
              <span className="text-[11px] tabular-nums" style={{ color: "var(--po-text-dim)" }}>
                {sectionOwned}/{sectionTotal}
              </span>
            )}
            <div className="flex-1 relative rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.14)" }}>
              <div
                style={{
                  width: `${barWidth}%`,
                  height: "100%",
                  background: dot,
                  boxShadow: `0 0 6px ${dot}99`,
                  transition: "width 0.7s cubic-bezier(0.25,0.46,0.45,0.94)",
                }}
              />
              {shimmer && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${dot}dd 50%, transparent 100%)`,
                    animation: "po-shimmer-sweep 0.75s ease-out forwards",
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: "var(--po-text-dim)",
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3" style={{ borderTop: "1px solid var(--po-border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function abbreviate(label) {
  if (!label) return "?";
  const l = label.toLowerCase();
  if (l.includes("reverse")) return "RH";
  if (l.includes("holofoil") || l.includes("holo")) return "H";
  if (l.includes("full art")) return "FA";
  if (l.includes("secret")) return "SR";
  if (l.includes("normal")) return "N";
  return label.slice(0, 2).toUpperCase();
}

function CardArt({ src, name, ownershipState, themePrimary }) {
  const [failed, setFailed] = useState(false);
  const imgClass =
    ownershipState === "complete" ? "" :
    ownershipState === "partial"  ? "opacity-60" :
    "grayscale opacity-55";
  if (failed || !src) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 text-center ${imgClass}`}
        style={{ background: `linear-gradient(135deg, ${themePrimary}33, #050507)` }}
      >
        <div className="text-[11px] font-bold leading-tight line-clamp-3" style={{ color: themePrimary }}>
          {name || "—"}
        </div>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover transition-all duration-300 ${imgClass}`}
    />
  );
}

export default function SetTrackerPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const setId = params.setId;

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [setRow, setSetRow] = useState(null);
  const [cards, setCards] = useState([]);
  const [printingsByCard, setPrintingsByCard] = useState({});
  const [ownedPrintings, setOwnedPrintings] = useState({});
  const [pickingCard, setPickingCard] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currency, setCurrency] = useState("AUD");
  const [view, setView] = useState("rarity"); // "rarity" | "binder" | "missing"
  const [openSections, setOpenSections] = useState({});
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetTyped, setResetTyped] = useState("");
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState(null);
  const [shimmerMain, setShimmerMain] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [justCollected, setJustCollected] = useState(new Set());
  const [dupSheetCard, setDupSheetCard] = useState(null);
  const prevSetPctRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoTargetRef = useRef(null);
  const dupTimersRef = useRef({});
  const ownedPrintingsRef = useRef({});
  ownedPrintingsRef.current = ownedPrintings; // always current — set every render

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
    // Migrate from old po:masterSet boolean to new po:setView enum
    const saved = localStorage.getItem("po:setView");
    if (saved && ["rarity","binder","missing"].includes(saved)) {
      setView(saved);
    } else {
      const legacy = localStorage.getItem("po:masterSet");
      if (legacy === "true") setView("binder");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/welcome");
        return;
      }
      setUser(user);

      const [{ data: prof }, { data: setData }, { data: cardData }, { data: printingData }, { data: entriesData }, { data: userSetData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("sets").select("*").eq("id", setId).maybeSingle(),
        supabase.from("cards").select("*").eq("set_id", setId).order("number", { ascending: true }),
        supabase.from("printings").select("*").eq("set_id", setId).order("display_order", { ascending: true }),
        supabase
          .from("collection_entries")
          .select("printing_id, card_number, checked, photo_url, duplicate_count")
          .eq("user_id", user.id)
          .eq("set_id", setId),
        supabase
          .from("user_sets")
          .select("prices_updated_at")
          .eq("user_id", user.id)
          .eq("set_id", setId)
          .maybeSingle(),
      ]);

      setProfile(prof);
      setSetRow(setData);
      setPricesUpdatedAt(userSetData?.prices_updated_at || null);
      setCards(cardData || []);

      const groupedPrintings = {};
      (printingData || []).forEach((p) => {
        if (!groupedPrintings[p.card_number]) groupedPrintings[p.card_number] = [];
        groupedPrintings[p.card_number].push(p);
      });
      setPrintingsByCard(groupedPrintings);

      const ownedMap = {};
      (entriesData || []).forEach((e) => {
        if (e.printing_id) {
          ownedMap[e.printing_id] = { checked: e.checked, photo_url: e.photo_url, card_number: e.card_number, duplicate_count: e.duplicate_count || 0 };
        }
      });
      setOwnedPrintings(ownedMap);

      setAuthChecked(true);
    })();
  }, [setId, router, supabase]);

  const sections = useMemo(() => {
    const grouped = {};
    for (const c of cards) {
      const b = rarityBucket(c.rarity, c.subtypes, c.number, setRow?.total);
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(c);
    }
    return BUCKET_ORDER.filter((b) => grouped[b]?.length).map((b) => ({
      id: b, label: BUCKET_LABELS[b], cards: grouped[b],
    }));
  }, [cards, setRow]);

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const switchCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("po:currency", c);
  };

  useEffect(() => () => {
    Object.values(dupTimersRef.current).forEach(clearTimeout);
  }, []);

  // Full-set completion detection — fires only on real-time transition, not initial load
  useEffect(() => {
    if (!authChecked) return;
    const pct = totalDisplay > 0 ? (checkedDisplay / totalDisplay) * 100 : 0;
    if (prevSetPctRef.current === null) {
      prevSetPctRef.current = pct;
      return;
    }
    const prev = prevSetPctRef.current;
    prevSetPctRef.current = pct;
    if (prev < 100 && pct >= 100) {
      setShimmerMain(true);
      setShowCelebration(true);
      setTimeout(() => setShimmerMain(false), 1100);
    }
  }); // runs every render — intentional, reads computed pct

  const handleDupChange = (printingId, delta) => {
    if (!user) return;
    const cur = ownedPrintingsRef.current[printingId] || {};
    const newCount = Math.max(0, (cur.duplicate_count || 0) + delta);
    setOwnedPrintings((prev) => ({
      ...prev,
      [printingId]: { ...prev[printingId], duplicate_count: newCount },
    }));
    clearTimeout(dupTimersRef.current[printingId]);
    dupTimersRef.current[printingId] = setTimeout(async () => {
      delete dupTimersRef.current[printingId];
      const latest = ownedPrintingsRef.current[printingId] || {};
      await supabase.from("collection_entries").upsert(
        {
          user_id: user.id,
          set_id: setId,
          card_number: latest.card_number,
          printing_id: printingId,
          checked: latest.checked || false,
          photo_url: latest.photo_url ?? null,
          duplicate_count: latest.duplicate_count || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,set_id,card_number,printing_id" }
      );
    }, 800);
  };

  const togglePrinting = useCallback(
    async (printing) => {
      if (!user) return;
      const cur = ownedPrintings[printing.id] || {};
      const willOwn = !cur.checked;
      setOwnedPrintings((prev) => ({
        ...prev,
        [printing.id]: { ...cur, checked: willOwn, card_number: printing.card_number },
      }));
      if (willOwn) {
        setJustCollected((prev) => new Set([...prev, printing.card_number]));
      }
      await supabase.from("collection_entries").upsert(
        {
          user_id: user.id,
          set_id: setId,
          card_number: printing.card_number,
          printing_id: printing.id,
          checked: willOwn,
          photo_url: cur.photo_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,set_id,card_number,printing_id" }
      );
    },
    [user, ownedPrintings, supabase, setId]
  );

  const triggerPhoto = (printing, e) => {
    e.stopPropagation();
    photoTargetRef.current = printing;
    fileInputRef.current?.click();
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    const printing = photoTargetRef.current;
    if (!file || !printing || !user) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            if (!blob) return;
            const path = `${user.id}/${setId}-${printing.id}-${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("Card Photos")
              .upload(path, blob, { contentType: "image/jpeg", upsert: true });
            if (upErr) {
              alert("Upload failed: " + upErr.message);
              return;
            }
            const { data: { publicUrl } } = supabase.storage.from("Card Photos").getPublicUrl(path);
            const cur = ownedPrintings[printing.id] || {};
            setOwnedPrintings((prev) => ({
              ...prev,
              [printing.id]: { ...cur, photo_url: publicUrl },
            }));
            await supabase.from("collection_entries").upsert(
              {
                user_id: user.id,
                set_id: setId,
                card_number: printing.card_number,
                printing_id: printing.id,
                checked: cur.checked || false,
                photo_url: publicUrl,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,set_id,card_number,printing_id" }
            );
          },
          "image/jpeg",
          0.7
        );
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const reset = async () => {
    if (!user) return;
    await supabase
      .from("collection_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("set_id", setId);
    setOwnedPrintings({});
    setResetConfirm(false);
    setResetTyped("");
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">Loading…</div>;
  }

  if (!setRow) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--po-text-dim)] mb-3">Set not found.</p>
        <Link href="/" className="text-[var(--po-green)] underline text-sm">Back to my sets</Link>
      </div>
    );
  }

  const isCardOwned = (cardNumber) => {
    const prints = printingsByCard[cardNumber] || [];
    return prints.some((p) => ownedPrintings[p.id]?.checked);
  };
  const cardOwnedCount = (cardNumber) => {
    const prints = printingsByCard[cardNumber] || [];
    return prints.filter((p) => ownedPrintings[p.id]?.checked).length;
  };

  const allPrintings = cards.flatMap((c) => printingsByCard[c.number] || []);

  const totalCards = cards.length;
  const totalPrintings = allPrintings.length;
  const ownedCardCount = cards.filter((c) => isCardOwned(c.number)).length;
  const ownedPrintingCount = allPrintings.filter((p) => ownedPrintings[p.id]?.checked).length;

  const totalCardValue = cards.reduce((s, c) => {
    const prints = printingsByCard[c.number] || [];
    const minPrice = prints.reduce((m, p) => Math.min(m, p.price_usd ?? Infinity), Infinity);
    return s + (Number.isFinite(minPrice) ? valueOf(minPrice, currency) : 0);
  }, 0);
  const totalPrintingValue = allPrintings.reduce((s, p) => s + valueOf(p.price_usd, currency), 0);

  const ownedCardValue = cards
    .filter((c) => isCardOwned(c.number))
    .reduce((s, c) => {
      const prints = printingsByCard[c.number] || [];
      const minPrice = prints.reduce((m, p) => Math.min(m, p.price_usd ?? Infinity), Infinity);
      return s + (Number.isFinite(minPrice) ? valueOf(minPrice, currency) : 0);
    }, 0);
  const ownedPrintingValue = allPrintings
    .filter((p) => ownedPrintings[p.id]?.checked)
    .reduce((s, p) => s + valueOf(p.price_usd, currency), 0);

  const checkedDisplay = ownedPrintingCount;
  const totalDisplay = totalPrintings;
  const remainingDisplay = totalDisplay - checkedDisplay;
  const ownedValueDisplay = ownedPrintingValue;
  const totalValueDisplay = totalPrintingValue;
  const remainingValueDisplay = totalValueDisplay - ownedValueDisplay;

  const themePrimary = setRow.theme_primary || "#b9ff3c";
  const themeSecondary = setRow.theme_secondary || "#c084fc";
  const userCountry = { AUD: "AU", USD: "US", GBP: "UK" }[currency] || "AU";

  const missingFilter = (card) => {
    if (justCollected.has(card.number)) return true;
    const prints = printingsByCard[card.number] || [];
    return prints.filter((p) => ownedPrintings[p.id]?.checked).length < prints.length;
  };
  // Binder and rarity show all cards; missing filters to only uncollected
  const viewCards = view === "missing" ? cards.filter(missingFilter) : cards;
  // section.cards is always full (for owned/total counts in headers);
  // displayCards is the subset actually rendered in the grid
  const viewSections = view === "missing"
    ? sections
        .map((s) => ({ ...s, displayCards: s.cards.filter(missingFilter) }))
        .filter((s) => s.displayCards.length > 0)
    : sections.map((s) => ({ ...s, displayCards: s.cards }));

  const renderCard = (card) => {
    const prints = printingsByCard[card.number] || [];
    const checkedCount = prints.filter((p) => ownedPrintings[p.id]?.checked).length;
    const completionState =
      prints.length === 0 || checkedCount === 0 ? "uncollected"
      : checkedCount === prints.length ? "complete"
      : "partial";
    const minPriceUsd = prints.reduce((m, p) => Math.min(m, p.price_usd > 0 ? p.price_usd : Infinity), Infinity);
    const cardPrice = Number.isFinite(minPriceUsd) ? valueOf(minPriceUsd, currency) : null;
    const bucket = rarityBucket(card.rarity, card.subtypes, card.number, setRow?.total);
    const tint = RARITY_TINT[bucket];
    const photoEntry = prints.map((p) => ownedPrintings[p.id]).find((e) => e?.photo_url);
    const photo = photoEntry?.photo_url;
    const photoImgClass =
      completionState === "complete" ? "" :
      completionState === "partial"  ? "opacity-60" :
      "grayscale opacity-30";
    const isJustCollected = view === "missing" && justCollected.has(card.number);

    return (
      <div key={card.id} className="flex flex-col">
        <div
          onClick={() => prints.length === 1 ? togglePrinting(prints[0]) : setPickingCard(card)}
          className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden cursor-pointer select-none active:scale-[0.98] transition-transform"
          style={{
            boxShadow: isJustCollected
              ? "0 0 0 2px #22c55e, 0 0 18px rgba(34,197,94,0.5)"
              : completionState === "complete"
              ? `0 4px 20px rgba(0,0,0,0.5), 0 0 16px ${tint ? tint.replace(/[\d.]+\)$/, "0.4)") : "rgba(255,255,255,0.12)"}`
              : "0 2px 10px rgba(0,0,0,0.4)",
          }}
        >
          {photo ? (
            <img
              src={photo}
              alt={card.name}
              className={`w-full h-full object-cover transition-all duration-300 ${photoImgClass}`}
            />
          ) : (
            <CardArt src={card.image_large} name={card.name} ownershipState={completionState} themePrimary={themePrimary} />
          )}
          {completionState !== "complete" && tint && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: tint }} />
          )}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {String(card.number).padStart(3, "0")}
          </div>
          {completionState === "complete" && (
            <div
              className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: themePrimary, color: "#000", boxShadow: `0 0 8px ${themePrimary}80` }}
            >
              <Check size={16} strokeWidth={3} />
            </div>
          )}
          {completionState === "partial" && (
            <div
              className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none"
              style={{ background: `${themePrimary}30`, color: themePrimary, border: `1px solid ${themePrimary}80` }}
            >
              {checkedCount}/{prints.length}
            </div>
          )}
          {cardPrice !== null && (
            <div
              className="absolute bottom-1 right-1 bg-black/70 text-[9px] px-1 py-0.5 rounded font-mono leading-none"
              style={{ color: themePrimary }}
            >
              {fmtMoney(cardPrice, currency)}
            </div>
          )}
          <FindCard
            cardName={card.name}
            cardNumber={card.number}
            setTotal={setRow.total}
            rarity={card.rarity}
            userCountry={userCountry}
          />
        </div>
        {prints.length === 1 ? (
          checkedCount > 0 && (
            <div
              className="flex items-center justify-center gap-1 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              {(ownedPrintings[prints[0].id]?.duplicate_count || 0) > 0 && (
                <>
                  <button
                    onClick={() => handleDupChange(prints[0].id, -1)}
                    className="w-5 h-5 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-xs flex items-center justify-center leading-none hover:text-[var(--po-text)]"
                  >
                    −
                  </button>
                  <span
                    className="text-[10px] font-bold tabular-nums w-4 text-center"
                    style={{ color: themePrimary }}
                  >
                    {ownedPrintings[prints[0].id]?.duplicate_count || 0}
                  </span>
                </>
              )}
              <button
                onClick={() => handleDupChange(prints[0].id, 1)}
                className="w-5 h-5 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-xs flex items-center justify-center leading-none hover:text-[var(--po-text)]"
              >
                +
              </button>
            </div>
          )
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            {checkedCount > 0 ? (
              <div
                style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginTop: 4, cursor: "pointer" }}
                onClick={() => setDupSheetCard(card)}
              >
                {prints
                  .filter((p) => ownedPrintings[p.id]?.checked)
                  .map((p) => {
                    const count = 1 + (ownedPrintings[p.id]?.duplicate_count || 0);
                    return (
                      <span
                        key={p.id}
                        style={{
                          fontSize: 10,
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontWeight: 500,
                          color: "#07070a",
                          background: "#c8ff4a",
                          borderRadius: 4,
                          padding: "1px 5px",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {abbreviate(p.printing_label)} ×{count}
                      </span>
                    );
                  })}
              </div>
            ) : (
              <div className="flex items-center justify-center mt-1">
                <button
                  onClick={() => setDupSheetCard(card)}
                  className="w-5 h-5 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-xs flex items-center justify-center leading-none hover:text-[var(--po-text)]"
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const pct = totalDisplay > 0 ? (checkedDisplay / totalDisplay) * 100 : 0;

  const switchView = (v) => {
    setView(v);
    localStorage.setItem("po:setView", v);
  };

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      {showCelebration && (
        <MasterSetCelebration
          themePrimary={themePrimary}
          themeSecondary={themeSecondary}
          logoUrl={setRow.logo_url}
          setName={setRow.name}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
      <header
        className="sticky top-0 z-20 backdrop-blur px-4 pt-3 pb-3"
        style={{ background: "rgba(5,5,7,0.92)", borderBottom: `1px solid ${themePrimary}30` }}
      >
        {/* Top nav row */}
        <div className="flex items-center justify-between mb-3">
          <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--po-border)] bg-[var(--po-bg-soft)]" style={{ color: "var(--po-text-dim)" }}>
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <select
              value={currency}
              onChange={(e) => switchCurrency(e.target.value)}
              className="text-[10px] uppercase tracking-widest px-2 py-1.5 border border-[var(--po-border)] rounded-lg bg-[var(--po-bg-soft)] cursor-pointer"
              style={{ color: "var(--po-text-dim)" }}
            >
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
            <button
              onClick={() => setResetConfirm(true)}
              className="text-[10px] uppercase tracking-widest px-2 py-1.5 rounded-lg border border-[var(--po-border)]"
              style={{ color: "var(--po-text-dim)" }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Set hero: logo + name + series */}
        <div className="flex gap-3 items-center mb-4">
          {setRow.logo_url && (
            <img src={setRow.logo_url} alt={setRow.name}
                 className="h-14 w-auto object-contain flex-shrink-0 drop-shadow-lg" />
          )}
          <div className="min-w-0">
            <h1
              className="font-black text-2xl leading-none truncate"
              style={{
                color: themePrimary,
                textShadow: `0 0 18px ${themePrimary}55`,
                letterSpacing: "-0.01em",
              }}
            >
              {setRow.name}
            </h1>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold mt-1.5 truncate"
                 style={{ color: "var(--po-text-faint)" }}>
              {setRow.series}{profile?.handle ? ` · @${profile.handle}` : ""}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5"
                 style={{ color: "var(--po-text-faint)" }}>Owned</div>
            <div className="text-[32px] font-black tabular-nums leading-none">{checkedDisplay}</div>
            <div className="text-[11px] mt-1 tabular-nums" style={{ color: "var(--po-text-dim)" }}>
              / {totalDisplay} · {remainingDisplay} to go
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-1.5"
                 style={{ color: "var(--po-text-faint)" }}>Value</div>
            <div className="text-[28px] font-black tabular-nums leading-none"
                 style={{ color: themePrimary }}>{fmtMoney(ownedValueDisplay, currency)}</div>
            <div className="text-[11px] mt-1 tabular-nums" style={{ color: "var(--po-text-dim)" }}>
              {fmtMoney(totalValueDisplay, currency)} all-in
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="w-full relative rounded-full overflow-hidden" style={{ height: 5, background: "var(--po-progress-track)" }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${themePrimary}, ${themeSecondary})`,
                boxShadow: shimmerMain ? `0 0 20px ${themePrimary}` : `0 0 12px ${themePrimary}80`,
                transition: "width 0.3s, box-shadow 0.4s",
              }}
            />
            {shimmerMain && (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${themePrimary}ee 50%, transparent 100%)`,
                  animation: "po-shimmer-sweep 0.9s ease-out forwards",
                }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1">
            <div className="text-[10px] flex items-center gap-1"
                 style={{ color: isStale(pricesUpdatedAt) ? "#f59e0b" : "var(--po-text-faint)" }}>
              {isStale(pricesUpdatedAt) && <Clock size={9} />}
              {pricesLabel(pricesUpdatedAt)}
            </div>
            <div
              className="text-[10px] font-bold transition-all duration-500"
              style={{
                color: themePrimary,
                textShadow: shimmerMain ? `0 0 10px ${themePrimary}` : "none",
              }}
            >
              {pct.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* 3-way view toggle */}
        <div className="flex gap-1.5 p-1 rounded-xl border border-[var(--po-border)]"
             style={{ background: "var(--po-bg-soft)" }}>
          {[
            { v: "rarity",  label: "Rarity",  Icon: LayoutGrid },
            { v: "binder",  label: "Binder",  Icon: BookOpen },
            { v: "missing", label: "Missing", Icon: null },
          ].map(({ v, label, Icon }) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => switchView(v)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] rounded-lg transition-colors"
                style={{
                  background: active ? themePrimary : "transparent",
                  color: active ? "#000" : "var(--po-text-dim)",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {Icon && <Icon size={12} />}
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-3 py-4">
        {view === "rarity" ? (
          <div className="space-y-2">
            {viewSections.length === 0 && (
              <div className="text-center text-[var(--po-text-dim)] text-sm py-12">All cards collected — nothing missing!</div>
            )}
            {viewSections.map((section) => {
              const isOpen = !!openSections[section.id];
              const dot = RARITY_DOT[section.id] || "#ffffff";
              const sectionOwned = section.cards.reduce((n, c) => n + (printingsByCard[c.number] || []).filter((p) => ownedPrintings[p.id]?.checked).length, 0);
              const sectionTotal = section.cards.reduce((n, c) => n + (printingsByCard[c.number] || []).length, 0);
              return (
                <RaritySection
                  key={section.id}
                  section={section}
                  isOpen={isOpen}
                  dot={dot}
                  sectionOwned={sectionOwned}
                  sectionTotal={sectionTotal}
                  onToggle={() => toggleSection(section.id)}
                >
                  {section.displayCards.map(renderCard)}
                </RaritySection>
              );
            })}
          </div>
        ) : view === "binder" ? (
          <div className="grid grid-cols-2 gap-3">
            {viewCards.map(renderCard)}
          </div>
        ) : (
          // Missing view
          viewCards.length > 0 ? (
            <div>
              <div className="flex justify-between items-baseline mb-3 px-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em]">{viewCards.length} cards remaining</div>
                <div className="text-[11px] tabular-nums" style={{ color: "var(--po-text-dim)" }}>
                  {fmtMoney(
                    viewCards.reduce((s, c) => {
                      const prints = printingsByCard[c.number] || [];
                      const min = prints.reduce((m, p) => Math.min(m, p.price_usd > 0 ? p.price_usd : Infinity), Infinity);
                      return s + (Number.isFinite(min) ? min * (RATES[currency]?.rate || 1) : 0);
                    }, 0),
                    currency
                  )} to complete
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">{viewCards.map(renderCard)}</div>
            </div>
          ) : (
            <div className="text-center text-[var(--po-text-dim)] text-sm py-12">All cards collected — nothing missing!</div>
          )
        )}
      </main>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />

      {resetConfirm && (
        <div
          className="fixed inset-0 z-30 bg-black/80 flex items-end sm:items-center justify-center p-4"
          onClick={() => { setResetConfirm(false); setResetTyped(""); }}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-rose-800/60 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-rose-300 mb-2">Reset entire collection?</h2>
            <p className="text-sm text-[var(--po-text-dim)] mb-3">
              This permanently deletes every checked card and photo for <span className="text-[var(--po-text)] font-bold">{setRow.name}</span>. This cannot be undone.
            </p>
            <p className="text-xs text-[var(--po-text-dim)] mb-2">
              Type <span className="font-mono text-rose-300">{setRow.code}</span> to confirm:
            </p>
            <input
              type="text"
              value={resetTyped}
              onChange={(e) => setResetTyped(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-[var(--po-text)] focus:outline-none focus:border-rose-400 mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setResetConfirm(false); setResetTyped(""); }}
                className="flex-1 py-2 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-sm font-bold text-[var(--po-text)]"
              >
                Cancel
              </button>
              <button
                onClick={reset}
                disabled={resetTyped.trim().toUpperCase() !== setRow.code.toUpperCase()}
                className="flex-1 py-2 bg-rose-700 disabled:bg-rose-900 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
              >
                Reset everything
              </button>
            </div>
          </div>
        </div>
      )}

      {dupSheetCard && (
        <div
          className="fixed inset-0 z-30 bg-black/60 flex items-end justify-center"
          onClick={() => setDupSheetCard(null)}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-t-2xl w-full max-w-sm px-5 pt-4 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--po-border)] rounded-full mx-auto mb-4" />
            <h2 className="text-base font-bold leading-tight mb-0.5">
              {dupSheetCard.name}
              <span className="text-[var(--po-text-dim)] font-normal ml-1">#{String(dupSheetCard.number).padStart(3, "0")}</span>
            </h2>
            <p className="text-xs text-[var(--po-text-dim)] mb-4">Which version are you updating?</p>
            <div className="space-y-1">
              {(printingsByCard[dupSheetCard.number] || [])
                .filter((p) => ownedPrintings[p.id]?.checked)
                .map((p) => {
                  const dc = ownedPrintings[p.id]?.duplicate_count || 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-[var(--po-border)] last:border-0">
                      <span className="text-sm font-bold">{p.printing_label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDupChange(p.id, -1)}
                          disabled={dc === 0}
                          className="w-7 h-7 rounded-full bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-sm flex items-center justify-center disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="text-sm font-black tabular-nums w-6 text-center" style={{ color: themePrimary }}>
                          {dc}
                        </span>
                        <button
                          onClick={() => handleDupChange(p.id, 1)}
                          className="w-7 h-7 rounded-full bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-sm flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
            <button
              onClick={() => setDupSheetCard(null)}
              className="w-full mt-5 py-3 rounded-xl font-black text-sm text-black"
              style={{ background: "var(--po-green)" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {pickingCard && (
        <div className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setPickingCard(null)}>
          <div className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold leading-tight">
                {pickingCard.name}
                <span className="text-[var(--po-text-dim)] font-normal ml-1">#{String(pickingCard.number).padStart(3, "0")}</span>
              </h2>
              <button onClick={() => setPickingCard(null)} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {(printingsByCard[pickingCard.number] || []).map((p) => {
                const isOwned = !!ownedPrintings[p.id]?.checked;
                const v = valueOf(p.price_usd, currency);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePrinting(p)}
                    className="w-full flex items-center justify-between py-3 px-4 bg-[var(--po-bg)] border rounded-lg text-left transition"
                    style={{
                      borderColor: isOwned ? themePrimary : "var(--po-border)",
                      boxShadow: isOwned ? `0 0 8px ${themePrimary}40` : "none",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition"
                        style={{
                          background: isOwned ? themePrimary : "transparent",
                          border: `2px solid ${isOwned ? themePrimary : "var(--po-border)"}`,
                        }}
                      >
                        {isOwned && <Check size={12} strokeWidth={3} className="text-black" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{p.printing_label}</div>
                        <div className="text-[10px] text-[var(--po-text-dim)] tabular-nums">{fmtMoney(v, currency)}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => triggerPhoto(p, e)}
                      className="w-8 h-8 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] flex items-center justify-center"
                      aria-label="Add photo"
                    >
                      <Camera size={14} />
                    </button>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center mt-3">
              <FindCard
                cardName={pickingCard.name}
                cardNumber={pickingCard.number}
                setTotal={setRow.total}
                rarity={pickingCard.rarity}
                userCountry={userCountry}
                inline
              />
            </div>
            <button onClick={() => setPickingCard(null)} className="w-full py-2 text-xs text-[var(--po-text-dim)] mt-1">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
