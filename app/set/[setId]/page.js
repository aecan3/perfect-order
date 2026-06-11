// HIDDEN FOR LAUNCH: Grand Master feature deliberately disabled in this file.
// Affected blocks: GM section render, GM completion detection, GM value aggregation.
// See handover for re-enable steps. The data layer (gmPrintings state, GM fetch,
// gmCardIds filter) is intentionally preserved — do not remove it.
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, X, Camera, Trash2, ChevronDown, LayoutGrid, BookOpen, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { FindOnline } from "@/components/FindOnline";
import { AchievementCelebration } from "@/components/AchievementCelebration";
import { selectMasterPrintings } from "@/lib/queries/printings";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { ReportCardFAB } from "@/components/ReportCardFAB";
import BackButton from "@/components/BackButton";
import { rarityBucket, BUCKET_ORDER } from "@/lib/rarity";
import { stripEditionPrefix, getEditionOptions, getAnonEditionMode, setAnonEditionMode } from "@/lib/edition-utils";
import { useCollectionState } from "@/lib/hooks/useCollectionState";
import { AnonymousCollectionBlocker, captureCollectionMigrationIntent } from "@/components/AnonymousCollectionBlocker";
import { EditionExplainerSheet } from "@/components/EditionExplainerSheet";
import { CardArt } from "@/components/set/CardArt";
import { CardCell } from "@/components/set/CardCell";
import { VirtualCardGrid } from "@/components/set/VirtualCardGrid";
import { useScrollRestoration } from "@/lib/hooks/useScrollRestoration";

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
  energy_card: "Energy", other_null: "Other",
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
      <button onClick={onToggle} className="ms-pressable w-full flex items-center gap-3 px-4 py-3">
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


function AchievementToast({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const isGm = toast.type === "grand_master";
  const color = isGm ? "#FFB830" : "#c8ff4a";

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4000);
    return () => { cancelAnimationFrame(id); clearTimeout(hide); };
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 300,
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        background: "rgba(5,5,7,0.97)",
        borderBottom: `2px solid ${color}`,
        padding: "16px 20px 20px",
        boxShadow: `0 4px 32px ${color}40`,
        cursor: "pointer",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{isGm ? "✦" : "🏆"}</span>
        <div>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, letterSpacing: "0.1em", color, marginBottom: 3, fontWeight: 700 }}>
            {isGm ? "GRAND MASTER" : "MASTER SET"}
          </div>
          <div style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 700, fontSize: 15, color: "rgba(244,244,246,0.95)" }}>
            {isGm ? `✦ You are a ${toast.setName} Grand Master!` : `🏆 You completed the ${toast.setName} Master Set!`}
          </div>
        </div>
      </div>
    </div>
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
  const [ownedPrintingsState, setOwnedPrintings] = useState({});
  const [pickingCard, setPickingCard] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [currency, setCurrency] = useState("AUD");
  const [view, setView] = useState("rarity"); // "rarity" | "binder" | "missing"
  const [openSections, setOpenSections] = useState({});
  const [resetConfirm, setResetConfirm] = useState(false);
  const [dupConfirmPrinting, setDupConfirmPrinting] = useState(null);
  const [resetTyped, setResetTyped] = useState("");
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState(null);
  const [shimmerMain, setShimmerMain] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [justCollected, setJustCollected] = useState(new Set());
  const [gmPrintings, setGmPrintings] = useState([]);
  const [grandMasterExpanded, setGrandMasterExpanded] = useState(false);
  const [achievementToast, setAchievementToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const celebrationQueueRef = useRef([]);
  const [favourites, setFavourites] = useState(new Set());
  const [favSheet, setFavSheet] = useState(null);
  const [favToast, setFavToast] = useState(false);
  const favToastTimerRef = useRef(null);
  const prevSetPctRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoTargetRef = useRef(null);
  const dupTimersRef = useRef({});
  const ownedPrintingsRef = useRef({});
  const [blockerTrigger, setBlockerTrigger] = useState(null);
  const thresholdsFiredRef = useRef(new Set());
  const [restoreToast, setRestoreToast] = useState(null);
  const [editionMode, setEditionMode] = useState("any");
  const isAnonymous = !user;

  const printingsMap = useMemo(() => {
    const map = new Map();
    Object.values(printingsByCard).forEach((prints) => {
      prints.forEach((p) => map.set(p.id, { card_number: p.card_number, price_usd: p.price_usd }));
    });
    return map;
  }, [printingsByCard]);

  // Active prints per card with stable array identities — CardCell receives
  // these arrays as props, so they must only change identity when the
  // underlying data or edition mode actually changes, or memoised cells
  // would re-render on every page state change.
  const activePrintsByCard = useMemo(() => {
    if (editionMode === "any" || editionMode === "all") return printingsByCard;
    const map = {};
    for (const [num, prints] of Object.entries(printingsByCard)) {
      map[num] = prints.filter((p) => p.printing_type.startsWith(editionMode));
    }
    return map;
  }, [printingsByCard, editionMode]);
  const getActivePrints = (cardNumber) => activePrintsByCard[cardNumber] || [];

  // Stable callback identities for CardCell (same trick as ownedPrintingsRef:
  // the ref is reassigned every render in the body below, the memoised
  // wrappers never change, so memoised cells don't re-render when handler
  // closures are rebuilt).
  const cellHandlersRef = useRef({});
  const cellHandlers = useMemo(() => ({
    onTapCard: (c) => cellHandlersRef.current.onTapCard(c),
    onOpenPicker: (c) => cellHandlersRef.current.onOpenPicker(c),
    onToggleFavourite: (c, printingId, isFav) => cellHandlersRef.current.onToggleFavourite(c, printingId, isFav),
    onDupChange: (printingId, delta) => cellHandlersRef.current.onDupChange(printingId, delta),
    onFlagToggle: (printingId) => cellHandlersRef.current.onFlagToggle(printingId),
  }), []);

  useScrollRestoration({ key: `/set/${setId}:${view}`, ready: authChecked && !!setRow });

  const anonCollection = useCollectionState({ isAnonymous, setId, printingsMap });

  const ownedPrintings = isAnonymous
    ? Object.fromEntries(
        anonCollection.entries.map((e) => [
          e.printingId,
          { checked: true, duplicate_count: Math.max(0, e.quantity - 1), photo_url: null, card_number: e.cardNumber },
        ])
      )
    : ownedPrintingsState;

  ownedPrintingsRef.current = ownedPrintings;

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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) setUser(authUser);
      setAuthResolved(true);

      const [{ data: setData }, { data: cardData }, { data: printingData }, { data: gmPrintingData }] = await Promise.all([
        supabase.from("sets").select("*").eq("id", setId).maybeSingle(),
        supabase.from("cards").select("*").eq("set_id", setId).order("number", { ascending: true }),
        selectMasterPrintings(supabase).eq("set_id", setId).order("display_order", { ascending: true }),
        supabase.from("printings").select("*, card:cards(id,name,rarity,supertype,image_large,image_small,number)").eq("set_id", setId).eq("collection_tier", "grand_master").order("display_order", { ascending: true }),
      ]);

      let prof = null, entriesData = [], userSetData = null, favsData = [];
      if (authUser) {
        [{ data: prof }, { data: entriesData }, { data: userSetData }, { data: favsData }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
          supabase.from("collection_entries").select("printing_id, card_number, checked, photo_url, duplicate_count, trade_flagged").eq("user_id", authUser.id).eq("set_id", setId),
          supabase.from("user_sets").select("prices_updated_at, edition_mode").eq("user_id", authUser.id).eq("set_id", setId).maybeSingle(),
          supabase.from("favourites").select("printing_id").eq("user_id", authUser.id),
        ]);
      }

      setProfile(prof);
      setSetRow(setData);
      setPricesUpdatedAt(userSetData?.prices_updated_at || null);
      if (authUser) {
        setEditionMode(userSetData?.edition_mode || "any");
      } else {
        setEditionMode(getAnonEditionMode(setId));
      }
      const gmCardIds = new Set((gmPrintingData || []).map((p) => p.card_id));
      setCards((cardData || []).filter((c) => !gmCardIds.has(c.id)));
      setGmPrintings(gmPrintingData || []);
      setFavourites(new Set((favsData || []).map((f) => f.printing_id)));

      const groupedPrintings = {};
      (printingData || []).forEach((p) => {
        if (!groupedPrintings[p.card_number]) groupedPrintings[p.card_number] = [];
        groupedPrintings[p.card_number].push(p);
      });
      setPrintingsByCard(groupedPrintings);

      const ownedMap = {};
      (entriesData || []).forEach((e) => {
        if (e.printing_id) {
          ownedMap[e.printing_id] = { checked: e.checked, photo_url: e.photo_url, card_number: e.card_number, duplicate_count: e.duplicate_count || 0, trade_flagged: e.trade_flagged || false };
        }
      });
      setOwnedPrintings(ownedMap);

      setAuthChecked(true);
    })();
  }, [setId, router, supabase]);

  const sections = useMemo(() => {
    const grouped = {};
    for (const c of cards) {
      const b = rarityBucket(c.rarity, c.subtypes, c.number, setRow?.total, c.supertype);
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

  const handleEditionModeChange = (mode) => {
    setEditionMode(mode);
    if (!isAnonymous && user) {
      supabase.from("user_sets").update({ edition_mode: mode }).eq("user_id", user.id).eq("set_id", setId).then(() => {});
    } else {
      setAnonEditionMode(setId, mode);
    }
  };

  useEffect(() => () => {
    Object.values(dupTimersRef.current).forEach(clearTimeout);
  }, []);

  const THRESHOLDS = [5, 15, 30, 50];

  // Anonymous: re-arm blocking modal at 5/15/30/50 cards across all sets
  useEffect(() => {
    if (!isAnonymous) return;
    const count = anonCollection.totalCount;
    for (const threshold of THRESHOLDS) {
      if (count >= threshold && !thresholdsFiredRef.current.has(threshold)) {
        thresholdsFiredRef.current.add(threshold);
        setBlockerTrigger("card_threshold");
        break;
      }
    }
  }, [isAnonymous, anonCollection.totalCount]);

  // Restore toast: show after migration if this set was migrated
  useEffect(() => {
    if (isAnonymous) return;
    try {
      const raw = sessionStorage.getItem("ms_show_restore_toast");
      if (!raw) return;
      sessionStorage.removeItem("ms_show_restore_toast");
      const parsed = JSON.parse(raw);
      if (!parsed.setIds?.includes(setId)) return;
      setRestoreToast(parsed);
      setTimeout(() => setRestoreToast(null), 5000);
    } catch { /* ignore */ }
  }, [isAnonymous, setId]);

  // Anonymous: warn before unloading when there are unsaved cards
  useEffect(() => {
    if (!isAnonymous || anonCollection.totalCount === 0) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isAnonymous, anonCollection.totalCount]);

  // Full-set completion detection — fires only on real-time transition, not initial load.
  // ALWAYS uses slot-level ('any') semantics regardless of edition_mode so that
  // switching modes never re-fires the celebration or re-upserts master_completions.
  useEffect(() => {
    if (!authChecked) return;
    const gatePct = totalSlots > 0 ? (ownedSlotCount / totalSlots) * 100 : 0;
    if (prevSetPctRef.current === null) {
      prevSetPctRef.current = gatePct;
      return;
    }
    const prev = prevSetPctRef.current;
    prevSetPctRef.current = gatePct;
    if (prev < 100 && gatePct >= 100) {
      setShimmerMain(true);
      setTimeout(() => setShimmerMain(false), 1100);
      const item = { type: "master", setName: setRow?.name || "", setLogoUrl: setRow?.logo_url || "" };
      setCelebration((cur) => { if (!cur) return item; celebrationQueueRef.current.push(item); return cur; });
      if (user) {
        supabase.from("master_completions").upsert({ user_id: user.id, set_id: setId }, { onConflict: "user_id,set_id" }).then(() => {});
      }
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

  const handleFlagToggle = (printingId) => {
    if (!user) return;
    const cur = ownedPrintingsRef.current[printingId] || {};
    const newFlag = !cur.trade_flagged;
    setOwnedPrintings((prev) => ({
      ...prev,
      [printingId]: { ...prev[printingId], trade_flagged: newFlag },
    }));
    supabase
      .from("collection_entries")
      .update({ trade_flagged: newFlag })
      .eq("user_id", user.id)
      .eq("set_id", setId)
      .eq("card_number", cur.card_number)
      .eq("printing_id", printingId)
      .then(({ error }) => {
        if (error) {
          console.error("[trade-flag] update failed:", error.message);
          setOwnedPrintings((prev) => ({
            ...prev,
            [printingId]: { ...prev[printingId], trade_flagged: cur.trade_flagged },
          }));
        }
      });
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

        // Auto-remove from favourites when all printings of this card are now owned
        const cardPrints = printingsByCard[printing.card_number] || [];
        const updatedOwned = { ...ownedPrintings, [printing.id]: { checked: true } };
        const isCardComplete = cardPrints.length > 0 && cardPrints.every((p) => updatedOwned[p.id]?.checked);
        if (isCardComplete) {
          const toRemove = cardPrints.map((p) => p.id).filter((id) => favourites.has(id));
          if (toRemove.length > 0) {
            setFavourites((prev) => { const next = new Set(prev); toRemove.forEach((id) => next.delete(id)); return next; });
            supabase.from("favourites").delete().eq("user_id", user.id).in("printing_id", toRemove).then(() => {});
          }
        }

        // HIDDEN FOR LAUNCH: GM completion detection disabled. Uncomment to re-enable.
        // if (gmPrintings.length > 0) {
        //   const updatedOwned = { ...ownedPrintings, [printing.id]: { checked: true } };
        //   const allMasterPrints = Object.values(printingsByCard).flat();
        //   const isMasterComplete = allMasterPrints.length > 0 && allMasterPrints.every((p) => updatedOwned[p.id]?.checked);
        //   if (isMasterComplete && gmPrintings.every((p) => updatedOwned[p.id]?.checked)) {
        //     supabase.from("grand_master_completions").upsert({ user_id: user.id, set_id: setId }, { onConflict: "user_id,set_id" }).then(() => {});
        //     const gmItem = { type: "grand_master", setName: setRow?.name || "", setLogoUrl: setRow?.logo_url || "" };
        //     setCelebration((cur) => { if (!cur) return gmItem; celebrationQueueRef.current.push(gmItem); return cur; });
        //   }
        // }

        await supabase.from("collection_entries").upsert(
          {
            user_id: user.id,
            set_id: setId,
            card_number: printing.card_number,
            printing_id: printing.id,
            checked: true,
            photo_url: cur.photo_url ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,set_id,card_number,printing_id" }
        );
        fetch("/api/feed/record-milestone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setId }),
        }).catch((err) => console.warn("[feed] milestone record failed:", err));
      } else {
        // Unticking — if duplicates exist, show confirm dialog first
        if ((cur.duplicate_count || 0) > 0) {
          setDupConfirmPrinting(printing);
          // Revert optimistic state update while dialog is pending
          setOwnedPrintings((prev) => ({ ...prev, [printing.id]: cur }));
          return;
        }
        setOwnedPrintings((prev) => { const next = { ...prev }; delete next[printing.id]; return next; });
        await supabase
          .from("collection_entries")
          .delete()
          .eq("user_id", user.id)
          .eq("set_id", setId)
          .eq("card_number", printing.card_number)
          .eq("printing_id", printing.id);
      }
    },
    [user, ownedPrintings, supabase, setId, favourites, gmPrintings, setRow, printingsByCard]
  );

  const triggerPhoto = (printing, e) => {
    e.stopPropagation();
    if (isAnonymous) { setBlockerTrigger("auth_required"); return; }
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
        // EXIF strip: canvas.toBlob() produces a fresh JPEG from pixel data only.
        // The original file (which may contain GPS coordinates) is not propagated.
        // Resize and strip happen together in this single canvas pass.
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
    return (
      <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>Loading…</div>
      </MSShell>
    );
  }

  if (!setRow) {
    return (
      <MSShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, padding: "0 16px", textAlign: "center" }}>
          <p className="text-[var(--po-text-dim)] mb-3">Set not found.</p>
          <Link href="/" className="text-[var(--po-green)] underline text-sm">Back to my sets</Link>
        </div>
      </MSShell>
    );
  }

  const isCardOwned = (cardNumber) => {
    const prints = printingsByCard[cardNumber] || [];
    return prints.some((p) => ownedPrintings[p.id]?.checked);
  };
  const allPrintings = cards.flatMap((c) => printingsByCard[c.number] || []);

  // Slot-level counts: edition prefixes collapse (first_edition + unlimited → same slot).
  // Modern sets: each distinct printing type is its own slot (restores printing-level behaviour).
  const cardSlotKeys = {};
  const cardOwnedSlotKeys = {};
  for (const card of cards) {
    cardSlotKeys[card.number] = new Set();
    cardOwnedSlotKeys[card.number] = new Set();
    for (const p of (printingsByCard[card.number] || [])) {
      const st = stripEditionPrefix(p.printing_type);
      cardSlotKeys[card.number].add(st);
      if (ownedPrintings[p.id]?.checked) cardOwnedSlotKeys[card.number].add(st);
    }
  }
  // totalSlots / ownedSlotCount: always slot-level; used for the master_completions gate
  const totalSlots = cards.reduce((s, c) => s + (cardSlotKeys[c.number]?.size || 0), 0);
  const ownedSlotCount = cards.reduce((s, c) => s + (cardOwnedSlotKeys[c.number]?.size || 0), 0);

  // Edition mode helpers — getActivePrints lives above with the hooks (it
  // reads the activePrintsByCard memo so CardCell gets stable array props).
  const modeOwnedForCard = (cardNumber) => {
    if (editionMode === "any") return cardOwnedSlotKeys[cardNumber]?.size || 0;
    return getActivePrints(cardNumber).filter((p) => ownedPrintings[p.id]?.checked).length;
  };
  const modeTotalForCard = (cardNumber) => {
    if (editionMode === "any") return cardSlotKeys[cardNumber]?.size || 0;
    return getActivePrints(cardNumber).length;
  };

  // Edition dropdown visibility
  const editionOptions = getEditionOptions(allPrintings);
  const showEditionDropdown = editionOptions.length >= 2;

  // Mode-aware headline counts
  const checkedDisplay = cards.reduce((s, c) => s + modeOwnedForCard(c.number), 0);
  const totalDisplay = cards.reduce((s, c) => s + modeTotalForCard(c.number), 0);
  const remainingDisplay = totalDisplay - checkedDisplay;

  // Mode-aware value calculations
  const totalPrintingValue = allPrintings.reduce((s, p) => s + valueOf(p.price_usd, currency), 0);
  const ownedPrintingValue = allPrintings
    .filter((p) => ownedPrintings[p.id]?.checked)
    .reduce((s, p) => s + valueOf(p.price_usd, currency), 0);

  // 'any' mode all-in: cheapest-per-slot, ignoring null/zero prices.
  // Owned value in 'any' mode uses actual checked-printing prices (ownedPrintingValue),
  // not slot-min — market value of what's held; can exceed all-in.
  let anyTotalValue = 0;
  {
    const slotMin = {};
    for (const card of cards) {
      for (const p of (printingsByCard[card.number] || [])) {
        const sk = `${card.number}::${stripEditionPrefix(p.printing_type)}`;
        if (p.price_usd > 0 && (slotMin[sk] === undefined || p.price_usd < slotMin[sk])) {
          slotMin[sk] = p.price_usd;
        }
      }
    }
    for (const v of Object.values(slotMin)) anyTotalValue += valueOf(v, currency);
  }

  // Single-edition value
  let editionTotalValue = 0;
  let editionOwnedValue = 0;
  if (editionMode !== "any" && editionMode !== "all") {
    const edPrints = allPrintings.filter((p) => p.printing_type.startsWith(editionMode));
    editionTotalValue = edPrints.reduce((s, p) => s + valueOf(p.price_usd || 0, currency), 0);
    editionOwnedValue = edPrints.filter((p) => ownedPrintings[p.id]?.checked).reduce((s, p) => s + valueOf(p.price_usd || 0, currency), 0);
  }

  // HIDDEN FOR LAUNCH: GM value excluded from aggregates. Restore + gmOwnedValue / + gmTotalValue to re-enable.
  // Owned value: actual market value of checked printings in all modes; only single-edition modes filter to that edition.
  const ownedValueDisplay = (editionMode === "any" || editionMode === "all") ? ownedPrintingValue : editionOwnedValue;
  const totalValueDisplay = editionMode === "any" ? anyTotalValue : editionMode === "all" ? totalPrintingValue : editionTotalValue;
  const remainingValueDisplay = totalValueDisplay - ownedValueDisplay;

  const gmOwnedCount = gmPrintings.filter((p) => ownedPrintings[p.id]?.checked).length;
  const gmTotalCount = gmPrintings.length;
  const gmOwnedValue = gmPrintings.filter((p) => ownedPrintings[p.id]?.checked).reduce((s, p) => s + valueOf(p.price_usd, currency), 0);
  const gmTotalValue = gmPrintings.reduce((s, p) => s + valueOf(p.price_usd, currency), 0);

  const themePrimary = setRow.theme_primary || "#b9ff3c";
  const themeSecondary = setRow.theme_secondary || "#c084fc";
  const userCountry = { AUD: "AU", USD: "US", GBP: "UK" }[currency] || "AU";

  const missingFilter = (card) => {
    if (justCollected.has(card.number)) return true;
    return modeOwnedForCard(card.number) < modeTotalForCard(card.number);
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

  // Cell-facing handlers: reassigned every render so they close over current
  // state; CardCell receives the stable wrappers from cellHandlers (memoised
  // above). The anonymous/authed branching lives here, never in the cell.
  cellHandlersRef.current = {
    onTapCard: (card) => {
      const prints = getActivePrints(card.number);
      if (isAnonymous) {
        if (prints.length === 1) {
          if (ownedPrintings[prints[0].id]?.checked) {
            anonCollection.updateQuantity(prints[0].id, 0);
          } else {
            anonCollection.addPrinting(prints[0].id);
          }
        } else {
          setPickingCard(card);
        }
        return;
      }
      if (prints.length === 1) togglePrinting(prints[0]);
      else setPickingCard(card);
    },
    onOpenPicker: (card) => setPickingCard(card),
    onToggleFavourite: async (card, favPrintId, isFav) => {
      if (!user) { setBlockerTrigger("auth_required"); return; }
      if (isFav) {
        setFavourites((prev) => { const next = new Set(prev); next.delete(favPrintId); return next; });
        supabase.from("favourites").delete().eq("user_id", user.id).eq("printing_id", favPrintId).then(() => {});
      } else if (favourites.size >= 6) {
        setFavSheet({ targetPrintingId: favPrintId, cardName: card.name });
      } else {
        setFavourites((prev) => new Set([...prev, favPrintId]));
        supabase.from("favourites").insert({ user_id: user.id, printing_id: favPrintId }).then(async () => {
          // Enqueue for pool refresh if not already in marketplace_pool
          const { data: poolMatch } = await supabase
            .from("marketplace_pool")
            .select("printing_id")
            .eq("printing_id", favPrintId)
            .maybeSingle();
          if (!poolMatch) {
            await supabase.from("pool_requests").upsert(
              { printing_id: favPrintId, user_id: user.id },
              { onConflict: "printing_id,user_id", ignoreDuplicates: true }
            );
          }
        });
        clearTimeout(favToastTimerRef.current);
        setFavToast(true);
        favToastTimerRef.current = setTimeout(() => setFavToast(false), 2000);
      }
    },
    onDupChange: (printingId, delta) => {
      if (isAnonymous) {
        const cur = ownedPrintings[printingId];
        const currentQty = cur?.checked ? (cur.duplicate_count || 0) + 1 : 0;
        anonCollection.updateQuantity(printingId, Math.max(0, currentQty + delta));
      } else {
        handleDupChange(printingId, delta);
      }
    },
    onFlagToggle: (printingId) => handleFlagToggle(printingId),
  };

  const renderCard = (card) => {
    const prints = getActivePrints(card.number);
    const checkedCount = modeOwnedForCard(card.number);
    const modeTotal = modeTotalForCard(card.number);
    const completionState =
      modeTotal === 0 || checkedCount === 0 ? "uncollected"
      : checkedCount >= modeTotal ? "complete"
      : "partial";
    const minPriceUsd = prints.reduce((m, p) => Math.min(m, p.price_usd > 0 ? p.price_usd : Infinity), Infinity);
    const cardPrice = Number.isFinite(minPriceUsd) ? valueOf(minPriceUsd, currency) : null;
    const bucket = rarityBucket(card.rarity, card.subtypes, card.number, setRow?.total, card.supertype);
    const firstEntry = prints.length > 0 ? ownedPrintings[prints[0].id] : undefined;

    return (
      <CardCell
        key={card.id}
        card={card}
        prints={prints}
        checkedCount={checkedCount}
        modeTotal={modeTotal}
        completionState={completionState}
        priceLabel={cardPrice !== null ? fmtMoney(cardPrice, currency) : null}
        photoUrl={prints.map((p) => ownedPrintings[p.id]).find((e) => e?.photo_url)?.photo_url || null}
        tint={RARITY_TINT[bucket]}
        dotPattern={prints.map((p) => (ownedPrintings[p.id]?.checked ? "1" : "0")).join("")}
        dupCount={firstEntry?.duplicate_count || 0}
        tradeFlagged={!!firstEntry?.trade_flagged}
        isFav={prints.length > 0 ? favourites.has(prints[0].id) : false}
        isJustCollected={view === "missing" && justCollected.has(card.number)}
        collectorNumber={card.number && setRow.total
          ? `${String(card.number).padStart(3, "0")}/${String(setRow.total).padStart(3, "0")}`
          : card.number ? String(card.number).padStart(3, "0") : ""}
        themePrimary={themePrimary}
        userCountry={userCountry}
        isAnonymous={isAnonymous}
        onTapCard={cellHandlers.onTapCard}
        onOpenPicker={cellHandlers.onOpenPicker}
        onToggleFavourite={cellHandlers.onToggleFavourite}
        onDupChange={cellHandlers.onDupChange}
        onFlagToggle={cellHandlers.onFlagToggle}
      />
    );
  };

  const pct = totalDisplay > 0 ? (checkedDisplay / totalDisplay) * 100 : 0;

  const switchView = (v) => {
    setView(v);
    localStorage.setItem("po:setView", v);
  };

  const dismissCelebration = () => {
    const next = celebrationQueueRef.current.shift();
    setCelebration(next || null);
  };

  return (
    <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
      {celebration && (
        <AchievementCelebration
          type={celebration.type}
          setName={celebration.setName}
          setLogoUrl={celebration.setLogoUrl}
          onDismiss={dismissCelebration}
        />
      )}
      {favToast && (
        <Link
          href="/favourites"
          className="ms-pressable"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "rgba(5,5,7,0.96)",
            border: "1px solid rgba(255,184,48,0.4)",
            borderRadius: 10,
            color: "#FFB830",
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            textDecoration: "none",
          }}
        >
          ★ Added to favourites · View →
        </Link>
      )}
      <MSPageTitle sub={setRow.series || ""}>{setRow.name}</MSPageTitle>

      <div className="px-4 pt-0 pb-3" style={{ borderBottom: `1px solid ${themePrimary}30` }}>
        {/* Controls row */}
        <div className="flex items-center justify-end gap-2 mb-3">
          {showEditionDropdown && (
            <div className="relative">
              <select
                value={editionMode}
                onChange={(e) => handleEditionModeChange(e.target.value)}
                className="text-[10px] uppercase tracking-widest pl-2 pr-6 py-1.5 rounded-lg cursor-pointer appearance-none"
                style={
                  editionMode !== "any"
                    ? { background: themePrimary, color: "#050507", border: `1px solid ${themePrimary}`, fontWeight: 700 }
                    : { background: "var(--po-bg-soft)", color: "var(--po-text-dim)", border: "1px solid var(--po-border)" }
                }
              >
                <option value="any">Edition: Any</option>
                <option value="all">Edition: All</option>
                {editionOptions.includes("first_edition") && <option value="first_edition">Edition: 1st Ed.</option>}
                {editionOptions.includes("unlimited") && <option value="unlimited">Edition: Unlimited</option>}
                {editionOptions.includes("shadowless") && <option value="shadowless">Edition: Shadowless</option>}
              </select>
              <ChevronDown
                size={10}
                strokeWidth={2.5}
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: editionMode !== "any" ? "#050507" : "var(--po-text-dim)",
                }}
              />
            </div>
          )}
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
          {!isAnonymous && (
            <button
              onClick={() => setResetConfirm(true)}
              className="ms-pressable text-[10px] uppercase tracking-widest px-2 py-1.5 rounded-lg border border-[var(--po-border)]"
              style={{ color: "var(--po-text-dim)" }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Set hero: logo + name + series */}
        <div className="flex gap-3 items-center mb-4">
          <BackButton />
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
                className="ms-pressable flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] rounded-lg transition-colors"
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
      </div>

      <div className="px-3 py-4">
        {view === "rarity" ? (
          <div className="space-y-2">
            {viewSections.length === 0 && (
              <div className="text-center text-[var(--po-text-dim)] text-sm py-12">All cards collected — nothing missing!</div>
            )}
            {viewSections.map((section) => {
              const isOpen = !!openSections[section.id];
              const dot = RARITY_DOT[section.id] || "#ffffff";
              const sectionOwned = section.cards.reduce((s, c) => s + modeOwnedForCard(c.number), 0);
              const sectionTotal = section.cards.reduce((s, c) => s + modeTotalForCard(c.number), 0);
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
                  {/* Only build cell elements for open sections — collapsed
                      sections previously created (but never mounted) every
                      cell's element tree on every render. */}
                  {isOpen ? section.displayCards.map(renderCard) : null}
                </RaritySection>
              );
            })}

            {/* Grand Master section — HIDDEN FOR LAUNCH: change `false &&` to remove when re-enabling */}
            {false && gmTotalCount > 0 && (
              <div style={{ marginTop: 24, borderTop: "1px solid rgba(244,244,246,0.08)", paddingTop: 16 }}>
                <button
                  onClick={() => setGrandMasterExpanded((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#FFB830",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                    padding: "8px 0",
                  }}
                >
                  <span>✦ GRAND MASTER</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "rgba(244,244,246,0.4)", fontSize: 11, fontWeight: 400 }}>
                      {gmOwnedCount}/{gmTotalCount} · not counted in set completion
                    </span>
                    <ChevronDown
                      size={14}
                      style={{
                        color: "#FFB830",
                        transform: grandMasterExpanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                      }}
                    />
                  </span>
                </button>

                {grandMasterExpanded && (
                  <div>
                    <p style={{ fontSize: 11, color: "rgba(244,244,246,0.38)", fontFamily: '"IBM Plex Mono", monospace', marginBottom: 12, lineHeight: 1.5 }}>
                      Promos and product exclusives beyond the standard master set. These do not count toward set completion.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {gmPrintings.map((printing) => {
                        const gmCard = printing.card;
                        if (!gmCard) return null;
                        const isOwned = !!ownedPrintings[printing.id]?.checked;
                        return (
                          <div key={printing.id} className="flex flex-col">
                            <div
                              onClick={() => togglePrinting(printing)}
                              className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden cursor-pointer select-none active:scale-[0.98] transition-transform"
                              style={{
                                boxShadow: isOwned
                                  ? "0 4px 20px rgba(0,0,0,0.5), 0 0 16px rgba(255,184,48,0.35)"
                                  : "0 2px 10px rgba(0,0,0,0.4)",
                                outline: isOwned ? "2px solid #FFB830" : "none",
                              }}
                            >
                              <CardArt src={gmCard.image_large} name={gmCard.name} ownershipState={isOwned ? "complete" : "uncollected"} themePrimary="#FFB830" />
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                PROMO
                              </div>
                              {isOwned ? (
                                <div
                                  className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center"
                                  style={{ background: "#FFB830", color: "#000", boxShadow: "0 0 8px rgba(255,184,48,0.8)" }}
                                >
                                  <Check size={16} strokeWidth={3} />
                                </div>
                              ) : (
                                <FindOnline
                                  cardName={gmCard.name}
                                  collectorNumber=""
                                  rarity={gmCard.rarity}
                                  userCountry={userCountry}
                                />
                              )}
                            </div>
                            <div className="text-center text-[11px] font-bold mt-1 truncate" style={{ color: "#FFB830" }}>
                              {gmCard.name}
                            </div>
                            <div className="text-center text-[10px]" style={{ color: "rgba(244,244,246,0.38)" }}>
                              {printing.printing_label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : view === "binder" ? (
          <VirtualCardGrid items={viewCards} renderItem={renderCard} />
        ) : (
          // Missing view
          viewCards.length > 0 ? (
            <div>
              <div className="flex justify-between items-baseline mb-3 px-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em]">{viewCards.length} cards remaining</div>
                <div className="text-[11px] tabular-nums" style={{ color: "var(--po-text-dim)" }}>
                  {fmtMoney(
                    viewCards.reduce((s, c) => {
                      const prints = getActivePrints(c.number);
                      const min = prints.reduce((m, p) => Math.min(m, p.price_usd > 0 ? p.price_usd : Infinity), Infinity);
                      return s + (Number.isFinite(min) ? min * (RATES[currency]?.rate || 1) : 0);
                    }, 0),
                    currency
                  )} to complete
                </div>
              </div>
              <div className="mb-3 px-1">
                <Link
                  href={`/want-lists/new?sets=${setId}`}
                  className="ms-pressable"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "7px 12px",
                    background: "rgba(200,255,74,0.06)",
                    border: "0.5px solid rgba(200,255,74,0.25)",
                    borderRadius: 8,
                    color: "var(--po-green)",
                    fontSize: 11, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  + Create Want List
                </Link>
              </div>
              <VirtualCardGrid items={viewCards} renderItem={renderCard} />
            </div>
          ) : (
            <div className="text-center text-[var(--po-text-dim)] text-sm py-12">All cards collected — nothing missing!</div>
          )
        )}
      </div>

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
                className="ms-pressable flex-1 py-2 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-sm font-bold text-[var(--po-text)]"
              >
                Cancel
              </button>
              <button
                onClick={reset}
                disabled={resetTyped.trim().toUpperCase() !== setRow.code.toUpperCase()}
                className="ms-pressable flex-1 py-2 bg-rose-700 disabled:bg-rose-900 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
              >
                Reset everything
              </button>
            </div>
          </div>
        </div>
      )}

      {favSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
          onClick={() => setFavSheet(null)}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-t-2xl w-full max-w-sm px-5 pt-4 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--po-border)] rounded-full mx-auto mb-4" />
            <h2 className="text-base font-bold mb-1">Favourites full</h2>
            <p className="text-xs text-[var(--po-text-dim)] mb-4">
              Remove a favourite to add <span className="font-bold text-[var(--po-text)]">{favSheet.cardName}</span>.
            </p>
            <div className="space-y-1">
              {[...favourites].map((printId) => {
                const favCard = cards.find((c) => (printingsByCard[c.number] || []).some((p) => p.id === printId));
                const favPrint = Object.values(printingsByCard).flat().find((p) => p.id === printId);
                return (
                  <div key={printId} className="flex items-center justify-between py-2.5 border-b border-[var(--po-border)] last:border-0">
                    <div>
                      <div className="text-sm font-bold">{favCard?.name || "—"}</div>
                      {favPrint && <div className="text-[10px]" style={{ color: "var(--po-text-dim)" }}>{favPrint.printing_label}</div>}
                    </div>
                    <button
                      onClick={async () => {
                        setFavourites((prev) => { const next = new Set(prev); next.delete(printId); return next; });
                        await supabase.from("favourites").delete().eq("user_id", user.id).eq("printing_id", printId);
                        if (favSheet.targetPrintingId) {
                          setFavourites((prev) => new Set([...prev, favSheet.targetPrintingId]));
                          const swapPrintId = favSheet.targetPrintingId;
                          supabase.from("favourites").insert({ user_id: user.id, printing_id: swapPrintId }).then(async () => {
                            // Enqueue for pool refresh if not already in marketplace_pool
                            const { data: poolMatch } = await supabase
                              .from("marketplace_pool")
                              .select("printing_id")
                              .eq("printing_id", swapPrintId)
                              .maybeSingle();
                            if (!poolMatch) {
                              await supabase.from("pool_requests").upsert(
                                { printing_id: swapPrintId, user_id: user.id },
                                { onConflict: "printing_id,user_id", ignoreDuplicates: true }
                              );
                            }
                          });
                        }
                        setFavSheet(null);
                      }}
                      className="ms-pressable text-xs font-bold px-3 py-1.5 rounded-lg border"
                      style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setFavSheet(null)} className="ms-pressable w-full py-2 text-xs text-[var(--po-text-dim)] mt-4">Cancel</button>
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
              <button onClick={() => setPickingCard(null)} className="ms-pressable text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1">
              {getActivePrints(pickingCard.number).map((p) => {
                const isOwned = !!ownedPrintings[p.id]?.checked;
                const dc = ownedPrintings[p.id]?.duplicate_count || 0;
                const v = valueOf(p.price_usd, currency);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isAnonymous) {
                        if (ownedPrintings[p.id]?.checked) {
                          anonCollection.updateQuantity(p.id, 0);
                        } else {
                          anonCollection.addPrinting(p.id);
                        }
                      } else {
                        togglePrinting(p);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (isAnonymous) {
                          if (ownedPrintings[p.id]?.checked) {
                            anonCollection.updateQuantity(p.id, 0);
                          } else {
                            anonCollection.addPrinting(p.id);
                          }
                        } else {
                          togglePrinting(p);
                        }
                      }
                    }}
                    className="ms-pressable flex items-center justify-between py-2.5 border-b border-[var(--po-border)] last:border-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        onClick={() => {
                          if (isAnonymous) {
                            if (ownedPrintings[p.id]?.checked) {
                              anonCollection.updateQuantity(p.id, 0);
                            } else {
                              anonCollection.addPrinting(p.id);
                            }
                          } else {
                            togglePrinting(p);
                          }
                        }}
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition cursor-pointer"
                        style={{
                          background: isOwned ? themePrimary : "transparent",
                          border: `2px solid ${isOwned ? themePrimary : "var(--po-border)"}`,
                        }}
                      >
                        {isOwned && <Check size={12} strokeWidth={3} className="text-black" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{p.printing_label}</div>
                        <div className="text-[10px] text-[var(--po-text-dim)] tabular-nums">{fmtMoney(v, currency)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {isOwned && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAnonymous) {
                                const currentQty = ownedPrintings[p.id]?.checked
                                  ? (ownedPrintings[p.id]?.duplicate_count || 0) + 1
                                  : 0;
                                anonCollection.updateQuantity(p.id, Math.max(0, currentQty - 1));
                              } else {
                                handleDupChange(p.id, -1);
                              }
                            }}
                            disabled={dc === 0}
                            className="ms-pressable w-7 h-7 rounded-full bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-sm flex items-center justify-center disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="text-sm font-black tabular-nums w-6 text-center" style={{ color: themePrimary }}>
                            {dc}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAnonymous) {
                                const currentQty = ownedPrintings[p.id]?.checked
                                  ? (ownedPrintings[p.id]?.duplicate_count || 0) + 1
                                  : 0;
                                anonCollection.updateQuantity(p.id, currentQty + 1);
                              } else {
                                handleDupChange(p.id, 1);
                              }
                            }}
                            className="ms-pressable w-7 h-7 rounded-full bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] text-sm flex items-center justify-center"
                          >
                            +
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => triggerPhoto(p, e)}
                        className="ms-pressable w-8 h-8 rounded-full bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] flex items-center justify-center"
                        aria-label="Add photo"
                      >
                        <Camera size={14} />
                      </button>
                      {isOwned && !isAnonymous && (() => {
                        const isFlagged = !!ownedPrintings[p.id]?.trade_flagged;
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFlagToggle(p.id); }}
                            title={isFlagged ? "Remove from trade binder" : "Add to trade binder"}
                            className="ms-pressable w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center"
                            style={{
                              background: isFlagged ? "rgba(200,255,74,0.15)" : "var(--po-bg-soft)",
                              border: `1px solid ${isFlagged ? "#c8ff4a" : "var(--po-border)"}`,
                              color: isFlagged ? "#c8ff4a" : "var(--po-text-dim)",
                            }}
                          >
                            ⇄
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center mt-3">
              <FindOnline
                cardName={pickingCard.name}
                collectorNumber={pickingCard.number && setRow.total
                  ? `${String(pickingCard.number).padStart(3, "0")}/${String(setRow.total).padStart(3, "0")}`
                  : pickingCard.number ? String(pickingCard.number).padStart(3, "0") : ""}
                rarity={pickingCard.rarity}
                userCountry={userCountry}
                inline
              />
            </div>
            <button onClick={() => setPickingCard(null)} className="ms-pressable w-full py-2 text-xs text-[var(--po-text-dim)] mt-1">
              Close
            </button>
          </div>
        </div>
      )}
      {dupConfirmPrinting && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
          onClick={() => setDupConfirmPrinting(null)}
        >
          <div
            className="bg-[var(--po-bg-soft)] border border-rose-800/60 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-rose-300 mb-2">Remove from collection?</h2>
            <p className="text-sm text-[var(--po-text-dim)] mb-4">
              This printing has{" "}
              <span className="text-[var(--po-text)] font-bold">
                {ownedPrintings[dupConfirmPrinting.id]?.duplicate_count || 0}{" "}
                {(ownedPrintings[dupConfirmPrinting.id]?.duplicate_count || 0) === 1 ? "duplicate" : "duplicates"}
              </span>{" "}
              recorded. Removing it will delete the entry and all duplicate counts.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDupConfirmPrinting(null)}
                className="ms-pressable flex-1 py-2 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-sm font-bold text-[var(--po-text)]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const printing = dupConfirmPrinting;
                  setDupConfirmPrinting(null);
                  setOwnedPrintings((prev) => { const next = { ...prev }; delete next[printing.id]; return next; });
                  await supabase
                    .from("collection_entries")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("set_id", setId)
                    .eq("card_number", printing.card_number)
                    .eq("printing_id", printing.id);
                }}
                className="ms-pressable flex-1 py-2 bg-rose-700 text-white rounded-lg text-sm font-bold"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {restoreToast && (
        <div
          onClick={() => setRestoreToast(null)}
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "rgba(5,5,7,0.96)",
            border: "1px solid rgba(200,255,74,0.35)",
            borderRadius: 10,
            color: "var(--po-green)",
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            cursor: "pointer",
          }}
        >
          ✓ {restoreToast.count} {restoreToast.count === 1 ? "card" : "cards"} restored to your collection
        </div>
      )}
      <ReportCardFAB setId={setId} />
      <EditionExplainerSheet
        show={showEditionDropdown}
        editionOptions={editionOptions}
        blockerOpen={!!blockerTrigger}
      />
      <AnonymousCollectionBlocker
        open={!!blockerTrigger}
        trigger={blockerTrigger}
        count={anonCollection.totalCount}
        valueUsd={anonCollection.totalValueUsd}
        onSignUp={() => {
          captureCollectionMigrationIntent();
          window.location.href = "/welcome?intentType=collection_migration";
        }}
        onDismiss={() => setBlockerTrigger(null)}
      />
    </MSShell>
  );
}
