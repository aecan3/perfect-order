"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Check, ArrowRight } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import { createClient } from "@/lib/supabase";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import BackButton from "@/components/BackButton";

const PRINTING_LABELS = {
  holofoil:         "Holo",
  reverse_holofoil: "Rev. Holo",
  normal:           "Normal",
};

const STATUS_META = {
  auto:    { label: "Auto-matched", color: "#c8ff4a" },
  variant: { label: "Pick foil type", color: "#FFB830" },
  set:     { label: "Pick card",     color: "#60a5fa" },
  none:    { label: "Not found",     color: "#ff6b6b" },
};

function initSelections(results) {
  const sel = {};
  results.forEach((r, i) => {
    if (r.status === "none") {
      sel[i] = "skip";
    } else if (r.status === "auto") {
      sel[i] = 0;
    } else if (r.status === "variant") {
      const hint = r.aiCard.printing_type_hint;
      const idx  = hint ? r.matches.findIndex((m) => m.printing_type === hint) : -1;
      sel[i] = idx >= 0 ? idx : null;
    } else {
      sel[i] = null;
    }
  });
  return sel;
}

// ── CandidateTile ─────────────────────────────────────────────────────────────

function CandidateTile({ match, selected, fixedWidth, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position:    "relative",
        flexShrink:  fixedWidth ? 0 : undefined,
        width:       fixedWidth ? 88 : undefined,
        aspectRatio: "2.5/3.5",
        borderRadius: "var(--border-radius-md)",
        overflow:    "hidden",
        background:  "rgba(0,0,0,0.4)",
        cursor:      onClick ? "pointer" : "default",
        outline:     selected ? "2px solid var(--po-green)" : "2px solid transparent",
        outlineOffset: 2,
        transition:  "outline-color 0.12s",
      }}
    >
      {match.image_url ? (
        <img
          src={match.image_url}
          alt={match.card_name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 6, textAlign: "center",
          fontSize: 8, color: "var(--po-text-faint)", lineHeight: 1.3,
        }}>
          {match.card_name}
        </div>
      )}

      <div style={{
        position: "absolute", inset: "auto 0 0",
        padding: "16px 5px 5px",
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)",
      }}>
        <div style={{ fontSize: 6, color: "rgba(255,255,255,0.55)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {match.set_name} · #{match.card_number}
        </div>
        <div style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
          {PRINTING_LABELS[match.printing_type] || match.printing_type}
        </div>
      </div>

      {selected && (
        <div style={{
          position: "absolute", top: 5, right: 5,
          width: 18, height: 18, borderRadius: "50%",
          background: "var(--po-green)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={11} style={{ color: "#050507" }} />
        </div>
      )}
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────

function ResultCard({ result, selection, onSelect, onSkip, onUnskip }) {
  const { aiCard, matches, status } = result;
  const isSkipped = selection === "skip";
  const { label: statusLabel, color: statusColor } = STATUS_META[status] || STATUS_META.none;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--po-text)", flex: 1 }}>
          {aiCard.card_name}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap",
          background: `${statusColor}22`,
          color: statusColor,
          border: `1px solid ${statusColor}44`,
        }}>
          {statusLabel}
        </span>
      </div>

      {status === "none" ? (
        <div style={{
          padding: "12px 14px",
          background: "var(--po-bg-soft)",
          border: "1px solid var(--po-border)",
          borderRadius: "var(--border-radius-md)",
          fontSize: 13, color: "var(--po-text-dim)", lineHeight: 1.4,
        }}>
          <p style={{ margin: 0 }}>
            {aiCard.card_name}
            {aiCard.card_number ? ` #${aiCard.card_number}` : ""}
            {aiCard.set_name   ? ` · ${aiCard.set_name}`   : ""}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--po-text-faint)" }}>
            Not matched in the database. Skipped automatically.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              opacity: isSkipped ? 0.35 : 1,
              pointerEvents: isSkipped ? "none" : "auto",
              transition: "opacity 0.15s",
              ...(status === "set"
                ? { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }
                : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }),
            }}
          >
            {matches.map((m, mi) => (
              <CandidateTile
                key={m.printing_id}
                match={m}
                selected={selection === mi}
                fixedWidth={status === "set"}
                onClick={
                  status === "auto"
                    ? undefined
                    : () => onSelect(selection === mi ? null : mi)
                }
              />
            ))}
            {/* Spacer for auto: keeps tile at half-width in 2-col grid */}
            {status === "auto" && <div />}
          </div>

          <div style={{ marginTop: 8, textAlign: "right" }}>
            {isSkipped ? (
              <button
                onClick={onUnskip}
                style={{ background: "none", border: "none", fontSize: 12, color: "var(--po-text-dim)", cursor: "pointer", padding: "4px 0" }}
              >
                Undo skip
              </button>
            ) : (
              <button
                onClick={onSkip}
                style={{ background: "none", border: "none", fontSize: 12, color: "var(--po-text-faint)", cursor: "pointer", padding: "4px 0" }}
              >
                Skip this card
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const router     = useRouter();
  const supabase   = createClient();
  const fileRef    = useRef(null);

  const [authReady,   setAuthReady]   = useState(false);
  const [userHandle,  setUserHandle]  = useState(null);
  const [phase,       setPhase]       = useState("idle"); // idle | scanning | review | committing | done
  const [showCamera,  setShowCamera]  = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [selections,  setSelections]  = useState({});
  const [errMsg,      setErrMsg]      = useState("");
  const [committedCount, setCommittedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?returnTo=/trade-binder/scan");
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

  const handleImage = async (imageBase64) => {
    setPhase("scanning");
    setErrMsg("");
    try {
      const res  = await fetch("/api/trade-binder/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const json = await res.json();
      if (!res.ok) { setErrMsg(json.error || `HTTP ${res.status}`); setPhase("idle"); return; }
      setScanResults(json.results);
      setSelections(initSelections(json.results));
      setPhase("review");
    } catch (err) {
      setErrMsg(err.message);
      setPhase("idle");
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleImage(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const setSelection = (resultIdx, matchIdx) => {
    setSelections((prev) => ({ ...prev, [resultIdx]: matchIdx }));
  };

  const toCommitList = scanResults
    .map((r, i) => ({ r, i, sel: selections[i] }))
    .filter(({ sel }) => sel !== "skip" && sel !== null && sel !== undefined)
    .map(({ r, sel }) => ({
      printing_id:  r.matches[sel].printing_id,
      set_id:       r.matches[sel].set_id,
      card_number:  r.matches[sel].card_number,
    }));

  const handleCommit = async () => {
    if (toCommitList.length === 0) return;
    setPhase("committing");
    try {
      const res  = await fetch("/api/trade-binder/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: toCommitList }),
      });
      const json = await res.json();
      if (!res.ok) { setErrMsg(json.error || `HTTP ${res.status}`); setPhase("review"); return; }
      setCommittedCount(json.committed);
      setPhase("done");
    } catch (err) {
      setErrMsg(err.message);
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
        <MSPageTitle>Scan Cards</MSPageTitle>

        {/* ── Idle ─────────────────────────────────────────────────────────── */}
        {phase === "idle" && (
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 14, color: "var(--po-text-dim)", marginBottom: 8, lineHeight: 1.5 }}>
              Take a photo of a binder page. The AI identifies every card and adds them to your trade binder.
            </p>
            {errMsg && (
              <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 4 }}>{errMsg}</p>
            )}
            <button
              onClick={() => setShowCamera(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "15px 16px",
                background: "var(--po-green)", border: "none",
                borderRadius: "var(--border-radius-md)",
                color: "#050507", fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Camera size={18} />
              Take Photo
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "15px 16px",
                background: "var(--po-bg-soft)",
                border: "1px solid var(--po-border)",
                borderRadius: "var(--border-radius-md)",
                color: "var(--po-text)", fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Upload size={18} />
              Upload Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>
        )}

        {/* ── Scanning ─────────────────────────────────────────────────────── */}
        {phase === "scanning" && (
          <div style={{ marginTop: 80, textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>🔍</p>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>Identifying cards…</p>
          </div>
        )}

        {/* ── Review ───────────────────────────────────────────────────────── */}
        {phase === "review" && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: "var(--po-text-dim)", marginBottom: 20, lineHeight: 1.4 }}>
              {scanResults.length} card{scanResults.length !== 1 ? "s" : ""} identified.
              Confirm each match, then tap Commit.
            </p>
            {errMsg && (
              <p style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{errMsg}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {scanResults.map((r, i) => (
                <ResultCard
                  key={i}
                  result={r}
                  selection={selections[i]}
                  onSelect={(mi) => setSelection(i, mi)}
                  onSkip={() => setSelection(i, "skip")}
                  onUnskip={() => setSelection(i, r.status === "auto" ? 0 : (r.status === "variant" || r.status === "set" ? null : "skip"))}
                />
              ))}
            </div>
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
              onClick={() => { setScanResults([]); setSelections({}); setErrMsg(""); setPhase("idle"); }}
              style={{ background: "none", border: "none", color: "var(--po-text-dim)", fontSize: 14, cursor: "pointer", padding: "4px 0" }}
            >
              Scan another photo
            </button>
          </div>
        )}

      </div>

      {/* ── Sticky commit button ─────────────────────────────────────────────── */}
      {phase === "review" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          borderTop: "0.5px solid rgba(244,244,246,0.1)",
          background: "rgba(5,5,7,0.95)",
          backdropFilter: "blur(12px)",
          padding: "12px 16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}>
          <div style={{ maxWidth: 384, margin: "0 auto" }}>
            <button
              onClick={handleCommit}
              disabled={toCommitList.length === 0}
              style={{
                width: "100%", padding: "15px",
                background: toCommitList.length > 0 ? "var(--po-green)" : "var(--po-bg-soft)",
                border: toCommitList.length > 0 ? "none" : "1px solid var(--po-border)",
                borderRadius: "var(--border-radius-md)",
                color: toCommitList.length > 0 ? "#050507" : "var(--po-text-dim)",
                fontWeight: 700, fontSize: 15,
                cursor: toCommitList.length > 0 ? "pointer" : "default",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {toCommitList.length > 0
                ? `Add ${toCommitList.length} card${toCommitList.length !== 1 ? "s" : ""} to Trade Binder`
                : "Select at least one card to commit"}
            </button>
          </div>
        </div>
      )}

      {/* ── Camera overlay ───────────────────────────────────────────────────── */}
      {showCamera && (
        <CameraCapture
          onCapture={(dataUrl) => { setShowCamera(false); handleImage(dataUrl); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </MSShell>
  );
}
