"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, X, Camera, Trash2, ArrowLeft, ChevronDown, LayoutGrid, BookOpen } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const valueOf = (priceUsd, currency) => (priceUsd || 0) * (RATES[currency]?.rate || 1);
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
  if (r === "double rare")               return "double_rare";
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
  "double_rare", "illustration_rare", "ace_spec",
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
  double_rare: "Double Rare", illustration_rare: "Illustration Rare",
  ultra_rare: "Full Art", ace_spec: "ACE SPEC", mega_attack_rare: "Mega Attack Rare",
  sir: "Special Illustration Rare", hyper_rare: "Hyper Rare",
  mega_hyper_rare: "Mega Hyper Rare", shiny_rare: "Shiny Rare",
  shiny_ultra_rare: "Shiny Ultra Rare", promo: "Promo",
};
const RARITY_TINT = {
  gx:                "rgba(59,130,246,0.38)",
  v:                 "rgba(59,130,246,0.38)",
  double_rare:       "rgba(59,130,246,0.38)",
  vmax:              "rgba(139,92,246,0.38)",
  vstar:             "rgba(139,92,246,0.38)",
  illustration_rare: "rgba(34,197,94,0.38)",
  full_art:          "rgba(34,197,94,0.38)",
  v_full_art:        "rgba(34,197,94,0.38)",
  ultra_rare:        "rgba(249,115,22,0.38)",
  alt_art:           "rgba(249,115,22,0.38)",
  trainer_gallery:   "rgba(249,115,22,0.38)",
  rainbow_rare:      "rgba(244,63,94,0.38)",
  sir:               "rgba(244,63,94,0.38)",
  mega_attack_rare:  "rgba(244,63,94,0.38)",
  hyper_rare:        "rgba(234,179,8,0.38)",
  mega_hyper_rare:   "rgba(234,179,8,0.38)",
  gold_rare:         "rgba(234,179,8,0.38)",
  shiny_rare:        "rgba(20,184,166,0.38)",
  shiny_ultra_rare:  "rgba(20,184,166,0.38)",
  shiny:             "rgba(20,184,166,0.38)",
  ace_spec:          "rgba(239,68,68,0.38)",
  prism_star:        "rgba(99,102,241,0.38)",
};

function CardArt({ src, name, isOwned, themePrimary }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 text-center ${isOwned ? "" : "grayscale opacity-30"}`}
        style={{ background: `linear-gradient(135deg, ${themePrimary}33, #0a0e0a)` }}
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
      className={`w-full h-full object-cover transition-all duration-300 ${isOwned ? "" : "grayscale opacity-30"}`}
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
  const [masterSet, setMasterSet] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetTyped, setResetTyped] = useState("");
  const fileInputRef = useRef(null);
  const photoTargetRef = useRef(null);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
    const m = localStorage.getItem("po:masterSet");
    if (m !== null) setMasterSet(m === "true");
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const [{ data: prof }, { data: setData }, { data: cardData }, { data: printingData }, { data: entriesData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("sets").select("*").eq("id", setId).maybeSingle(),
        supabase.from("cards").select("*").eq("set_id", setId).order("number", { ascending: true }),
        supabase.from("printings").select("*").eq("set_id", setId).order("display_order", { ascending: true }),
        supabase
          .from("collection_entries")
          .select("printing_id, card_number, checked, photo_url")
          .eq("user_id", user.id)
          .eq("set_id", setId),
      ]);

      setProfile(prof);
      setSetRow(setData);
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
          ownedMap[e.printing_id] = { checked: e.checked, photo_url: e.photo_url, card_number: e.card_number };
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

  const toggleMasterSet = () => {
    const next = !masterSet;
    setMasterSet(next);
    localStorage.setItem("po:masterSet", String(next));
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

  const checkedDisplay = ownedCardCount;
  const totalDisplay = totalCards;
  const remainingDisplay = totalDisplay - checkedDisplay;
  const ownedValueDisplay = ownedCardValue;
  const totalValueDisplay = totalCardValue;
  const remainingValueDisplay = totalValueDisplay - ownedValueDisplay;

  const themePrimary = setRow.theme_primary || "#b9ff3c";
  const themeSecondary = setRow.theme_secondary || "#c084fc";

  const renderCard = (card) => {
    const prints = printingsByCard[card.number] || [];
    const ownedCount = cardOwnedCount(card.number);
    const owned = ownedCount > 0;
    const artOwned = ownedCount > 0;
    const bucket = rarityBucket(card.rarity, card.subtypes, card.number, setRow?.total);
    const tint = RARITY_TINT[bucket];
    const photoEntry = prints.map((p) => ownedPrintings[p.id]).find((e) => e?.photo_url);
    const photo = photoEntry?.photo_url;

    return (
      <div key={card.id} className="flex flex-col">
        <div
          onClick={() => prints.length === 1 ? togglePrinting(prints[0]) : setPickingCard(card)}
          className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md cursor-pointer select-none active:scale-[0.98] transition-transform"
        >
          {photo ? (
            <img
              src={photo}
              alt={card.name}
              className={`w-full h-full object-cover transition-all duration-300 ${artOwned ? "" : "grayscale opacity-30"}`}
            />
          ) : (
            <CardArt src={card.image_large} name={card.name} isOwned={artOwned} themePrimary={themePrimary} />
          )}
          {!owned && tint && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: tint }} />
          )}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {String(card.number).padStart(3, "0")}
          </div>
          {owned && (
            <div
              className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: themePrimary, color: "#000", boxShadow: `0 0 8px ${themePrimary}80` }}
            >
              <Check size={16} strokeWidth={3} />
            </div>
          )}
        </div>
        {prints.length > 1 && (
          <div className="flex justify-center gap-1 mt-1">
            {prints.map((p) => {
              const isOwned = !!ownedPrintings[p.id]?.checked;
              return (
                <button
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); togglePrinting(p); }}
                  className="w-3 h-3 rounded-full border transition"
                  style={{
                    background: isOwned ? themePrimary : "transparent",
                    borderColor: isOwned ? themePrimary : "var(--po-text-dim)",
                    boxShadow: isOwned ? `0 0 6px ${themePrimary}80` : "none",
                  }}
                  aria-label={`${p.printing_label} ${isOwned ? "owned" : "missing"}`}
                  title={p.printing_label}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header
        className="sticky top-0 z-20 bg-[var(--po-bg)]/90 backdrop-blur border-b px-4 py-3"
        style={{ borderBottomColor: `${themePrimary}40` }}
      >
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1
                className="font-extrabold uppercase tracking-wider text-lg leading-none"
                style={{
                  background: `linear-gradient(180deg, #ffffff 0%, ${themePrimary} 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {setRow.name}
              </h1>
              <p className="text-[10px] text-[var(--po-text-dim)] mt-0.5">@{profile?.handle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => switchCurrency(e.target.value)}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] px-2 py-1 border border-[var(--po-border)] rounded bg-[var(--po-bg)] cursor-pointer"
            >
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
            <button
              onClick={() => setResetConfirm(true)}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] hover:text-rose-400"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <div className="text-3xl font-black tabular-nums leading-none">
              {checkedDisplay}<span className="text-[var(--po-text-dim)] text-xl">/{totalDisplay}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              {remainingDisplay} cards to go
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums leading-none" style={{ color: themePrimary }}>
              {fmtMoney(ownedValueDisplay, currency)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              owned · {fmtMoney(remainingValueDisplay, currency)} to go
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 w-full bg-[var(--po-bg-soft)] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${totalDisplay > 0 ? (checkedDisplay / totalDisplay) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${themePrimary}, ${themeSecondary})`,
              boxShadow: `0 0 12px ${themePrimary}80`,
            }}
          />
        </div>
        <div className="mt-3">
          <button
            onClick={toggleMasterSet}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold border border-[var(--po-border)] bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] hover:text-[var(--po-text)] hover:border-[var(--po-text-dim)] transition-colors"
          >
            {masterSet ? <BookOpen size={13} /> : <LayoutGrid size={13} />}
            {masterSet ? "Binder View" : "Rarity View"}
          </button>
        </div>
      </header>

      <main className="px-3 py-4">
        {masterSet ? (
          <div className="grid grid-cols-2 gap-3">{cards.map(renderCard)}</div>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => {
              const isOpen = !!openSections[section.id];
              return (
                <div key={section.id} className="border border-[var(--po-border)] rounded-lg overflow-hidden bg-[var(--po-bg-soft)]">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--po-border)]"
                  >
                    <div className="text-left">
                      <div className="font-bold text-sm">{section.label}</div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
                        {section.cards.filter((c) => isCardOwned(c.number)).length}/{section.cards.length}
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-[var(--po-text-dim)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3 border-t border-[var(--po-border)]">
                      {section.cards.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
            <button onClick={() => setPickingCard(null)} className="w-full py-2 text-xs text-[var(--po-text-dim)] mt-3">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
