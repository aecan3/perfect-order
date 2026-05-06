"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  TOTAL,
  SET_CODE,
  NAMES,
  PRICES_USD,
  RATES,
  valueOf,
  fmtMoney,
  tierFor,
  TIER_STYLES,
  TIER_LABELS,
} from "@/lib/cards";

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
  const [status, setStatus] = useState("loading"); // loading | ok | not-friends | not-found
  const [currency, setCurrency] = useState("AUD");

  useEffect(() => {
    const saved = localStorage.getItem("po:currency");
    if (saved && RATES[saved]) setCurrency(saved);
  }, []);

  const switchCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("po:currency", c);
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
        .eq("set_code", SET_CODE);

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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500">
        Loading…
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
        <p className="text-stone-700 mb-3">No user with handle @{handle}.</p>
        <Link href="/friends" className="text-stone-900 underline text-sm">
          Back to friends
        </Link>
      </div>
    );
  }

  if (status === "not-friends") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-stone-700 mb-3">
          You're not friends with @{handle} yet.
        </p>
        <Link href="/friends" className="text-stone-900 underline text-sm">
          Send them a request
        </Link>
      </div>
    );
  }

  const checkedCount = Object.values(entries).filter((e) => e.checked).length;
  const ownedValue = Array.from({ length: TOTAL }, (_, i) => i + 1)
    .filter((n) => entries[n]?.checked)
    .reduce((s, n) => s + valueOf(n, currency), 0);
  const totalValue = Object.keys(PRICES_USD).reduce(
    (s, n) => s + valueOf(Number(n), currency),
    0
  );
  const remainingValue = totalValue - ownedValue;
  const cards = Array.from({ length: TOTAL }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
      <header className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur border-b border-stone-300 px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/friends" className="text-stone-700 hover:text-stone-900">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-none">
              {friend.display_name || friend.handle}
            </h1>
            <p className="text-[10px] text-stone-500">@{friend.handle}</p>
          </div>
          <button
            onClick={() => switchCurrency(currency === "AUD" ? "CAD" : "AUD")}
            className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-stone-900 px-2 py-1 border border-stone-300 rounded"
            aria-label="Switch currency"
          >
            {currency}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-black tabular-nums leading-none">
              {checkedCount}/{TOTAL}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-0.5">
              cards collected
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black tabular-nums text-emerald-700 leading-none">
              {fmtMoney(ownedValue, currency)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-0.5">
              owned · {fmtMoney(remainingValue, currency)} to go
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 w-full bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${(checkedCount / TOTAL) * 100}%` }}
          />
        </div>
      </header>

      <main className="px-3 py-4 grid grid-cols-2 gap-3">
        {cards.map((n) => {
          const entry = entries[n] || {};
          const isChecked = !!entry.checked;
          const variant = entry.variant;
          const photo = entry.photo_url;
          const tier = tierFor(n);
          const aud = valueOf(n, currency);
          return (
            <div key={n} className="flex flex-col">
              <div
                className={`relative aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-md ${photo ? "" : TIER_STYLES[tier]}`}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt={NAMES[n]}
                    className={`w-full h-full object-cover ${isChecked ? "" : "grayscale opacity-30"}`}
                  />
                ) : (
                  <CardArt
                    n={n}
                    isChecked={isChecked}
                    name={NAMES[n]}
                    tier={tier}
                  />
                )}

                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {String(n).padStart(3, "0")}
                </div>

                {variant && (
                  <div className="absolute top-1 right-1 bg-amber-100 border border-amber-700 text-amber-900 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold shadow">
                    {variant === "Reverse Holo" ? "RH" : variant === "Holo" ? "Holo" : "Com"}
                  </div>
                )}

                {isChecked && (
                  <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold shadow">
                    Owned
                  </div>
                )}
              </div>
              <div className={`text-center text-[11px] mt-1 tabular-nums font-semibold ${
                aud >= 50 ? "text-amber-700" : aud >= 5 ? "text-stone-700" : "text-stone-500"
              }`}>
                {fmtMoney(aud, currency)}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
