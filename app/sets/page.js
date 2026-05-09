"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Check, Plus, X, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "£"  },
};
const fmtMoney = (v, currency) => {
  const sym = RATES[currency]?.symbol || "$";
  if (v >= 100) return `${sym}${v.toFixed(0)}`;
  if (v >= 10)  return `${sym}${v.toFixed(1)}`;
  return `${sym}${v.toFixed(2)}`;
};

function rarityBucket(rarity, subtypes, cardNumber, setPrintedTotal) {
  const r = (rarity || "").toLowerCase().trim();
  const subs = (subtypes || []).map((s) => s.toLowerCase());
  const num = cardNumber || 0;
  const prt = setPrintedTotal || 0;

  if (!rarity) return "unknown";

  if (r === "common")    return "common";
  if (r === "uncommon")  return "uncommon";
  if (r === "rare")      return "rare";
  if (r === "rare holo") return "rare_holo";
  if (r === "promo")     return "promo";

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

  if (r === "rare holo gx")    return "gx";
  if (r === "rare prism star") return "prism_star";
  if (r === "rare shining")    return "shining";

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
  double_rare: "Double Rare", ex: "ex", tera_ex: "Tera ex", mega_ex: "Mega ex",
  illustration_rare: "Illustration Rare", ultra_rare: "Full Art",
  ace_spec: "ACE SPEC", mega_attack_rare: "Mega Attack Rare",
  sir: "Special Illustration Rare", hyper_rare: "Hyper Rare",
  mega_hyper_rare: "Mega Hyper Rare", shiny_rare: "Shiny Rare",
  shiny_ultra_rare: "Shiny Ultra Rare", promo: "Promo",
};
const RARITY_COLOR = {
  gx: "#3b82f6", v: "#3b82f6", double_rare: "#3b82f6", ex: "#3b82f6",
  tera_ex: "#14b8a6", mega_ex: "#8b5cf6",
  vmax: "#8b5cf6", vstar: "#8b5cf6",
  illustration_rare: "#22c55e", full_art: "#22c55e", v_full_art: "#22c55e",
  ultra_rare: "#f97316", alt_art: "#f97316", trainer_gallery: "#f97316",
  rainbow_rare: "#f43f5e", sir: "#f43f5e", mega_attack_rare: "#f43f5e",
  hyper_rare: "#eab308", mega_hyper_rare: "#eab308", gold_rare: "#eab308",
  shiny_rare: "#14b8a6", shiny_ultra_rare: "#14b8a6", shiny: "#14b8a6",
  ace_spec: "#ef4444", prism_star: "#6366f1",
  common: "#6b7280", uncommon: "#6b7280", rare: "#a3a3a3", rare_holo: "#b9ff3c",
  promo: "#6b7280",
};

export default function SetBrowserPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [allSets, setAllSets] = useState([]);
  const [activeSetIds, setActiveSetIds] = useState(new Set());
  const [query, setQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("AUD");

  // Wizard state
  const [wizardSet, setWizardSet] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardMode, setWizardMode] = useState(null);
  const [wizardPrintings, setWizardPrintings] = useState([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [selectedBuckets, setSelectedBuckets] = useState(new Set());
  const [wizardResult, setWizardResult] = useState(null);

  // Scroll lock while wizard is open
  useEffect(() => {
    if (wizardSet) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [wizardSet]);

  useEffect(() => {
    const c = localStorage.getItem("po:currency");
    if (c && RATES[c]) setCurrency(c);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const [{ data: sets }, { data: userSets }] = await Promise.all([
        supabase
          .from("sets")
          .select("id, code, name, series, total, total_with_secrets, release_date, logo_url, theme_primary, theme_secondary, theme_bg, printings!printings_set_id_fkey(count)")
          .order("release_date", { ascending: false }),
        supabase.from("user_sets").select("set_id").eq("user_id", user.id),
      ]);

      setAllSets(sets || []);
      setActiveSetIds(new Set((userSets || []).map((r) => r.set_id)));
      setLoading(false);
    })();
  }, [router, supabase]);

  // ── Wizard derived values ─────────────────────────────────────────────────

  const wizardBuckets = useMemo(() => {
    if (!wizardPrintings.length) return [];
    const bucketMap = new Map();
    for (const p of wizardPrintings) {
      const bucket = rarityBucket(p._rarity, p._subtypes, p.card_number, wizardSet?.total);
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, { count: 0, totalValue: 0 });
      const entry = bucketMap.get(bucket);
      entry.count += 1;
      entry.totalValue += p.price_usd || 0;
    }
    return BUCKET_ORDER
      .filter((b) => bucketMap.has(b))
      .map((b) => ({ id: b, ...bucketMap.get(b) }));
  }, [wizardPrintings, wizardSet]);

  const wizardTotalValue = useMemo(
    () => wizardPrintings.reduce((s, p) => s + (p.price_usd || 0), 0),
    [wizardPrintings],
  );

  const selectedCount = useMemo(() => {
    if (!selectedBuckets.size) return 0;
    return wizardPrintings.filter((p) => {
      const bucket = rarityBucket(p._rarity, p._subtypes, p.card_number, wizardSet?.total);
      return selectedBuckets.has(bucket);
    }).length;
  }, [wizardPrintings, selectedBuckets, wizardSet]);

  // ── Browser derived values ────────────────────────────────────────────────

  const seriesList = useMemo(() => {
    const s = new Set(allSets.map((x) => x.series).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [allSets]);

  const filteredSets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSets.filter((s) => {
      if (seriesFilter !== "all" && s.series !== seriesFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.series || "").toLowerCase().includes(q)
      );
    });
  }, [allSets, query, seriesFilter]);

  // ── Wizard actions ────────────────────────────────────────────────────────

  const openWizard = async (set) => {
    setWizardSet(set);
    setWizardStep(1);
    setWizardMode(null);
    setWizardPrintings([]);
    setWizardLoading(true);
    setSelectedBuckets(new Set());
    setWizardResult(null);
    setWizardBusy(false);

    const [{ data: printingData }, { data: cardData }] = await Promise.all([
      supabase
        .from("printings")
        .select("id, card_number, printing_type, price_usd")
        .eq("set_id", set.id),
      supabase
        .from("cards")
        .select("number, rarity, subtypes")
        .eq("set_id", set.id),
    ]);

    // Merge rarity/subtypes onto each printing for easy bucket lookups
    const cardByNumber = {};
    for (const c of cardData || []) {
      cardByNumber[c.number] = c;
    }
    const merged = (printingData || []).map((p) => ({
      ...p,
      _rarity: cardByNumber[p.card_number]?.rarity || null,
      _subtypes: cardByNumber[p.card_number]?.subtypes || [],
    }));

    setWizardPrintings(merged);
    setWizardLoading(false);
  };

  const closeWizard = () => setWizardSet(null);

  const ensureUserSet = async (setId) => {
    if (activeSetIds.has(setId)) return;
    await supabase.from("user_sets").insert({ user_id: user.id, set_id: setId });
    setActiveSetIds((prev) => new Set([...prev, setId]));
  };

  const bulkInsertEntries = async (printings) => {
    const rows = printings.map((p) => ({
      user_id: user.id,
      set_id: wizardSet.id,
      card_number: p.card_number,
      printing_id: p.id,
      checked: true,
      updated_at: new Date().toISOString(),
    }));
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from("collection_entries")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "user_id,set_id,card_number,printing_id" });
      if (error) throw new Error(error.message);
    }
    return rows.length;
  };

  const selectMode = async (mode) => {
    setWizardMode(mode);
    if (mode === "fresh") {
      setWizardBusy(true);
      await ensureUserSet(wizardSet.id);
      router.push(`/set/${wizardSet.id}`);
      return;
    }
    setWizardStep(2);
  };

  const confirmFull = async () => {
    setWizardBusy(true);
    try {
      await ensureUserSet(wizardSet.id);
      const count = await bulkInsertEntries(wizardPrintings);
      setWizardResult({ count });
      setWizardStep(3);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setWizardBusy(false);
  };

  const confirmPartial = async () => {
    if (!selectedBuckets.size) return;
    setWizardBusy(true);
    try {
      const toInsert = wizardPrintings.filter((p) => {
        const bucket = rarityBucket(p._rarity, p._subtypes, p.card_number, wizardSet?.total);
        return selectedBuckets.has(bucket);
      });
      await ensureUserSet(wizardSet.id);
      const count = await bulkInsertEntries(toInsert);
      setWizardResult({ count });
      setWizardStep(3);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setWizardBusy(false);
  };

  const skipPartial = async () => {
    setWizardBusy(true);
    await ensureUserSet(wizardSet.id);
    router.push(`/set/${wizardSet.id}`);
  };

  const toggleBucket = (bucketId) => {
    setSelectedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucketId)) next.delete(bucketId);
      else next.add(bucketId);
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading…
      </div>
    );
  }

  const wPrimary = wizardSet?.theme_primary || "#b9ff3c";
  const wBg = wizardSet?.theme_bg || "#0a0e0a";

  const wizardSubtitle =
    wizardStep === 1 ? "How are you adding this set?" :
    wizardStep === 2 && wizardMode === "full" ? "Confirm full collection" :
    wizardStep === 2 && wizardMode === "partial" ? "Select rarities you already have" :
    "Done!";

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="po-wordmark text-xl">Add a Set</h1>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--po-text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg text-[var(--po-text)] placeholder-[var(--po-text-dim)] focus:outline-none focus:border-[var(--po-green)]"
          />
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {seriesList.map((s) => (
            <button
              key={s}
              onClick={() => setSeriesFilter(s)}
              className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                seriesFilter === s
                  ? "bg-[var(--po-green)] text-black font-bold"
                  : "bg-[var(--po-bg-soft)] text-[var(--po-text-dim)] border border-[var(--po-border)]"
              }`}
            >
              {s === "all" ? "All series" : s}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-4 space-y-2 max-w-md mx-auto">
        {filteredSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            No sets match.
          </div>
        ) : (
          filteredSets.map((set) => {
            const total = set.printings?.[0]?.count || 0;
            const isActive = activeSetIds.has(set.id);
            const primary = set.theme_primary || "#b9ff3c";
            const bg = set.theme_bg || "#0a0e0a";
            return (
              <div
                key={set.id}
                className="rounded-xl border border-[var(--po-border)] overflow-hidden flex items-center gap-3 p-3"
                style={{
                  background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)`,
                }}
              >
                {set.logo_url ? (
                  <img
                    src={set.logo_url}
                    alt={set.name}
                    className="w-14 h-14 object-contain flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={{ background: primary, color: bg }}
                  >
                    {set.code}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold text-sm leading-tight truncate"
                    style={{ color: primary }}
                  >
                    {set.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5 truncate">
                    {set.series || "—"} · {total} cards
                  </div>
                </div>
                {isActive ? (
                  <Link
                    href={`/set/${set.id}`}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold flex items-center gap-1"
                    style={{ background: primary, color: bg }}
                  >
                    <Check size={12} />
                    Open
                  </Link>
                ) : (
                  <button
                    onClick={() => openWizard(set)}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] hover:border-[var(--po-green)] hover:text-[var(--po-green)] flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* ── Setup wizard bottom sheet ───────────────────────────────────────── */}
      {wizardSet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={closeWizard} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[var(--po-bg-soft)] rounded-t-2xl border-t border-[var(--po-border)] max-h-[90vh] flex flex-col">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--po-border)]" />
            </div>

            {/* Progress bar */}
            <div className="mx-4 h-0.5 rounded-full bg-[var(--po-border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(wizardStep / 3) * 100}%`, background: wPrimary }}
              />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              {wizardStep > 1 && (
                <button
                  onClick={() => setWizardStep((s) => s - 1)}
                  className="text-[var(--po-text-dim)] hover:text-[var(--po-text)] flex-shrink-0"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: wPrimary }}>
                  {wizardSet.name}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">
                  {wizardSubtitle}
                </div>
              </div>
              <button
                onClick={closeWizard}
                className="text-[var(--po-text-dim)] hover:text-[var(--po-text)] flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {wizardLoading ? (
                <div className="flex items-center justify-center py-12 text-[var(--po-text-dim)] text-sm">
                  Loading set data…
                </div>
              ) : wizardStep === 1 ? (
                <div className="space-y-3 pt-2">
                  {[
                    {
                      id: "fresh",
                      title: "Starting fresh",
                      desc: "Just track what you collect from here",
                    },
                    {
                      id: "full",
                      title: "I have the full set",
                      desc: `Mark all ${wizardPrintings.length} printings as collected`,
                    },
                    {
                      id: "partial",
                      title: "Partially collected",
                      desc: "Pick which rarities you already have",
                    },
                  ].map(({ id, title, desc }) => (
                    <button
                      key={id}
                      onClick={() => selectMode(id)}
                      disabled={wizardBusy}
                      className="w-full text-left p-4 rounded-xl border border-[var(--po-border)] bg-[var(--po-bg)] hover:border-[var(--po-green)] transition-colors disabled:opacity-50"
                    >
                      <div className="font-bold text-sm text-[var(--po-text)]">{title}</div>
                      <div className="text-[11px] text-[var(--po-text-dim)] mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              ) : wizardStep === 2 && wizardMode === "full" ? (
                <div className="pt-2 space-y-4">
                  <div className="rounded-xl border border-[var(--po-border)] bg-[var(--po-bg)] p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--po-text-dim)]">Printings</span>
                      <span className="font-bold">{wizardPrintings.length}</span>
                    </div>
                    {wizardTotalValue > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--po-text-dim)]">Est. value</span>
                        <span className="font-bold" style={{ color: wPrimary }}>
                          {fmtMoney(wizardTotalValue * (RATES[currency]?.rate || 1), currency)}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={confirmFull}
                    disabled={wizardBusy}
                    className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: wPrimary, color: wBg }}
                  >
                    {wizardBusy ? "Adding…" : `Mark all ${wizardPrintings.length} as collected`}
                  </button>
                </div>
              ) : wizardStep === 2 && wizardMode === "partial" ? (
                <div className="pt-2">
                  <div className="space-y-2 mb-4">
                    {wizardBuckets.map((b) => {
                      const color = RARITY_COLOR[b.id] || "#6b7280";
                      const sel = selectedBuckets.has(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => toggleBucket(b.id)}
                          disabled={wizardBusy}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors disabled:opacity-50 ${
                            sel
                              ? "border-[var(--po-green)] bg-[var(--po-bg)]"
                              : "border-[var(--po-border)] bg-[var(--po-bg)]"
                          }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: color }}
                          />
                          <span className="flex-1 text-left text-sm font-medium text-[var(--po-text)]">
                            {BUCKET_LABELS[b.id] || b.id}
                          </span>
                          <span className="text-[11px] text-[var(--po-text-dim)]">
                            {b.count}
                          </span>
                          {b.totalValue > 0 && (
                            <span className="text-[11px]" style={{ color: wPrimary }}>
                              {fmtMoney(b.totalValue * (RATES[currency]?.rate || 1), currency)}
                            </span>
                          )}
                          {sel && (
                            <Check size={14} className="text-[var(--po-green)] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={skipPartial}
                      disabled={wizardBusy}
                      className="flex-1 py-3 rounded-xl font-bold text-sm border border-[var(--po-border)] text-[var(--po-text-dim)] hover:border-[var(--po-green)] disabled:opacity-50"
                    >
                      Skip
                    </button>
                    <button
                      onClick={confirmPartial}
                      disabled={wizardBusy || !selectedBuckets.size}
                      className="flex-[2] py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40 disabled:bg-[var(--po-bg-soft)] disabled:text-[var(--po-text-dim)]"
                      style={
                        selectedBuckets.size
                          ? { background: wPrimary, color: wBg }
                          : undefined
                      }
                    >
                      {wizardBusy
                        ? "Adding…"
                        : selectedBuckets.size
                        ? `Apply (${selectedCount} cards)`
                        : "Select rarities"}
                    </button>
                  </div>
                </div>
              ) : wizardStep === 3 ? (
                <div className="pt-6 pb-4 flex flex-col items-center gap-4 text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: `${wPrimary}22` }}
                  >
                    <Check size={32} style={{ color: wPrimary }} />
                  </div>
                  <div>
                    <div className="font-bold text-lg" style={{ color: wPrimary }}>
                      {wizardSet.name}
                    </div>
                    <div className="text-sm text-[var(--po-text-dim)] mt-1">
                      {wizardResult?.count
                        ? `${wizardResult.count} card${wizardResult.count === 1 ? "" : "s"} marked as collected`
                        : "Set added to your collection"}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/set/${wizardSet.id}`)}
                    className="w-full py-3 rounded-xl font-bold text-sm"
                    style={{ background: wPrimary, color: wBg }}
                  >
                    Open set tracker
                  </button>
                </div>
              ) : null}
            </div>

            {/* Working overlay (busy but not yet on success screen) */}
            {wizardBusy && wizardStep < 3 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-t-2xl bg-[var(--po-bg-soft)]/80 z-10">
                <span className="text-sm text-[var(--po-text-dim)]">Working…</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
