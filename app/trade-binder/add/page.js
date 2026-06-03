"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Check, ArrowRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import BackButton from "@/components/BackButton";

// Foil badge config — covers all 8 printing_type values in the DB.
// Normal uses an outline; all holo/special variants use a filled treatment
// so near-identical card images are instantly distinguishable.
const FOIL_BADGE = {
  normal: {
    label: "Normal",
    bg: "transparent",
    border: "rgba(255,255,255,0.22)",
    color: "rgba(255,255,255,0.55)",
  },
  holofoil: {
    label: "Holo",
    bg: "rgba(255,210,0,0.18)",
    border: "rgba(255,210,0,0.55)",
    color: "#FFD700",
  },
  reverse_holofoil: {
    label: "Rev. Holo",
    bg: "rgba(160,100,255,0.18)",
    border: "rgba(160,100,255,0.55)",
    color: "#C084FC",
  },
  first_edition_holofoil: {
    label: "1st Ed Holo",
    bg: "rgba(255,110,40,0.18)",
    border: "rgba(255,110,40,0.55)",
    color: "#FF8C42",
  },
  unlimited_holofoil: {
    label: "Unlim. Holo",
    bg: "rgba(220,180,0,0.15)",
    border: "rgba(220,180,0,0.4)",
    color: "#C8A400",
  },
  unlimited: {
    label: "Unlimited",
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.45)",
  },
  masterball_reverse_holofoil: {
    label: "Masterball",
    bg: "rgba(80,55,200,0.22)",
    border: "rgba(100,80,220,0.6)",
    color: "#9B8FFF",
  },
  pokeball_reverse_holofoil: {
    label: "Pokeball",
    bg: "rgba(220,50,50,0.18)",
    border: "rgba(220,50,50,0.55)",
    color: "#FF6B6B",
  },
};

function FoilBadge({ printingType }) {
  const meta = FOIL_BADGE[printingType] || {
    label: printingType,
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.5)",
  };
  return (
    <span style={{
      display: "inline-block",
      fontSize: 7,
      fontWeight: 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      padding: "2px 5px",
      borderRadius: 3,
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      color: meta.color,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

// ── PrintingTile ──────────────────────────────────────────────────────────────

function PrintingTile({ printing, staged, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        position: "relative",
        aspectRatio: "2.5/3.5",
        borderRadius: "var(--border-radius-md)",
        overflow: "hidden",
        background: "rgba(0,0,0,0.4)",
        cursor: "pointer",
        outline: staged ? "2px solid var(--po-green)" : "2px solid transparent",
        outlineOffset: 2,
        transition: "outline-color 0.12s",
      }}
    >
      {printing.image_url ? (
        <img
          src={printing.image_url}
          alt={printing.card_name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 6, textAlign: "center",
          fontSize: 9, color: "var(--po-text-faint)", lineHeight: 1.3,
        }}>
          {printing.card_name}
        </div>
      )}

      {/* Bottom info overlay */}
      <div style={{
        position: "absolute", inset: "auto 0 0",
        padding: "20px 5px 5px",
        background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
      }}>
        <div style={{
          fontSize: 6, color: "rgba(255,255,255,0.5)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 3,
        }}>
          {printing.set_name} · #{printing.card_number}
        </div>
        <FoilBadge printingType={printing.printing_type} />
      </div>

      {/* Staged checkmark */}
      {staged && (
        <div style={{
          position: "absolute", top: 5, right: 5,
          width: 20, height: 20, borderRadius: "50%",
          background: "var(--po-green)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={12} style={{ color: "#050507" }} />
        </div>
      )}
    </div>
  );
}

// ── StagedTile — used in the review screen ────────────────────────────────────

function StagedTile({ printing, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <div style={{
        flexShrink: 0,
        width: 52,
        aspectRatio: "2.5/3.5",
        borderRadius: "var(--border-radius-md)",
        overflow: "hidden",
        background: "rgba(0,0,0,0.4)",
      }}>
        {printing.image_url ? (
          <img
            src={printing.image_url}
            alt={printing.card_name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, color: "var(--po-text-faint)", padding: 4, textAlign: "center",
          }}>
            {printing.card_name}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--po-text)", marginBottom: 3 }}>
          {printing.card_name}
        </div>
        <div style={{ fontSize: 11, color: "var(--po-text-dim)", marginBottom: 4 }}>
          {printing.set_name} · #{printing.card_number}
        </div>
        <FoilBadge printingType={printing.printing_type} />
      </div>
      <button
        onClick={onRemove}
        style={{
          flexShrink: 0,
          background: "none", border: "none",
          color: "var(--po-text-faint)", cursor: "pointer",
          padding: 6, display: "flex", alignItems: "center",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AddCardsPage() {
  const router   = useRouter();
  const supabase = createClient();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const [authReady,   setAuthReady]   = useState(false);
  const [userHandle,  setUserHandle]  = useState(null);
  const [phase,       setPhase]       = useState("search"); // search | review | committing | done
  const [query,       setQuery]       = useState("");
  const [searching,   setSearching]   = useState(false);
  const [results,     setResults]     = useState([]);
  const [searchErr,   setSearchErr]   = useState("");
  const [staged,      setStaged]      = useState(new Map()); // printing_id → printing object
  const [commitErr,   setCommitErr]   = useState("");
  const [committedCount, setCommittedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?returnTo=/trade-binder/add");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .maybeSingle();
      setUserHandle(prof?.handle || null);
      setAuthReady(true);
    })();
  }, []);

  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchErr("");
    try {
      const res  = await fetch(`/api/trade-binder/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (!res.ok) { setSearchErr(json.error || `HTTP ${res.status}`); setResults([]); }
      else setResults(json.results || []);
    } catch (err) {
      setSearchErr(err.message);
      setResults([]);
    }
    setSearching(false);
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.trim().length < 2) {
      setResults([]);
      setSearchErr("");
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => runSearch(val), 250);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearchErr("");
    setSearching(false);
    clearTimeout(debounceRef.current);
    inputRef.current?.focus();
  };

  const toggleStaged = (printing) => {
    setStaged((prev) => {
      const next = new Map(prev);
      if (next.has(printing.printing_id)) {
        next.delete(printing.printing_id);
      } else {
        next.set(printing.printing_id, printing);
      }
      return next;
    });
  };

  const removeStaged = (printingId) => {
    setStaged((prev) => {
      const next = new Map(prev);
      next.delete(printingId);
      return next;
    });
  };

  const stagedList = [...staged.values()];

  const handleCommit = async () => {
    if (stagedList.length === 0) return;
    setPhase("committing");
    setCommitErr("");
    try {
      const cards = stagedList.map((p) => ({
        printing_id: p.printing_id,
        set_id:      p.set_id,
        card_number: p.card_number,
      }));
      const res  = await fetch("/api/trade-binder/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const json = await res.json();
      if (!res.ok) { setCommitErr(json.error || `HTTP ${res.status}`); setPhase("review"); return; }
      setCommittedCount(json.committed);
      setPhase("done");
    } catch (err) {
      setCommitErr(err.message);
      setPhase("review");
    }
  };

  if (!authReady) return null;

  return (
    <MSShell hideTabBar>
      <div style={{ padding: "0 16px 120px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <BackButton />
        </div>
        <MSPageTitle>Add Cards</MSPageTitle>

        {/* ── Search ───────────────────────────────────────────────────────── */}
        {(phase === "search") && (
          <>
            {/* Search box */}
            <div style={{
              position: "relative",
              display: "flex", alignItems: "center",
              background: "var(--po-bg-soft)",
              border: "1px solid var(--po-border)",
              borderRadius: "var(--border-radius-md)",
              marginBottom: 16,
            }}>
              <Search size={15} style={{
                position: "absolute", left: 12,
                color: "var(--po-text-faint)", flexShrink: 0, pointerEvents: "none",
              }} />
              <input
                ref={inputRef}
                type="search"
                autoFocus
                placeholder="Card name, set, number, holo…"
                value={query}
                onChange={handleQueryChange}
                style={{
                  flex: 1,
                  background: "none", border: "none", outline: "none",
                  padding: "13px 40px 13px 36px",
                  color: "var(--po-text)", fontSize: 15,
                  caretColor: "var(--po-green)",
                }}
              />
              {query && (
                <button
                  onClick={clearSearch}
                  style={{
                    position: "absolute", right: 10,
                    background: "none", border: "none",
                    color: "var(--po-text-faint)", cursor: "pointer",
                    padding: 4, display: "flex", alignItems: "center",
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {searchErr && (
              <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{searchErr}</p>
            )}

            {/* Empty prompt */}
            {!query && (
              <p style={{ fontSize: 13, color: "var(--po-text-faint)", lineHeight: 1.5 }}>
                Search by card name, set, number, or foil type. Tap a card to stage it, then tap Review to add to your trade binder.
              </p>
            )}

            {/* Searching indicator */}
            {searching && (
              <p style={{ fontSize: 13, color: "var(--po-text-dim)", marginBottom: 12 }}>Searching…</p>
            )}

            {/* Results grid */}
            {!searching && results.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}>
                {results.map((p) => (
                  <PrintingTile
                    key={p.printing_id}
                    printing={p}
                    staged={staged.has(p.printing_id)}
                    onToggle={() => toggleStaged(p)}
                  />
                ))}
              </div>
            )}

            {/* No results */}
            {!searching && query.trim().length >= 2 && results.length === 0 && !searchErr && (
              <p style={{ fontSize: 13, color: "var(--po-text-faint)", marginTop: 8 }}>
                No cards found. Try a different name or number.
              </p>
            )}
          </>
        )}

        {/* ── Review ───────────────────────────────────────────────────────── */}
        {phase === "review" && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "var(--po-text-dim)", marginBottom: 4, lineHeight: 1.4 }}>
              {stagedList.length} card{stagedList.length !== 1 ? "s" : ""} to add. Remove any you don't want, then tap Confirm.
            </p>
            {commitErr && (
              <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{commitErr}</p>
            )}
            <div style={{
              borderTop: "0.5px solid var(--po-border)",
            }}>
              {stagedList.map((p) => (
                <div key={p.printing_id} style={{ borderBottom: "0.5px solid var(--po-border)" }}>
                  <StagedTile printing={p} onRemove={() => removeStaged(p.printing_id)} />
                </div>
              ))}
            </div>
            <button
              onClick={() => setPhase("search")}
              style={{
                marginTop: 16,
                background: "none", border: "none",
                color: "var(--po-text-dim)", fontSize: 13, cursor: "pointer", padding: "4px 0",
              }}
            >
              ← Back to search
            </button>
          </div>
        )}

        {/* ── Committing ───────────────────────────────────────────────────── */}
        {phase === "committing" && (
          <div style={{ marginTop: 80, textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>⏳</p>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>Adding to trade binder…</p>
          </div>
        )}

        {/* ── Done ─────────────────────────────────────────────────────────── */}
        {phase === "done" && (
          <div style={{ marginTop: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(200,255,74,0.15)",
              border: "2px solid var(--po-green)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={28} style={{ color: "var(--po-green)" }} />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--po-text)", marginBottom: 6 }}>
                {committedCount} card{committedCount !== 1 ? "s" : ""} added
              </p>
              <p style={{ fontSize: 14, color: "var(--po-text-dim)" }}>
                They now appear in your trade binder.
              </p>
            </div>
            {userHandle && (
              <button
                onClick={() => router.push(`/trade-binder/${userHandle}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "13px 20px",
                  background: "var(--po-green)", border: "none",
                  borderRadius: "var(--border-radius-md)",
                  color: "#050507", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                View Trade Binder <ArrowRight size={15} />
              </button>
            )}
            <button
              onClick={() => {
                setStaged(new Map());
                setResults([]);
                setQuery("");
                setCommitErr("");
                setPhase("search");
              }}
              style={{
                background: "none", border: "none",
                color: "var(--po-text-dim)", fontSize: 14, cursor: "pointer", padding: "4px 0",
              }}
            >
              Add more cards
            </button>
          </div>
        )}

      </div>

      {/* ── Sticky bottom bar ────────────────────────────────────────────────── */}
      {(phase === "search" || phase === "review") && staged.size > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          borderTop: "0.5px solid rgba(244,244,246,0.1)",
          background: "rgba(5,5,7,0.95)",
          backdropFilter: "blur(12px)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}>
          <div style={{ maxWidth: 384, margin: "0 auto" }}>
            {phase === "search" ? (
              <button
                onClick={() => setPhase("review")}
                style={{
                  width: "100%", padding: "15px",
                  background: "var(--po-green)", border: "none",
                  borderRadius: "var(--border-radius-md)",
                  color: "#050507", fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}
              >
                Review ({staged.size}) →
              </button>
            ) : (
              <button
                onClick={handleCommit}
                disabled={stagedList.length === 0}
                style={{
                  width: "100%", padding: "15px",
                  background: stagedList.length > 0 ? "var(--po-green)" : "var(--po-bg-soft)",
                  border: stagedList.length > 0 ? "none" : "1px solid var(--po-border)",
                  borderRadius: "var(--border-radius-md)",
                  color: stagedList.length > 0 ? "#050507" : "var(--po-text-dim)",
                  fontWeight: 700, fontSize: 15,
                  cursor: stagedList.length > 0 ? "pointer" : "default",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {stagedList.length > 0
                  ? `Add ${stagedList.length} card${stagedList.length !== 1 ? "s" : ""} to Trade Binder`
                  : "Select at least one card"}
              </button>
            )}
          </div>
        </div>
      )}
    </MSShell>
  );
}
