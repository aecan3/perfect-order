"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
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

export default function FriendSetPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const { handle, setId } = params;

  const [friend, setFriend] = useState(null);
  const [setRow, setSetRow] = useState(null);
  const [cards, setCards] = useState([]);
  const [entries, setEntries] = useState({});
  const [status, setStatus] = useState("loading");
  const [currency, setCurrency] = useState("AUD");
  const [masterSet, setMasterSet] = useState(false);
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
    const m = localStorage.getItem("po:friendMasterSet");
    if (m !== null) setMasterSet(m === "true");
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();

      if (!friendProfile) { setStatus("not-found"); return; }
      setFriend(friendProfile);

      const { data: friendship } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_a.eq.${user.id},user_b.eq.${friendProfile.id}),and(user_a.eq.${friendProfile.id},user_b.eq.${user.id})`)
        .eq("status", "accepted")
        .maybeSingle();

      if (!friendship) { setStatus("not-friends"); return; }

      const [{ data: setData }, { data: cardData }, { data: entriesData }] = await Promise.all([
        supabase.from("sets").select("*").eq("id", setId).maybeSingle(),
        supabase.from("cards").select("*").eq("set_id", setId).order("number", { ascending: true }),
        supabase
          .from("collection_entries")
          .select("card_number, checked, variant, photo_url")
          .eq("user_id", friendProfile.id)
          .eq("set_id", setId),
      ]);

      setSetRow(setData);
      setCards(cardData || []);
      const map = {};
      (entriesData || []).forEach((e) => { map[e.card_number] = e; });
      setEntries(map);
      setStatus("ok");
    })();
  }, [handle, setId, router, supabase]);

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

  const switchCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("po:currency", c);
  };

  const toggleMasterSet = () => {
    const next = !masterSet;
    setMasterSet(next);
    localStorage.setItem("po:friendMasterSet", String(next));
  };

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">Loading…</div>;
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--po-text)] mb-3">No user with handle @{handle}.</p>
        <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Back to friends</Link>
      </div>
    );
  }

  if (status === "not-friends") {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--po-text)] mb-3">You're not friends with @{handle} yet.</p>
        <Link href="/friends" className="text-[var(--po-green)] underline text-sm">Send them a request</Link>
      </div>
    );
  }

  const themePrimary = setRow?.theme_primary || "#b9ff3c";
  const themeSecondary = setRow?.theme_secondary || "#c084fc";

  const total = cards.length;
  const checkedCount = cards.filter((c) => entries[c.number]?.checked).length;
  const remaining = total - checkedCount;
  const totalValue = cards.reduce((s, c) => s + valueOf(c.price_usd, currency), 0);
  const ownedValue = cards
    .filter((c) => entries[c.number]?.checked)
    .reduce((s, c) => s + valueOf(c.price_usd, currency), 0);
  const remainingValue = totalValue - ownedValue;

  const renderCard = (card) => {
    const entry = entries[card.number] || {};
    const isChecked = !!entry.checked;
    const variant = entry.variant;
    const photo = entry.photo_url;
    const v = valueOf(card.price_usd, currency);
    return (
      <div key={card.id} className="flex flex-col">
        <div className="relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md">
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
          {variant && (
            <div className="absolute top-1 right-1 bg-amber-300/90 border border-amber-600 text-amber-950 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold shadow">
              {variant === "Reverse Holo" ? "RH" : variant === "Holo" ? "Holo" : "Com"}
            </div>
          )}
          {isChecked && (
            <div
              className="absolute top-1 left-1 text-black text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold shadow"
              style={{ background: themePrimary }}
            >
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
      <header
        className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b px-4 py-3"
        style={{ borderBottomColor: `${themePrimary}40` }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Link href={`/friend/${handle}`} className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-none" style={{ color: themePrimary }}>
              {setRow?.name}
            </h1>
            <p className="text-[10px] text-[var(--po-text-dim)]">@{friend?.handle}</p>
          </div>
          <button
            onClick={() => switchCurrency(currency === "AUD" ? "CAD" : "AUD")}
            className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] hover:text-[var(--po-green)] px-2 py-1 border border-[var(--po-border)] rounded"
          >
            {currency}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-black tabular-nums leading-none">
              {checkedCount}<span className="text-[var(--po-text-dim)] text-lg">/{total}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5">
              {remaining} cards to go
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black tabular-nums leading-none" style={{ color: themePrimary }}>
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
    </div>
  );
}
