// ⚠️ TEMPORARY SPIKE — Stage 4a test harness. Remove before or during Stage 4b.
// Fires a binder photo at /api/trade-binder/scan and displays raw JSON output.
// Reachable at /trade-binder/scan-test (passes proxy auth-exemption via /trade-binder/ prefix).
// The API itself requires a logged-in session — log in normally before using.
"use client";

import { useState, useRef } from "react";

export default function ScanTestPage() {
  const [status, setStatus]   = useState("idle"); // idle | loading | done | error
  const [result, setResult]   = useState(null);
  const [errMsg, setErrMsg]   = useState("");
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("loading");
    setResult(null);
    setErrMsg("");

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const imageBase64 = ev.target.result; // includes data: prefix — route strips it
      try {
        const res = await fetch("/api/trade-binder/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        const json = await res.json();
        if (!res.ok) {
          setErrMsg(json.error || `HTTP ${res.status}`);
          setStatus("error");
        } else {
          setResult(json);
          setStatus("done");
        }
      } catch (err) {
        setErrMsg(err.message);
        setStatus("error");
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ fontFamily: "monospace", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <p style={{ color: "#ff6b6b", fontWeight: "bold", marginBottom: 16 }}>
        ⚠️ TEMPORARY SPIKE — Stage 4a only. Remove before Stage 4b ships.
      </p>
      <h1 style={{ marginBottom: 8 }}>Trade Binder Scan — spike test</h1>
      <p style={{ color: "#aaa", marginBottom: 24, fontSize: 13 }}>
        Must be logged in. Fires the photo at /api/trade-binder/scan and shows raw JSON.
        Nothing is written to the DB.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={status === "loading"}
        style={{
          padding: "10px 20px",
          background: "#c8ff4a",
          color: "#000",
          border: "none",
          borderRadius: 6,
          fontFamily: "monospace",
          fontWeight: "bold",
          cursor: status === "loading" ? "wait" : "pointer",
          opacity: status === "loading" ? 0.6 : 1,
        }}
      >
        {status === "loading" ? "Scanning…" : "Choose binder photo"}
      </button>

      {status === "error" && (
        <pre style={{ color: "#ff6b6b", marginTop: 16, whiteSpace: "pre-wrap" }}>
          ERROR: {errMsg}
        </pre>
      )}

      {status === "done" && result && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 8 }}>Summary</h2>
          <pre style={{ background: "#1a1a1a", padding: 12, borderRadius: 6, color: "#c8ff4a" }}>
            {JSON.stringify(result.summary, null, 2)}
          </pre>

          <h2 style={{ margin: "20px 0 8px" }}>Results (per card)</h2>
          {result.results.map((r, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                padding: 12,
                background: "#111",
                borderRadius: 6,
                borderLeft: `4px solid ${
                  r.status === "auto"    ? "#c8ff4a" :
                  r.status === "variant" ? "#FFB830" :
                  r.status === "set"     ? "#60a5fa" :
                  "#ff6b6b"
                }`,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                [{r.status.toUpperCase()}] {r.aiCard.card_name} #{r.aiCard.card_number}
                {" — "}
                <span style={{ color: "#aaa", fontWeight: "normal" }}>
                  {r.aiCard.set_name} · {r.aiCard.printing_type_hint} · conf: {r.aiCard.confidence}
                </span>
              </div>
              <pre style={{ margin: 0, fontSize: 11, color: "#ccc", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(r.matches, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
