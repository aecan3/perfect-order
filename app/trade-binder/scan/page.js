"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Check, ArrowRight, Zap } from "lucide-react";
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

const CONF_META = {
  high:   { label: "High", color: "#c8ff4a" },
  medium: { label: "Med",  color: "#FFB830" },
  low:    { label: "Low",  color: "#ff6b6b" },
};

// "Worse wins": resolution state and AI confidence both contribute; lower score wins.
// Missing AI confidence (null/undefined) is treated as neutral (2) so it doesn't penalise.
function deriveConfidence(status, aiConfidence) {
  const resScore = status === "auto" ? 2 : status === "variant" ? 1 : 0;
  const aiScore  = aiConfidence === "low" ? 0 : aiConfidence === "medium" ? 1 : 2;
  const combined = Math.min(resScore, aiScore);
  return combined === 2 ? "high" : combined === 1 ? "medium" : "low";
}

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
  const confidence = deriveConfidence(status, aiCard.confidence);
  const { label: confLabel, color: confColor } = CONF_META[confidence];

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
        <span style={{ fontSize: 9, fontWeight: 600, color: confColor, opacity: 0.8, whiteSpace: "nowrap" }}>
          {confLabel}
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
  const router   = useRouter();
  const supabase = createClient();
  const fileRef  = useRef(null);

  // rapid-fire capture refs
  const captureStreamRef = useRef(null);
  const captureVideoRef  = useRef(null);
  const captureCanvasRef = useRef(null);
  const captureGuideRef  = useRef(null); // read getBoundingClientRect() at shutter time
  const lastCaptureRef   = useRef(0);    // throttle timestamp

  const [authReady,   setAuthReady]   = useState(false);
  const [userHandle,  setUserHandle]  = useState(null);
  // idle | capture | scanning | processing | review | committing | done
  const [phase,       setPhase]       = useState("idle");
  const [showCamera,  setShowCamera]  = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [selections,  setSelections]  = useState({});
  const [errMsg,      setErrMsg]      = useState("");
  const [committedCount, setCommittedCount] = useState(0);

  // rapid-fire capture state
  const [capturedImages,     setCapturedImages]     = useState([]);
  const [captureReady,       setCaptureReady]       = useState(false);
  const [flash,              setFlash]              = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ done: 0, total: 0 });

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

  // Start / stop camera stream when in capture phase
  useEffect(() => {
    if (phase !== "capture") return;
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        captureStreamRef.current = stream;
        if (captureVideoRef.current) captureVideoRef.current.srcObject = stream;
        setCaptureReady(true);
      })
      .catch((err) => {
        console.error("[capture] camera error:", err);
        setPhase("idle");
      });
    return () => {
      active = false;
      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach((t) => t.stop());
        captureStreamRef.current = null;
      }
      setCaptureReady(false);
    };
  }, [phase]);

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

  // Shared batch pipeline — used by both rapid-capture Done and multi-upload.
  // Caller sets phase to "processing" first (so capture stream cleanup fires),
  // then passes the array of base64 data-URL strings.
  const processImageBatch = async (images) => {
    setProcessingProgress({ done: 0, total: images.length });

    const allCardResults = [];
    let nextIdx        = 0;
    let completedCount = 0;

    const worker = async () => {
      while (nextIdx < images.length) {
        const idx = nextIdx++;
        try {
          const res  = await fetch("/api/trade-binder/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: images[idx] }),
          });
          const json = await res.json();
          if (res.ok && Array.isArray(json.results)) {
            allCardResults.push(...json.results);
          }
        } catch (err) {
          console.error("[batch] shot", idx, "failed:", err.message);
        }
        completedCount++;
        setProcessingProgress({ done: completedCount, total: images.length });
      }
    };

    const CONCURRENCY = 5;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, worker));

    if (allCardResults.length === 0) {
      setErrMsg("No cards identified across all photos.");
      setPhase("idle");
      return;
    }

    setScanResults(allCardResults);
    setSelections(initSelections(allCardResults));
    setPhase("review");
  };

  // Multi-file upload: read all files to base64 in parallel, then batch-process.
  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const images = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = (ev) => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    );

    setErrMsg("");
    setPhase("processing");
    await processImageBatch(images);
  };

  const setSelection = (resultIdx, matchIdx) => {
    setSelections((prev) => ({ ...prev, [resultIdx]: matchIdx }));
  };

  // Synchronous frame grab cropped to the guide rect, accounting for objectFit: cover.
  // Reads live getBoundingClientRect() so translateY and any layout shifts are captured exactly.
  const handleShutter = () => {
    const video  = captureVideoRef.current;
    const canvas = captureCanvasRef.current;
    const guide  = captureGuideRef.current;
    if (!video || !canvas || !guide || !captureReady || video.videoWidth === 0) return;
    const now = Date.now();
    if (now - lastCaptureRef.current < 300) return; // 300 ms throttle
    lastCaptureRef.current = now;

    // Displayed size of the video element and native source size
    const dispW = video.clientWidth;
    const dispH = video.clientHeight;
    const srcW  = video.videoWidth;
    const srcH  = video.videoHeight;

    // objectFit: cover — scale by the larger ratio so both axes fill, overflow clipped, centered
    const scale   = Math.max(dispW / srcW, dispH / srcH);
    const scaledW = srcW * scale;
    const scaledH = srcH * scale;
    const offX    = (scaledW - dispW) / 2; // source-px hidden on left/right
    const offY    = (scaledH - dispH) / 2; // source-px hidden on top/bottom

    // Guide rect in CSS px relative to the top-left of the video element
    const guideRect = guide.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();
    const guideLeft = guideRect.left - videoRect.left;
    const guideTop  = guideRect.top  - videoRect.top;
    const guideW    = guideRect.width;
    const guideH    = guideRect.height;

    // Map guide rect from display-px back to source-px
    const sx = (guideLeft + offX) / scale;
    const sy = (guideTop  + offY) / scale;
    const sw = guideW / scale;
    const sh = guideH / scale;

    // Clamp to source bounds so rounding cannot read outside the frame
    const csx = Math.max(0, sx);
    const csy = Math.max(0, sy);
    const csw = Math.min(sw, srcW - csx);
    const csh = Math.min(sh, srcH - csy);

    canvas.width  = Math.round(csw);
    canvas.height = Math.round(csh);
    canvas.getContext("2d").drawImage(video, csx, csy, csw, csh, 0, 0, csw, csh);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    setCapturedImages((prev) => [...prev, dataUrl]);
    setFlash(true);
    setTimeout(() => setFlash(false), 80);
    navigator.vibrate?.(30);
  };

  const handleCaptureDone = async () => {
    if (capturedImages.length === 0) return;
    const images = [...capturedImages];
    setPhase("processing"); // triggers capture stream cleanup via useEffect
    await processImageBatch(images);
  };

  // Needs-attention-first: Low → Medium → High so the user resolves hard ones first.
  const sortedIndices = useMemo(() => {
    const order = { low: 0, medium: 1, high: 2 };
    return [...scanResults.keys()].sort((a, b) => {
      const ca = deriveConfidence(scanResults[a].status, scanResults[a].aiCard.confidence);
      const cb = deriveConfidence(scanResults[b].status, scanResults[b].aiCard.confidence);
      return order[ca] - order[cb];
    });
  }, [scanResults]);

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
          <BackButton
            href={phase === "done" && userHandle ? `/trade-binder/${userHandle}` : undefined}
            replace={phase === "done"}
          />
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
              onClick={() => { setCapturedImages([]); setErrMsg(""); setPhase("capture"); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "15px 16px",
                background: "var(--po-green)", border: "none",
                borderRadius: "var(--border-radius-md)",
                color: "#050507", fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Zap size={18} />
              Rapid Capture
            </button>
            <button
              onClick={() => setShowCamera(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "15px 16px",
                background: "var(--po-bg-soft)",
                border: "1px solid var(--po-border)",
                borderRadius: "var(--border-radius-md)",
                color: "var(--po-text)", fontSize: 15, fontWeight: 600, cursor: "pointer",
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
              Upload Photos
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFile} />
          </div>
        )}

        {/* ── Scanning ─────────────────────────────────────────────────────── */}
        {phase === "scanning" && (
          <div style={{ marginTop: 80, textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>🔍</p>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>Identifying cards…</p>
          </div>
        )}

        {/* ── Processing (batch) ───────────────────────────────────────────── */}
        {phase === "processing" && (
          <div style={{ marginTop: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 0 }}>⚡</p>
            <p style={{ color: "var(--po-text-dim)", fontSize: 14 }}>
              Processing {processingProgress.done} of {processingProgress.total} photos…
            </p>
            <div style={{
              width: "100%", maxWidth: 280, height: 4,
              background: "var(--po-bg-soft)", borderRadius: 2, overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${processingProgress.total > 0 ? (processingProgress.done / processingProgress.total) * 100 : 0}%`,
                background: "var(--po-green)",
                borderRadius: 2,
                transition: "width 0.25s",
              }} />
            </div>
            <p style={{ fontSize: 12, color: "var(--po-text-faint)" }}>
              {processingProgress.done} / {processingProgress.total}
            </p>
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
              {sortedIndices.map((i) => {
                const r = scanResults[i];
                return (
                  <ResultCard
                    key={i}
                    result={r}
                    selection={selections[i]}
                    onSelect={(mi) => setSelection(i, mi)}
                    onSkip={() => setSelection(i, "skip")}
                    onUnskip={() => setSelection(i, r.status === "auto" ? 0 : (r.status === "variant" || r.status === "set" ? null : "skip"))}
                  />
                );
              })}
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
                onClick={() => router.replace(`/trade-binder/${userHandle}`)}
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

      {/* ── Rapid-fire capture overlay ───────────────────────────────────────── */}
      {phase === "capture" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "#000",
          display: "flex", flexDirection: "column",
        }}>
          {/* Live camera feed */}
          <video
            ref={captureVideoRef}
            autoPlay
            playsInline
            muted
            style={{ flex: 1, objectFit: "cover", width: "100%", minHeight: 0, display: "block" }}
          />

          {/* Card framing guide — enlarged to 78%, ref'd for crop math */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div
              ref={captureGuideRef}
              style={{
                width: "78%",
                aspectRatio: "2.5/3.5",
                border: "2px solid rgba(200,255,74,0.75)",
                borderRadius: 10,
                boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)",
                transform: "translateY(-10%)",
              }}
            />
          </div>

          {/* Instruction label */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{
              marginTop: "calc(78vw * (3.5/2.5) * 0.42)",
              fontSize: 13, fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}>
              Fill the box with one card.
            </span>
          </div>

          {/* Shutter flash */}
          {flash && (
            <div style={{
              position: "absolute", inset: 0,
              background: "#fff", opacity: 0.55,
              pointerEvents: "none",
            }} />
          )}

          {/* Counter badge (top-right) */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "max(16px, env(safe-area-inset-top)) 20px 12px",
            display: "flex", justifyContent: "flex-end",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
            pointerEvents: "none",
          }}>
            {capturedImages.length > 0 && (
              <span style={{
                fontSize: 13, fontWeight: 700, color: "#fff",
                background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 20,
              }}>
                {capturedImages.length} captured
              </span>
            )}
          </div>

          {/* Bottom bar: Cancel · Shutter · Done */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "20px 28px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          }}>
            {/* Cancel */}
            <button
              onClick={() => { setCapturedImages([]); setPhase("idle"); }}
              style={{
                background: "rgba(255,255,255,0.15)", border: "none",
                borderRadius: 24, padding: "10px 20px",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Cancel
            </button>

            {/* Shutter button */}
            <button
              onClick={handleShutter}
              disabled={!captureReady}
              style={{
                width: 68, height: 68, borderRadius: "50%",
                background: captureReady ? "#fff" : "rgba(255,255,255,0.25)",
                border: "4px solid rgba(255,255,255,0.45)",
                cursor: captureReady ? "pointer" : "default",
                flexShrink: 0,
                transition: "background 0.12s",
              }}
            />

            {/* Done / undo */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button
                onClick={handleCaptureDone}
                disabled={capturedImages.length === 0}
                style={{
                  background: capturedImages.length > 0 ? "var(--po-green)" : "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 24, padding: "10px 20px",
                  color: capturedImages.length > 0 ? "#050507" : "rgba(255,255,255,0.35)",
                  fontSize: 14, fontWeight: 700,
                  cursor: capturedImages.length > 0 ? "pointer" : "default",
                  transition: "background 0.15s, color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {capturedImages.length > 0 ? `Done (${capturedImages.length})` : "Done"}
              </button>
              {capturedImages.length > 0 && (
                <button
                  onClick={() => setCapturedImages((prev) => prev.slice(0, -1))}
                  style={{
                    background: "none", border: "none",
                    color: "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer", padding: 0,
                  }}
                >
                  Undo last
                </button>
              )}
            </div>
          </div>

          {/* Hidden canvas for synchronous frame grabs */}
          <canvas ref={captureCanvasRef} style={{ display: "none" }} />
        </div>
      )}

      {/* ── Single-shot camera overlay ───────────────────────────────────────── */}
      {showCamera && (
        <CameraCapture
          onCapture={(dataUrl) => { setShowCamera(false); handleImage(dataUrl); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </MSShell>
  );
}
