"use client";

import { useState, useEffect } from "react";
import { createPasskeyClient } from "@/lib/supabase";
import { usePasskeyEnrollment } from "@/lib/usePasskeyEnrollment";

const sectionHeadStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--ms-dim)",
  marginBottom: 12,
};

const btnStyle = (disabled) => ({
  padding: "8px 16px",
  background: "transparent",
  border: "1px solid var(--ms-rule)",
  borderRadius: 8,
  color: disabled ? "var(--ms-dim)" : "var(--ms-ink)",
  fontSize: 14,
  fontFamily: '"IBM Plex Sans", sans-serif',
  cursor: disabled ? "default" : "pointer",
});

export default function PasskeySection() {
  // "loading" | "none" | "enrolled"
  const [listState, setListState] = useState("loading");
  const [enrolledCount, setEnrolledCount] = useState(0);
  const { status, errorMessage, enroll } = usePasskeyEnrollment();

  useEffect(() => {
    async function checkEnrolled() {
      const supabase = createPasskeyClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error || !Array.isArray(data)) {
        setListState("none");
        return;
      }
      setEnrolledCount(data.length);
      setListState(data.length > 0 ? "enrolled" : "none");
    }
    checkEnrolled();
  }, []);

  async function handleEnroll() {
    const ok = await enroll();
    if (ok) {
      setEnrolledCount((c) => c + 1);
      setListState("enrolled");
    }
  }

  // Promote to enrolled view immediately on success, regardless of prior list state
  const showEnrolled = listState === "enrolled" || status === "success";

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={sectionHeadStyle}>Sign-in</h2>

      {listState === "loading" && null}

      {listState !== "loading" && (
        <>
          {showEnrolled ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ms-ink)", margin: 0 }}>
                  Passkey active{enrolledCount > 1 ? ` (${enrolledCount})` : ""}
                </p>
                <p style={{ fontSize: 12, color: "var(--ms-dim)", margin: "3px 0 0" }}>
                  You can sign in with Face ID or fingerprint.
                </p>
              </div>
              {status !== "pending" && (
                <button onClick={handleEnroll} style={btnStyle(false)}>
                  Add another
                </button>
              )}
            </div>
          ) : status === "unsupported" ? (
            <p style={{ fontSize: 14, color: "var(--ms-dim)" }}>
              Your device doesn{"'"}t support passkeys.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 14, color: "var(--ms-dim)", marginBottom: 12, lineHeight: 1.5 }}>
                Sign in faster with Face ID or fingerprint — no password needed next time.
              </p>
              <button
                onClick={handleEnroll}
                disabled={status === "pending"}
                style={btnStyle(status === "pending")}
              >
                {status === "pending" ? "Setting up…" : "Set up passkey"}
              </button>
              {status === "error" && (
                <p style={{ fontSize: 12, color: "var(--ms-danger)", marginTop: 8 }}>
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
