"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, X, Camera, Trash2, ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const RATES = {
  AUD: { rate: 1.39, symbol: "A$" },
  CAD: { rate: 1.36, symbol: "C$" },
};
const valueOf = (priceUsd, currency) => (priceUsd || 0) * (RATES[currency]?.rate || 1);
const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10) return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

function rarityBucket(rarity, supertype, subtypes) {
  const r = (rarity || "").toLowerCase();
  const subs = (subtypes || []).map((s) => s.toLowerCase());

  if (r.includes("hyper") || r.includes("rainbow")) return "hyper";
  if (r.includes("special illustration")) return "sir";
  if (r.includes("illustration rare") || r === "illustration rare") return "illustration";
  if (subs.some((s) => /(^|\s)(ex|gx|vmax|vstar|v)(\s|$)/.test(s)) || r.includes("double rare")) return "ex";
  if (r.includes("ultra")) return "ultra";
  if (r === "rare" || r === "rare holo" || r.startsWith("rare ")) return "rare";
  if (r === "uncommon") return "uncommon";
  if (r === "common") return "common";
  if (supertype === "Energy") return "energy";
  if (supertype === "Trainer") return "trainer";
  return "other";
}

const BUCKET_ORDER = ["common", "uncommon", "rare", "ex", "ultra", "illustration", "sir", "hyper", "trainer", "energy", "other"];
const BUCKET_LABELS = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  ex: "ex / Mega ex",
  ultra: "Ultra Rare",
  illustration: "Illustration Rare",
  sir: "Special Illustration Rare",
  hyper: "Hyper Rare",
  trainer: "Trainer",
  energy: "Energy",
  other: "Other",
};

function isVariantEligible(rarity, subtypes) {
  const r = (rarity || "").toLowerCase();
  if (!["common", "uncommon", "rare", "rare holo"].includes(r) && !r.startsWith("rare ")) return false;
  if ((subtypes || []).some((s) => /ex|gx|v|vmax|vstar/i.test(s))) return false;
  return true;
}

const VARIANTS = ["Common", "Holo", "Reverse Holo"];

function CardArt({ src, name, isChecked, themePrimary }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 text-center ${isChecked ? "" : "grayscale opacity-30"}`}
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
      className={`w-full h-full object-cover transition-all duration-300 ${isChecked ? "" : "grayscale opacity-30"}`}
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
  const [entries, setEntries] = useState({});
  const [picking, setPicking] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currency, setCurrency] = useState("AUD");
  const [masterSet, setMasterSet] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const fileInputRef = useRef(null);
  const photoTargetRef = useRef(null);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
    const m = localStorage.getItem("po:masterSet");
    if (m !== null) setMasterSet(m === "true");
    const last = localStorage.getItem(`po:lastSection:${setId}`);
    if (last) setOpenSections({ [last]: true });
  }, [setId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const [{ data: prof }, { data: setData }, { data: cardData }, { data: entriesData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("sets").select("*").eq("id", setId).maybeSingle(),
        supabase.from("cards").select("*").eq("set_id", setId).order("number", { ascending: true }),
        supabase
          .from("collection_entries")
          .select("card_number, checked, variant, photo_url")
          .eq("user_id", user.id)
          .eq("set_id", setId),
      ]);

      setProfile(prof);
      setSetRow(setData);
      setCards(cardData || []);
      const map = {};
      (entriesData || []).forEach((e) => {
        map[e.card_number] = e;
      });
      setEntries(map);
      setAuthChecked(true);
    })();
  }, [setId, router, supabase]);

  const sections = useMemo(() => {
    const grouped = {};
    for (const c of cards) {
      const b = rarityBucket(c.rarity, c.supertype, c.subtypes);
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(c);
    }
    return BUCKET_ORDER.filter((b) => grouped[b]?.length).map((b) => ({
      id: b,
      label: BUCKET_LABELS[b],
      cards: grouped[b],
    }));
  }, [cards]);

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    localStorage.setItem(`po:lastSection:${setId}`, id);
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

  const upsertEntry = useCallback(
    async (cardNumber, patch) => {
      if (!user) return;
      const current = entries[cardNumber] || {};
      const next = { ...current, ...patch };
      setEntries((prev) => ({ ...prev, [cardNumber]: next }));
      await supabase.from("collection_entries").upsert(
        {
          user_id: user.id,
          set_id: setId,
          card_number: cardNumber,
          checked: !!next.checked,
          variant: next.variant ?? null,
          photo_url: next.photo_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,set_id,card_number" }
      );
    },
    [user, entries, supabase, setId]
  );

  const toggle = (card) => {
    const cur = entries[card.number] || {};
    const willCheck = !cur.checked;
    if (willCheck) {
      upsertEntry(card.number, { checked: true });
      if (isVariantEligible(card.rarity, card.subtypes) && !cur.variant) setPicking(card);
    } else {
      upsertEntry(card.number, { checked: false, variant: null });
    }
  };

  const setVariant = (card, v) => {
    upsertEntry(card.number, { variant: v });
    setPicking(null);
  };

  const triggerPhoto = (card, e) => {
    e.stopPropagation();
    photoTargetRef.current = card;
    fileInputRef.current?.click();
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    const card = photoTargetRef.current;
    if (!file || !card || !user) return;
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
            const path = `${user.id}/${setId}-${card.number}-${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("Card Photos")
              .upload(path, blob, { contentType: "image/jpeg", upsert: true });
            if (upErr) {
              alert("Upload failed: " + upErr.message);
              return;
            }
            const { data: { publicUrl } } = supabase.storage
              .from("Card Photos")
              .getPublicUrl(path);
            upsertEntry(card.number, { photo_url: publicUrl });
          },
          "image/jpeg",
          0.7
        );
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (card, e) => {
    e.stopPropagation();
    upsertEntry(card.number, { photo_url: null });
  };

  const reset = async () => {
    if (!confirm("Clear all checks and photos?")) return;
    await supabase
      .from("collection_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("set_id", setId);
    setEntries({});
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

  const total = cards.length;
  const checkedCount = cards.filter((c) => entries[c.number]?.checked).length;
  const remaining = total - checkedCount;
  const totalValue = cards.reduce((s, c) => s + valueOf(c.price_usd, currency), 0);
  const ownedValue = cards
    .filter((c) => entries[c.number]?.checked)
    .reduce((s, c) => s + valueOf(c.price_usd, currency), 0);
  const remainingValue = totalValue - ownedValue;

  const themePrimary = setRow.theme_primary || "#b9ff3c";
  const themeSecondary = setRow.theme_secondary || "#c084fc";
  const themeBg = setRow.theme_bg || "#0a0e0a";

  const renderCard = (card) => {
    const entry = entries[card.number] || {};
    const isChecked = !!entry.checked;
    const variant = entry.variant;
    const photo = entry.photo_url;
    const v = valueOf(card.price_usd, currency);
    return (
      <div key={card.id} className="flex flex-col">
        <div
          onClick={() => toggle(card)}
          className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md cursor-pointer select-none active:scale-[0.98] transition-transform"
        >
          {photo ? (
            <img
              src={photo}
              alt={card.name}
              className={`w-full h-full object-cover transition-all duration-300 ${isChecked ? "" : "grayscale opacity-30"}`}
            />
          ) : (
            <CardArt src={card.image_large} name={card.name} isChecked={isChecked} themePrimary={themePrimary} />
          )}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {String(card.number).padStart(3, "0")}
          </div>
          <button
            onClick={(e) => (photo ? removePhoto(card, e) : triggerPhoto(card, e))}
            className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label={photo ? "Remove photo" : "Add photo"}
          >
            {photo ? <Trash2 size={13} /> : <Camera size={13} />}
          </button>
          {variant && (
            <div className="absolute top-1 right-1 bg-amber-300/90 border border-amber-600 text-amber-950 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold shadow">
              {variant === "Reverse Holo" ? "RH" : variant === "Holo" ? "Holo" : "Com"}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggle(card); }}
            className={`absolute ${variant ? "top-1 left-1" : "top-1 right-1"} w-7 h-7 rounded-full flex items-center justify-center transition-all ${isChecked ? "text-black" : "bg-white/10 border-2 border-[var(--po-border)]"}`}
            style={isChecked ? { background: themePrimary, boxShadow: `0 0 8px ${themePrimary}80` } : {}}
            aria-label={isChecked ? "Uncheck" : "Check"}
          >
            {isChecked && <Check size={16} strokeWidth={3} />}
          </button>
        </div>
        <div className={`text-center text-[11px] mt-1 tabular-nums font-semibold ${v >= 50 ? "text-amber-400" : v >= 5 ? "text-[var(--po-text)]" : "text-[var(--po-text-dim)]"}`}>
          {fmtMoney(v, currency)}
        </div>
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
            <button
              onClick={() => switchCurrency(currency === "AUD" ? "CAD" : "AUD")}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] hover:text-[var(--po-green)] px-2 py-1 border border-[var(--po-border)] rounded"
            >
              {currency}
            </button>
            <button
              onClick={reset}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <div className="text-3xl font-black tabular-nums leading-none">
              {checkedCount}<span className="text-[var(--po-text-dim)] text-xl">/{total}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              {remaining} cards to go
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums leading-none" style={{ color: themePrimary }}>
              {fmtMoney(ownedValue, currency)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              owned · {fmtMoney(remainingValue, currency)} to go
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 w-full bg-[var(--po-bg-soft)] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${total > 0 ? (checkedCount / total) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${themePrimary}, ${themeSecondary})`,
              boxShadow: `0 0 12px ${themePrimary}80`,
            }}
          />
        </div>
        <div className="mt-3 flex gap-1 text-[10px] uppercase tracking-widest">
          <button
            onClick={() => masterSet && toggleMasterSet()}
            className={`flex-1 py-1.5 rounded font-bold ${!masterSet ? "text-black" : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"}`}
            style={!masterSet ? { background: themePrimary } : {}}
          >
            Standard
          </button>
          <button
            onClick={() => !masterSet && toggleMasterSet()}
            className={`flex-1 py-1.5 rounded font-bold ${masterSet ? "text-black" : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"}`}
            style={masterSet ? { background: themePrimary } : {}}
          >
            Master Set
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
              const sectionChecked = section.cards.filter((c) => entries[c.number]?.checked).length;
              const sectionValue = section.cards.reduce((s, c) => s + valueOf(c.price_usd, currency), 0);
              const sectionOwned = section.cards
                .filter((c) => entries[c.number]?.checked)
                .reduce((s, c) => s + valueOf(c.price_usd, currency), 0);
              return (
                <div key={section.id} className="border border-[var(--po-border)] rounded-lg overflow-hidden bg-[var(--po-bg-soft)]">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--po-border)]"
                  >
                    <div className="text-left">
                      <div className="font-bold text-sm">{section.label}</div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
                        {sectionChecked}/{section.cards.length} · {fmtMoney(sectionOwned, currency)} of {fmtMoney(sectionValue, currency)}
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

      {picking && (
        <div className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setPicking(null)}>
          <div className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold">
                {picking.name} #{String(picking.number).padStart(3, "0")} — version?
              </h2>
              <button onClick={() => setPicking(null)} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(picking, v)}
                  className="w-full py-3 px-4 bg-[var(--po-bg)] border border-[var(--po-border)] rounded-lg text-left font-semibold text-[var(--po-text)] hover:border-[var(--po-green)] hover:bg-[var(--po-border)]"
                >
                  {v}
                </button>
              ))}
              <button onClick={() => setPicking(null)} className="w-full py-2 text-xs text-[var(--po-text-dim)] mt-1">
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
