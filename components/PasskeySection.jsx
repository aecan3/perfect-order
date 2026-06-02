"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createPasskeyClient } from "@/lib/supabase";
import { usePasskeyEnrollment } from "@/lib/usePasskeyEnrollment";

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

// Bottom-sheet confirmation modal — matches BlockConfirmModal structure and styling.
function RemoveConfirmSheet({ passkey, onCancel, onConfirm, submitting, error }) {
  const sheetRef = useRef(null);
  const cancelRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [mounted]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    if (!sheetRef.current) return;
    const trapTab = (e) => {
      if (e.key !== "Tab") return;
      const nodes = sheetRef.current.querySelectorAll(
        "button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [mounted]);

  if (!mounted) return null;

  const name = passkey.friendly_name || "Passkey";

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
      onClick={onCancel}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Remove passkey"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111113",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 40px",
        }}
      >
        <div style={{
          width: 40, height: 4,
          background: "rgba(244,244,246,0.18)",
          borderRadius: 2,
          margin: "0 auto 20px",
        }} />

        <p style={{
          margin: "0 0 12px",
          fontSize: 16, fontWeight: 800,
          color: "rgba(244,244,246,0.9)",
          fontFamily: '"IBM Plex Sans", sans-serif',
        }}>
          Remove {name}?
        </p>

        <p style={{
          margin: "0 0 24px",
          fontSize: 14,
          color: "rgba(244,244,246,0.55)",
          fontFamily: '"IBM Plex Sans", sans-serif',
          lineHeight: 1.5,
        }}>
          You{"'"}ll need to set it up again to use Face ID sign-in on this device.
        </p>

        {error && (
          <div style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "rgba(220,38,38,0.12)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 8,
            fontSize: 13, color: "#fca5a5",
            fontFamily: '"IBM Plex Sans", sans-serif',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={submitting}
            style={{
              flex: 1, padding: "14px",
              background: "transparent",
              border: "1px solid rgba(244,244,246,0.14)",
              borderRadius: 10,
              color: "rgba(244,244,246,0.55)",
              fontSize: 15, fontFamily: '"IBM Plex Sans", sans-serif',
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{
              flex: 1, padding: "14px",
              background: submitting ? "rgba(220,38,38,0.2)" : "rgba(220,38,38,0.85)",
              color: submitting ? "rgba(252,165,165,0.5)" : "#fff",
              border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 800,
              fontFamily: '"IBM Plex Sans", sans-serif',
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {submitting ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PasskeySection() {
  // null = loading, [] = loaded empty, [...] = loaded with passkeys
  const [passkeys, setPasskeys] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const { status, errorMessage, enroll } = usePasskeyEnrollment();

  async function loadPasskeys() {
    const supabase = createPasskeyClient();
    const { data, error } = await supabase.auth.passkey.list();
    setPasskeys(!error && Array.isArray(data) ? data : []);
  }

  useEffect(() => { loadPasskeys(); }, []);

  async function handleEnroll() {
    const ok = await enroll();
    if (ok) await loadPasskeys();
  }

  function handleRemoveClick(passkey) {
    setDeleteError(null);
    setRemoveTarget(passkey);
  }

  async function handleRemoveConfirm() {
    if (!removeTarget || deletingId) return;
    setDeletingId(removeTarget.id);
    setDeleteError(null);
    const supabase = createPasskeyClient();
    const { error } = await supabase.auth.passkey.delete({ passkeyId: removeTarget.id });
    if (error) {
      setDeleteError("Couldn't remove passkey. Try again.");
      setDeletingId(null);
      return;
    }
    setDeletingId(null);
    setRemoveTarget(null);
    await loadPasskeys();
  }

  const isLoading = passkeys === null;
  const isEnrolled = Array.isArray(passkeys) && passkeys.length > 0;
  const enrollmentBusy = status === "pending";

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={sectionHeadStyle}>Sign-in</h2>

      {isLoading && null}

      {!isLoading && (
        <>
          {isEnrolled ? (
            <>
              {/* Per-passkey rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {passkeys.map((pk, i) => (
                  <div
                    key={pk.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 0",
                      borderBottom: i < passkeys.length - 1
                        ? "1px solid var(--ms-rule)"
                        : "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--ms-ink)",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {pk.friendly_name || "Passkey"}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--ms-dim)", margin: "2px 0 0" }}>
                        Added {fmtDate(pk.created_at)}
                      </p>
                      {pk.last_used_at && (
                        <p style={{ fontSize: 12, color: "var(--ms-dim)", margin: "1px 0 0" }}>
                          Last used {fmtDate(pk.last_used_at)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveClick(pk)}
                      disabled={deletingId === pk.id || enrollmentBusy}
                      style={{
                        padding: "6px 12px",
                        background: "transparent",
                        border: "1px solid rgba(220,38,38,0.35)",
                        borderRadius: 8,
                        color: deletingId === pk.id ? "rgba(252,165,165,0.4)" : "rgba(252,165,165,0.85)",
                        fontSize: 13,
                        fontFamily: '"IBM Plex Sans", sans-serif',
                        cursor: deletingId === pk.id || enrollmentBusy ? "default" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {deletingId === pk.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Add another — below the list */}
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={handleEnroll}
                  disabled={enrollmentBusy || !!deletingId}
                  style={btnStyle(enrollmentBusy || !!deletingId)}
                >
                  {enrollmentBusy ? "Setting up…" : "Add another"}
                </button>
              </div>
            </>
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
                disabled={enrollmentBusy}
                style={btnStyle(enrollmentBusy)}
              >
                {enrollmentBusy ? "Setting up…" : "Set up passkey"}
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

      {/* Confirmation sheet — only rendered when a remove is pending */}
      {removeTarget && (
        <RemoveConfirmSheet
          passkey={removeTarget}
          onCancel={() => { setRemoveTarget(null); setDeleteError(null); }}
          onConfirm={handleRemoveConfirm}
          submitting={!!deletingId}
          error={deleteError}
        />
      )}
    </section>
  );
}
