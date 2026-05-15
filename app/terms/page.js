import { TERMS_LAST_UPDATED, TERMS_CONTENT } from "@/content/legal/terms";
import { TOS_VERSION } from "@/lib/legalVersions";

function renderMarkdown(text) {
  const elements = [];
  let para = [];

  for (const line of text.trim().split("\n")) {
    if (line.startsWith("## ")) {
      if (para.length) {
        elements.push(para.join(" "));
        para = [];
      }
      elements.push({ heading: line.slice(3) });
    } else if (!line.trim()) {
      if (para.length) {
        elements.push(para.join(" "));
        para = [];
      }
    } else {
      para.push(line.trim());
    }
  }
  if (para.length) elements.push(para.join(" "));

  return elements.map((el, i) =>
    typeof el === "object" ? (
      <h2
        key={i}
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--po-text)",
          marginTop: 28,
          marginBottom: 6,
          fontFamily: '"IBM Plex Sans", sans-serif',
        }}
      >
        {el.heading}
      </h2>
    ) : (
      <p
        key={i}
        style={{
          fontSize: 14,
          color: "var(--po-text-dim)",
          lineHeight: 1.75,
          marginBottom: 10,
          fontFamily: '"IBM Plex Sans", sans-serif',
        }}
      >
        {el}
      </p>
    )
  );
}

export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--po-bg)",
        padding: "env(safe-area-inset-top) 0 48px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ paddingTop: 20, marginBottom: 32 }}>
          <a
            href="/login"
            style={{
              fontSize: 13,
              color: "var(--po-text-dim)",
              textDecoration: "none",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}
          >
            ← Back to sign in
          </a>
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "var(--po-text)",
            marginBottom: 6,
            fontFamily: '"IBM Plex Sans", sans-serif',
          }}
        >
          Terms of Service
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--po-text-dim)",
            marginBottom: 32,
            fontFamily: '"IBM Plex Mono", monospace',
            letterSpacing: "0.04em",
          }}
        >
          Version {TOS_VERSION} · Last updated {TERMS_LAST_UPDATED}
        </p>

        {renderMarkdown(TERMS_CONTENT)}
      </div>
    </div>
  );
}
