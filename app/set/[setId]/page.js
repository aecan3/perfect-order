"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Camera, Trash2, Users, LogOut, ChevronDown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  TOTAL,
  PRINTED_TOTAL,
  SET_CODE,
  NAMES,
  PRICES_USD,
  VARIANTS,
  isVariantEligible,
  RATES,
  valueOf,
  fmtMoney,
  tierFor,
  TIER_STYLES,
  TIER_LABELS,
} from "@/lib/cards";

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
function rangeExcept(a, b, exclude) {
  const ex = new Set(exclude);
  return range(a, b).filter((n) => !ex.has(n));
}

const SECTIONS = [
  { id: "base", label: "Base Pokémon", numbers: rangeExcept(1, 74, [12, 16, 21, 22, 31, 47, 53, 55, 62]), masterOnly: false },
  { id: "ex", label: "ex / Mega ex", numbers: [12, 16, 21, 22, 31, 47, 53, 55, 62], masterOnly: false },
  { id: "trainers", label: "Trainers", numbers: range(75, 85), masterOnly: false },
  { id: "energies", label: "Energies", numbers: range(86, 88), masterOnly: false },
  { id: "ir", label: "Illustration Rares", numbers: range(89, 99), masterOnly: true },
  { id: "sir", label: "Special Illustration / Ultra Rares", numbers: range(100, 117), masterOnly: true },
  { id: "hyper", label: "Hyper Rares", numbers: range(118, 124), masterOnly: true },
];

const officialImg = (n) =>
  `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/POR/POR_${String(n).padStart(3, "0")}_R_EN_LG.png`;

function CardArt({ n, isChecked, name, tier, tierStyles, tierLabels }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 text-center transition-all duration-300 ${tierStyles[tier]} ${isChecked ? "" : "grayscale opacity-30"}`}
      >
        <div className="text-2xl font-black tabular-nums leading-none">
          {String(n).padStart(3, "0")}
        </div>
        <div className="mt-1.5 text-[11px] font-bold leading-tight line-clamp-2">
          {name || "—"}
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-widest opacity-70">
          {tierLabels[tier]}
        </div>
      </div>
    );
  }
  return (
    <img
      src={officialImg(n)}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover transition-all duration-300 ${isChecked ? "" : "grayscale opacity-30"}`}
    />
  );
}

export default function SetTrackerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState({});
  const [picking, setPicking] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currency, setCurrency] = useState("AUD");
  const [masterSet, setMasterSet] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const [lastUsedSection, setLastUsedSection] = useState(null);
  const fileInputRef = useRef(null);
  const photoTargetRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("po:currency");
    if (saved && RATES[saved]) setCurrency(saved);
  }, []);

  useEffect(() => {
    const m = localStorage.getItem("po:masterSet");
    if (m !== null) setMasterSet(m === "true");
    const last = localStorage.getItem("po:lastSection");
    if (last) {
      setLastUsedSection(last);
      setOpenSections({ [last]: true });
    }
  }, []);

  const switchCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("po:currency", c);
  };

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!openSections[id]) {
      setLastUsedSection(id);
      localStorage.setItem("po:lastSection", id);
    }
  };

  const toggleMasterSet = () => {
    const next = !masterSet;
    setMasterSet(next);
    localStorage.setItem("po:masterSet", String(next));
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(profileData);

      const { data: entriesData } = await supabase
        .from("collection_entries")
        .select("card_number, checked, variant, photo_url")
        .eq("user_id", user.id)
        .eq("set_code", SET_CODE);

      const map = {};
      (entriesData || []).forEach((e) => {
        map[e.card_number] = {
          checked: e.checked,
          variant: e.variant,
          photo_url: e.photo_url,
        };
      });
      setEntries(map);
      setAuthChecked(true);
    })();
  }, [router, supabase]);

  const upsertEntry = useCallback(
    async (cardNumber, patch) => {
      if (!user) return;
      const current = entries[cardNumber] || {};
      const next = { ...current, ...patch };
      setEntries((prev) => ({ ...prev, [cardNumber]: next }));
      await supabase.from("collection_entries").upsert(
        {
          user_id: user.id,
          set_code: SET_CODE,
          card_number: cardNumber,
          checked: !!next.checked,
          variant: next.variant ?? null,
          photo_url: next.photo_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,set_code,card_number" }
      );
    },
    [user, entries, supabase]
  );

  const toggle = (n) => {
    const cur = entries[n] || {};
    const willCheck = !cur.checked;
    if (willCheck) {
      upsertEntry(n, { checked: true });
      if (isVariantEligible(n) && !cur.variant) setPicking(n);
    } else {
      upsertEntry(n, { checked: false, variant: null });
    }
  };

  const setVariant = (n, v) => {
    upsertEntry(n, { variant: v });
    setPicking(null);
  };

  const triggerPhoto = (n, e) => {
    e.stopPropagation();
    photoTargetRef.current = n;
    fileInputRef.current?.click();
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    const n = photoTargetRef.current;
    if (!file || n === null || !user) return;
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
            const path = `${user.id}/${SET_CODE}-${n}-${Date.now()}.jpg`;
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
            upsertEntry(n, { photo_url: publicUrl });
          },
          "image/jpeg",
          0.7
        );
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (n, e) => {
    e.stopPropagation();
    upsertEntry(n, { photo_url: null });
  };

  const reset = async () => {
    if (!confirm("Clear all checks and photos?")) return;
    await supabase
      .from("collection_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("set_code", SET_CODE);
    setEntries({});
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  const allNumbers = SECTIONS.flatMap((s) => s.numbers);
  const visibleTotal = allNumbers.length;
  const checkedCount = allNumbers.filter((n) => entries[n]?.checked).length;
  const remaining = visibleTotal - checkedCount;
  const totalValue = allNumbers.reduce((s, n) => s + valueOf(n, currency), 0);
  const ownedValue = allNumbers
    .filter((n) => entries[n]?.checked)
    .reduce((s, n) => s + valueOf(n, currency), 0);
  const remainingValue = totalValue - ownedValue;

  const renderCard = (n) => {
    const entry = entries[n] || {};
    const isChecked = !!entry.checked;
    const variant = entry.variant;
    const photo = entry.photo_url;
    const tier = tierFor(n);
    const v = valueOf(n, currency);
    return (
      <div key={n} className="flex flex-col">
        <div
          onClick={() => toggle(n)}
          className={`relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md cursor-pointer select-none active:scale-[0.98] transition-transform ${photo ? "" : TIER_STYLES[tier]}`}
        >
          {photo ? (
            <img
              src={photo}
              alt={NAMES[n] || `Card ${n}`}
              className={`w-full h-full object-cover transition-all duration-300 ${isChecked ? "" : "grayscale opacity-30"}`}
            />
          ) : (
            <CardArt n={n} isChecked={isChecked} name={NAMES[n]} tier={tier} tierStyles={TIER_STYLES} tierLabels={TIER_LABELS} />
          )}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {String(n).padStart(3, "0")}
          </div>
          <button
            onClick={(e) => (photo ? removePhoto(n, e) : triggerPhoto(n, e))}
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
            onClick={(e) => {
              e.stopPropagation();
              toggle(n);
            }}
            className={`absolute ${variant ? "top-1 left-1" : "top-1 right-1"} w-7 h-7 rounded-full flex items-center justify-center transition-all ${isChecked ? "bg-[var(--po-green)] text-black po-glow-green" : "bg-white/10 border-2 border-[var(--po-border)]"}`}
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
      <header className="sticky top-0 z-20 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]" aria-label="Back">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="po-wordmark text-xl">Perfect Order</h1>
              <p className="text-[10px] text-[var(--po-text-dim)]">
                @{profile?.handle || "you"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/friends"
              className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
              aria-label="Friends"
            >
              <Users size={18} />
            </Link>
            <button
              onClick={signOut}
              className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={() => switchCurrency(currency === "AUD" ? "CAD" : "AUD")}
              className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] hover:text-[var(--po-green)] px-2 py-1 border border-[var(--po-border)] rounded"
              aria-label="Switch currency"
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
        <div className="mt-1 grid grid-cols-2 gap-3">
          <div>
            <div className="text-3xl font-black tabular-nums leading-none">
              {remaining}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              cards to go · {checkedCount}/{visibleTotal}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums text-[var(--po-green)] leading-none">
              {fmtMoney(ownedValue, currency)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              owned · {fmtMoney(remainingValue, currency)} to go
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 w-full bg-[var(--po-bg-soft)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--po-green)] po-glow-green transition-all duration-300"
            style={{ width: `${(checkedCount / visibleTotal) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex gap-1 text-[10px] uppercase tracking-widest">
          <button
            onClick={() => masterSet && toggleMasterSet()}
            className={`flex-1 py-1.5 rounded ${!masterSet ? "bg-[var(--po-green)] text-black font-bold" : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"}`}
          >
            Standard
          </button>
          <button
            onClick={() => !masterSet && toggleMasterSet()}
            className={`flex-1 py-1.5 rounded ${masterSet ? "bg-[var(--po-green)] text-black font-bold" : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"}`}
          >
            Master Set
          </button>
        </div>
      </header>

      <main className="px-3 py-4">
        {masterSet ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: TOTAL }, (_, i) => i + 1).map(renderCard)}
          </div>
        ) : (
          <div className="space-y-3">
            {SECTIONS.map((section) => {
              const isOpen = !!openSections[section.id];
              const sectionChecked = section.numbers.filter((n) => entries[n]?.checked).length;
              const sectionValue = section.numbers.reduce((s, n) => s + valueOf(n, currency), 0);
              const sectionOwned = section.numbers
                .filter((n) => entries[n]?.checked)
                .reduce((s, n) => s + valueOf(n, currency), 0);
              return (
                <div key={section.id} className="border border-[var(--po-border)] rounded-lg overflow-hidden bg-[var(--po-bg-soft)]">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--po-border)]"
                  >
                    <div className="text-left">
                      <div className="font-bold text-sm text-[var(--po-text)]">{section.label}</div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
                        {sectionChecked}/{section.numbers.length} · {fmtMoney(sectionOwned, currency)} of {fmtMoney(sectionValue, currency)}
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-[var(--po-text-dim)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3 border-t border-[var(--po-border)]">
                      {section.numbers.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhoto}
        className="hidden"
      />

      {picking !== null && (
        <div
          className="fixed inset-0 z-30 bg-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setPicking(null)}
        >
          <div
            className="bg-[var(--po-bg-soft)] rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-[var(--po-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-[var(--po-text)]">
                Card #{String(picking).padStart(3, "0")} — which version?
              </h2>
              <button
                onClick={() => setPicking(null)}
                className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(picking, v)}
                  className="w-full py-3 px-4 bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg text-left font-semibold hover:bg-[var(--po-border)] hover:border-[var(--po-green)] transition"
                >
                  {v}
                </button>
              ))}
              <button
                onClick={() => setPicking(null)}
                className="w-full py-2 text-xs text-[var(--po-text-dim)] mt-1"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
