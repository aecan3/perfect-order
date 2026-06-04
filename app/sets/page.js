"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Check, Plus, X, ChevronLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { selectMasterPrintings } from "@/lib/queries/printings";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";

const RATES = {
  AUD: { rate: 1.53, symbol: "A$" },
  USD: { rate: 1.0,  symbol: "$"  },
  GBP: { rate: 0.79, symbol: "Â£"  },
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
  gx: "GX", full_art: "Full Art", prism_star: "Prism Star â—‡", shining: "Shining",
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
  "use no memo";
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [allSets, setAllSets] = useState([]);
  const [slotCountById, setSlotCountById] = useState({});
  const [activeSetIds, setActiveSetIds] = useState(new Set());  // user_sets with hidden_at IS NULL
  const [hiddenSetIds, setHiddenSetIds] = useState(new Set());  // user_sets with hidden_at IS NOT NULL
  const [query, setQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
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
  // >0 when set was previously removed but collection_entries remain (case 3)
  const [wizardExistingCount, setWizardExistingCount] = useState(0);
  // delete-confirmation sub-modal
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

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
      if (user) setUser(user);
      setAuthResolved(true);

      const { data: sets } = await supabase
        .from("sets")
        .select("id, code, name, series, total, total_with_secrets, release_date, logo_url, theme_primary, theme_secondary, theme_bg")
        .order("release_date", { ascending: false });

      setAllSets(sets || []);

      if (sets && sets.length > 0) {
        const { data: slotRows } = await supabase.rpc("master_printing_counts", {
          set_ids: sets.map((s) => s.id),
        });
        const map = {};
        (slotRows || []).forEach((r) => { map[r.set_id] = Number(r.slot_count); });
        setSlotCountById(map);
      }

      if (user) {
        const { data: userSets } = await supabase.from("user_sets").select("set_id, hidden_at").eq("user_id", user.id);
        const active = new Set();
        const hidden = new Set();
        for (const row of userSets || []) {
          if (row.hidden_at) hidden.add(row.set_id);
          else active.add(row.set_id);
        }
        setActiveSetIds(active);
        setHiddenSetIds(hidden);
      }

      setLoading(false);
    })();
  }, [router, supabase]);

  // â"€â"€ Wizard derived values â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

  // â"€â"€ Browser derived values â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

  // â"€â"€ Wizard actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const handleAddTap = async (set) => {
    if (!user) return;
    // Case 2: set is hidden â†' unhide and navigate, no wizard
    if (hiddenSetIds.has(set.id)) {
      await supabase.from("user_sets")
        .update({ hidden_at: null })
        .eq("user_id", user.id)
        .eq("set_id", set.id);
      setHiddenSetIds((prev) => { const n = new Set(prev); n.delete(set.id); return n; });
      setActiveSetIds((prev) => new Set([...prev, set.id]));
      router.push(`/set/${set.id}`);
      return;
    }

    // Cases 1, 3, 4: set not in user_sets â€" check for orphaned collection_entries
    const { count } = await supabase
      .from("collection_entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("set_id", set.id);

    const existingCount = count || 0;

    // Set up wizard shell immediately so user sees it open
    setWizardSet(set);
    setWizardStep(1);
    setWizardMode(null);
    setWizardPrintings([]);
    setWizardLoading(true);
    setSelectedBuckets(new Set());
    setWizardResult(null);
    setWizardExistingCount(existingCount);
    setConfirmDeleteVisible(false);
    setWizardBusy(false);

    // Fetch printings + cards in parallel
    const [{ data: printingData }, { data: cardData }] = await Promise.all([
      selectMasterPrintings(supabase, "id, card_number, printing_type, price_usd")
        .eq("set_id", set.id),
      supabase
        .from("cards")
        .select("number, rarity, subtypes")
        .eq("set_id", set.id),
    ]);

    const cardByNumber = {};
    for (const c of cardData || []) cardByNumber[c.number] = c;

    const merged = (printingData || []).map((p) => ({
      ...p,
      _rarity: cardByNumber[p.card_number]?.rarity || null,
      _subtypes: cardByNumber[p.card_number]?.subtypes || [],
    }));

    setWizardPrintings(merged);
    setWizardLoading(false);
  };

  const closeWizard = () => {
    setWizardSet(null);
    setConfirmDeleteVisible(false);
  };

  const ensureUserSet = async (setId) => {
    if (!user?.id || !setId) return;
    if (activeSetIds.has(setId) || hiddenSetIds.has(setId)) {
      // If hidden, also clear hidden_at
      if (hiddenSetIds.has(setId)) {
        await supabase.from("user_sets")
          .update({ hidden_at: null })
          .eq("user_id", user.id).eq("set_id", setId);
        setHiddenSetIds((prev) => { const n = new Set(prev); n.delete(setId); return n; });
      }
    } else {
      await supabase.from("user_sets").insert({ user_id: user.id, set_id: setId });
    }
    setActiveSetIds((prev) => new Set([...prev, setId]));
  };

  const bulkInsertEntries = async (printings) => {
    if (!user?.id || !wizardSet?.id) return 0;
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

  // "Pick up where you left off" â€" re-add set, navigate with existing data intact
  const resumeExisting = async () => {
    if (!wizardSet?.id) return;
    setWizardBusy(true);
    await ensureUserSet(wizardSet.id);
    router.push(`/set/${wizardSet.id}`);
  };

  // Confirmed delete of existing entries â†' clear warning, continue with wizard
  const confirmDeleteExisting = async () => {
    if (!user?.id || !wizardSet?.id) return;
    setConfirmDeleteVisible(false);
    setWizardBusy(true);
    await supabase.from("collection_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("set_id", wizardSet.id);
    setWizardExistingCount(0);
    setWizardBusy(false);
  };

  const selectMode = async (mode) => {
    if (!wizardSet?.id) return;
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
    if (!wizardSet?.id) return;
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
    if (!selectedBuckets.size || !wizardSet?.id) return;
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
    if (!wizardSet?.id) return;
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

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const isAnonymous = !user;

  if (loading) {
    return (
      <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "var(--ms-dim)" }}>
          Loading...
        </div>
      </MSShell>
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
    <MSShell hideTabBar={!authResolved} anonymousNav={authResolved && isAnonymous}>
      <MSPageTitle>{isAnonymous ? "BROWSE SETS" : "ADD A SET"}</MSPageTitle>

      <div className="px-4 pb-3 max-w-md mx-auto">
        <div className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--po-text-dim)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg text-[var(--po-text)] placeholder-[var(--po-text-dim)] focus:outline-none focus:border-[var(--po-green)]"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
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
      </div>

      <div className="px-4 py-4 space-y-2 max-w-md mx-auto">
        {filteredSets.length === 0 ? (
          <div className="text-center text-[var(--po-text-dim)] text-sm py-8">
            No sets match.
          </div>
        ) : (
          filteredSets.map((set) => {
            const total = slotCountById[set.id] || set.total_with_secrets || 0;
            const isActive = activeSetIds.has(set.id);
            const isHidden = hiddenSetIds.has(set.id);
            const primary = set.theme_primary || "#b9ff3c";
            const bg = set.theme_bg || "#0a0e0a";
            return (
              <div
                key={set.id}
                className="rounded-xl border border-[var(--po-border)] overflow-hidden flex items-center gap-3 p-3"
                style={{ background: `linear-gradient(135deg, ${bg} 0%, #0a0e0a 100%)` }}
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
                  <div className="font-bold text-sm leading-tight truncate" style={{ color: primary }}>
                    {set.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mt-0.5 truncate">
                    {set.series || "—"} · {total} cards
                  </div>
                </div>
                {isAnonymous ? (
                  <Link
                    href={`/set/${set.id}`}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)]"
                  >
                    View
                  </Link>
                ) : isActive ? (
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
                    onClick={() => handleAddTap(set)}
                    className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text-dim)] hover:border-[var(--po-green)] hover:text-[var(--po-green)] flex items-center gap-1"
                  >
                    {isHidden ? (
                      <>
                        <Check size={12} />
                        Unhide
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        Add
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Setup wizard bottom sheet â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
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
                  Loading set data...
                </div>
              ) : wizardStep === 1 ? (
                <div className="pt-2 space-y-3">
                  {/* Case 3: warning banner + resume/fresh-delete buttons */}
                  {wizardExistingCount > 0 && (
                    <>
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/40 border border-amber-700/50">
                        <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[12px] text-amber-300 leading-snug">
                          You've previously collected cards in this set.
                        </p>
                      </div>

                      {/* Pick up where you left off */}
                      <button
                        onClick={resumeExisting}
                        disabled={wizardBusy}
                        className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                        style={{ background: wPrimary, color: wBg }}
                      >
                        {wizardBusy ? "Loading..." : "Pick up where you left off"}
                      </button>

                      {/* Start completely fresh (destructive) */}
                      <button
                        onClick={() => setConfirmDeleteVisible(true)}
                        disabled={wizardBusy}
                        className="w-full py-3 rounded-xl font-bold text-sm border border-red-800/60 text-red-400 hover:border-red-600 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        Start completely fresh
                      </button>

                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-[var(--po-border)]" />
                        <span className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">or</span>
                        <div className="flex-1 h-px bg-[var(--po-border)]" />
                      </div>
                    </>
                  )}

                  {/* Standard three options */}
                  {[
                    {
                      id: "fresh",
                      title: "Starting fresh",
                      desc: "Just track what you collect from here",
                    },
                    {
                      id: "full",
                      title: "I already have the full set",
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
                    {wizardBusy ? "Addingâ€¦" : `Mark all ${wizardPrintings.length} as collected`}
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
                          <span className="text-[11px] text-[var(--po-text-dim)]">{b.count}</span>
                          {b.totalValue > 0 && (
                            <span className="text-[11px]" style={{ color: wPrimary }}>
                              {fmtMoney(b.totalValue * (RATES[currency]?.rate || 1), currency)}
                            </span>
                          )}
                          {sel && <Check size={14} className="text-[var(--po-green)] flex-shrink-0" />}
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
                      Skip â€" start empty
                    </button>
                    <button
                      onClick={confirmPartial}
                      disabled={wizardBusy || !selectedBuckets.size}
                      className="flex-[2] py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40 disabled:bg-[var(--po-bg-soft)] disabled:text-[var(--po-text-dim)]"
                      style={selectedBuckets.size ? { background: wPrimary, color: wBg } : undefined}
                    >
                      {wizardBusy
                        ? "Addingâ€¦"
                        : selectedBuckets.size
                        ? `Apply selection (${selectedCount})`
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

            {/* Working overlay */}
            {wizardBusy && wizardStep < 3 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-t-2xl bg-[var(--po-bg-soft)]/80 z-10">
                <span className="text-sm text-[var(--po-text-dim)]">Workingâ€¦</span>
              </div>
            )}
          </div>

          {/* â"€â"€ Delete confirmation sub-modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
          {confirmDeleteVisible && (
            <>
              <div
                className="fixed inset-0 bg-black/50"
                style={{ zIndex: 60 }}
                onClick={() => setConfirmDeleteVisible(false)}
              />
              <div
                className="fixed inset-x-6 top-1/2 -translate-y-1/2 bg-[var(--po-bg-soft)] rounded-2xl border border-red-800/50 p-5 shadow-2xl"
                style={{ zIndex: 60 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                  <span className="font-bold text-sm text-red-400">Delete collected cards?</span>
                </div>
                <p className="text-[12px] text-[var(--po-text-dim)] leading-relaxed mb-4">
                  This will permanently delete your {wizardExistingCount} previously collected card
                  {wizardExistingCount === 1 ? "" : "s"} from this set. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDeleteVisible(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[var(--po-border)] text-[var(--po-text-dim)] hover:border-[var(--po-green)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteExisting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-700 hover:bg-red-600 text-white"
                  >
                    Delete &amp; continue
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </MSShell>
  );
}

