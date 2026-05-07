"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  TOTAL,
  SET_CODE,
  NAMES,
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

function CardArt({ n, isChecked, name, tier }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center px-2 text-center transition-all duration-300 ${TIER_STYLES[tier]} ${isChecked ? "" : "grayscale opacity-30"}`}
      >
        <div className="text-2xl font-black tabular-nums leading-none">
          {String(n).padStart(3, "0")}
        </div>
        <div className="mt-1.5 text-[11px] font-bold leading-tight line-clamp-2">
          {name || "—"}
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-widest opacity-70">
          {TIER_LABELS[tier]}
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

export default function FriendCollectionPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const handle = params.handle;

  const [me, setMe] = useState(null);
  const [friend, setFriend] = useState(null);
  const [entries, setEntries] = useState({});
  const [status, setStatus] = useState("loading");
  const [currency, setCurrency] = useState("AUD");
  const [masterSet, setMasterSet] = useState(false);
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem("po:currency");
    if (saved && RATES[saved]) setCurrency(saved);
  }, []);

  useEffect(() => {
    const m = localStorage.getItem("po:friendMasterSet");
    if (m !== null) setMasterSet(m === "true");
  }, []);

  const switchCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("po:currency", c);
  };

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMasterSet = () => {
    const next = !masterSet;
    setMasterSet(next);
    localStorage.setItem("po:friendMasterSet", String(next));
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setMe(user);

      // Find friend by handle
      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!friendProfile) {
        setStatus("not-found");
        return;
      }
      setFriend(friendProfile);

      // Confirm friendship is accepted
      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(user_a.eq.${user.id},user_b.eq.${friendProfile.id}),and(user_a.eq.${friendProfile.id},user_b.eq.${user.id})`
        )
        .eq("status", "accepted")
        .maybeSingle();

      if (!friendship) {
        setStatus("not-friends");
        return;
      }

      // Load their collection (RLS allows it because we're accepted friends)
      const { data: entriesData } = await supabase
        .from("collection_entries")
        .select("card_number, checked, variant, photo_url")
        .eq("user_id", friendProfile.id)
        .eq("set_id", "me3");

      const map = {};
      (entriesData || []).forEach((e) => {
        map[e.card_number] = e;
      });
      setEntries(map);
      setStatus("ok");
    })();
  }, [handle, router, supabase]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4">
        <p className="text-[var(--po-text)] mb-3">No user with handle @{handle}.</p>
        <Link href="/friends" className="text-[var(--po-green)] underline text-sm">
          Back to friends
        </Link>
      </div>
    );
  }

  if (status === "not-friends") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--po-text)] mb-3">
          You're not friends with @{handle} yet.
        </p>
        <Link href="/friends" className="text-[var(--po-green)] underline text-sm">
          Send them a request
        </Link>
      </div>
    );
  }

  const allNumbers = SECTIONS.flatMap((s) => s.numbers);
  const visibleTotal = allNumbers.length;
  const checkedCount = allNumbers.filter((n) => entries[n]?.checked).length;
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
        <div className={`relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md ${photo ? "" : TIER_STYLES[tier]}`}>
          {photo ? (
            <img
              src={photo}
              alt={NAMES[n]}
              className={`w-full h-full object-cover ${isChecked ? "" : "grayscale opacity-30"}`}
            />
          ) : (
            <CardArt n={n} isChecked={isChecked} name={NAMES[n]} tier={tier} />
          )}
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {String(n).padStart(3, "0")}
          </div>
          {variant && (
            <div className="absolute top-1 right-1 bg-amber-300/90 border border-amber-600 text-amber-950 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold shadow">
              {variant === "Reverse Holo" ? "RH" : variant === "Holo" ? "Holo" : "Com"}
            </div>
          )}
          {isChecked && (
            <div className="absolute top-1 left-1 bg-[var(--po-green)] text-black text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold shadow">
              Owned
            </div>
          )}
        </div>
        <div className={`text-center text-[11px] mt-1 tabular-nums font-semibold ${v >= 50 ? "text-amber-400" : v >= 5 ? "text-[var(--po-text)]" : "text-[var(--po-text-dim)]"}`}>
          {fmtMoney(v, currency)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/friends" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-none text-[var(--po-text)]">
              {friend.display_name || friend.handle}
            </h1>
            <p className="text-[10px] text-[var(--po-text-dim)]">@{friend.handle}</p>
          </div>
          <button
            onClick={() => switchCurrency(currency === "AUD" ? "CAD" : "AUD")}
            className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] hover:text-[var(--po-green)] px-2 py-1 border border-[var(--po-border)] rounded"
            aria-label="Switch currency"
          >
            {currency}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-black tabular-nums leading-none">
              {checkedCount}<span className="text-[var(--po-text-dim)] text-lg">/{visibleTotal}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              {visibleTotal - checkedCount} cards to go
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black tabular-nums text-[var(--po-green)] leading-none">
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
    </div>
  );
}
