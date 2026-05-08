"use client";

export default function Error({ error, reset }) {
  return (
    <div style={{ padding: 24, fontFamily: "monospace", background: "#0a0e0a", color: "#b9ff3c", minHeight: "100vh" }}>
      <h2 style={{ color: "#ff6b6b" }}>Runtime Error</h2>
      <pre style={{ color: "#ff6b6b", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {error?.message}
      </pre>
      <pre style={{ color: "#888", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {error?.stack}
      </pre>
      <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", background: "#b9ff3c", color: "#0a0e0a", border: "none", cursor: "pointer", borderRadius: 4 }}>
        Try again
      </button>
    </div>
  );
}
