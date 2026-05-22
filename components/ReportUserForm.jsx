"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";

const REASONS = [
  { label: "Harassment",            value: "harassment"   },
  { label: "Scam or fraud",         value: "scam_fraud"   },
  { label: "Fake cards",            value: "fake_cards"   },
  { label: "Inappropriate content", value: "inappropriate" },
  { label: "Other",                 value: "other"        },
];

const DETAILS_WARN = 1000;
const DETAILS_MAX  = 2000;

const TOAST_BOTTOM = "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)";

export function ReportUserForm({ isOpen, onClose, reportedUserId, reportedUserHandle, context }) {
  const [mounted, setMounted]       = useState(false);
  const [reason, setReason]         = useState("");
  const [details, setDetails]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [showToast, setShowToast]   = useState(false);

  const sheetRef    = useRef(null);
  const firstRadio  = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // Reset form whenever sheet closes
  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setDetails("");
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  // Focus first reason radio on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => firstRadio.current?.focus());
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !sheetRef.current) return;
    const trapTab = (e) => {
      if (e.key !== "Tab") return;
      const nodes = sheetRef.current.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [isOpen]);

  const isOther   = reason === "other";
  const canSubmit = reason !== "" && (!isOther || details.trim().length > 0) && !submitting;
  const detailsOver = details.length > DETAILS_WARN;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from("user_reports").insert({
        reporter_id:      user.id,
        reported_user_id: reportedUserId,
        reason,
        details:          details.trim() || null,
        context,
      });
      if (insertErr) throw insertErr;
      // Success: close sheet (triggers form reset), show toast
      onClose();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch {
      setSubmitting(false);
      setError("Couldn't send your report. Please try again.");
    }
  };

  // Toast renders independently of isOpen so it persists after sheet closes
  const toast = showToast && mounted && createPortal(
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: TOAST_BOTTOM,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "rgba(30,30,34,0.97)",
        border: "1px solid rgba(244,244,246,0.12)",
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 14,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: "rgba(244,244,246,0.9)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      Thanks — we'll review this report.
    </div>,
    document.body
  );

  if (!mounted || !isOpen) return toast ?? null;

  return (
    <>
      {createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}
          onClick={onClose}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Report @${reportedUserHandle}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111113",
              borderRadius: "16px 16px 0 0",
              padding: "20px 20px 40px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {/* Drag handle */}
            <div style={{
              width: 40, height: 4,
              background: "rgba(244,244,246,0.18)",
              borderRadius: 2,
              margin: "0 auto 20px",
            }} />

            {/* Title */}
            <p style={{
              margin: "0 0 20px",
              fontSize: 16, fontWeight: 800,
              color: "rgba(244,244,246,0.9)",
              fontFamily: '"IBM Plex Sans", sans-serif',
            }}>
              Report @{reportedUserHandle}
            </p>

            {/* Reason — radio rows */}
            <div style={{ marginBottom: 20 }}>
              <p style={{
                margin: "0 0 10px",
                fontSize: 12, fontWeight: 700,
                color: "rgba(244,244,246,0.55)",
                fontFamily: '"IBM Plex Mono", monospace',
                letterSpacing: "0.06em",
              }}>
                REASON
              </p>
              <div role="radiogroup" aria-label="Reason for report" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {REASONS.map(({ label, value }, i) => {
                  const selected = reason === value;
                  return (
                    <label
                      key={value}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "13px 14px",
                        background: selected ? "rgba(200,255,74,0.08)" : "rgba(244,244,246,0.04)",
                        border: `1px solid ${selected ? "rgba(200,255,74,0.3)" : "rgba(244,244,246,0.1)"}`,
                        borderRadius: 10,
                        cursor: "pointer",
                        transition: "background 0.12s, border-color 0.12s",
                      }}
                    >
                      <input
                        ref={i === 0 ? firstRadio : undefined}
                        type="radio"
                        name="report-reason"
                        value={value}
                        checked={selected}
                        onChange={() => setReason(value)}
                        style={{ accentColor: "#c8ff4a", width: 17, height: 17, flexShrink: 0, cursor: "pointer" }}
                      />
                      <span style={{
                        fontSize: 15,
                        fontFamily: '"IBM Plex Sans", sans-serif',
                        color: selected ? "rgba(244,244,246,0.95)" : "rgba(244,244,246,0.7)",
                      }}>
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Details textarea — always visible */}
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="ruf-details"
                style={{
                  display: "block",
                  fontSize: 12, fontWeight: 700,
                  color: "rgba(244,244,246,0.55)",
                  fontFamily: '"IBM Plex Mono", monospace',
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                ADDITIONAL DETAILS{!isOther && <span style={{ fontWeight: 400, opacity: 0.7 }}> (OPTIONAL)</span>}
              </label>
              <textarea
                id="ruf-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={DETAILS_MAX}
                placeholder={isOther ? "Please describe the issue" : "Anything else we should know?"}
                className="placeholder:text-[rgba(244,244,246,0.35)]"
                style={{
                  width: "100%", boxSizing: "border-box",
                  minHeight: 100,
                  padding: "12px 14px",
                  background: "rgba(244,244,246,0.06)",
                  border: "1px solid rgba(244,244,246,0.14)",
                  borderRadius: 10,
                  color: "rgba(244,244,246,0.9)",
                  fontSize: 15,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  resize: "none",
                }}
              />
              {detailsOver && (
                <div style={{
                  textAlign: "right", marginTop: 4,
                  fontSize: 11,
                  fontFamily: '"IBM Plex Mono", monospace',
                  color: details.length > 1800 ? "#f59e0b" : "rgba(244,244,246,0.38)",
                }}>
                  {details.length}/{DETAILS_MAX}
                </div>
              )}
            </div>

            {/* Inline error */}
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

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "14px",
                  background: "transparent",
                  border: "1px solid rgba(244,244,246,0.14)",
                  borderRadius: 10,
                  color: "rgba(244,244,246,0.55)",
                  fontSize: 15, fontFamily: '"IBM Plex Sans", sans-serif',
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                style={{
                  flex: 1, padding: "14px",
                  background: canSubmit ? "#c8ff4a" : "rgba(200,255,74,0.15)",
                  border: "none", borderRadius: 10,
                  color: canSubmit ? "#000" : "rgba(200,255,74,0.35)",
                  fontSize: 15, fontWeight: 800,
                  fontFamily: '"IBM Plex Sans", sans-serif',
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {submitting ? "Sending…" : "Submit"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {toast}
    </>
  );
}
