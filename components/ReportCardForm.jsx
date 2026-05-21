"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";

const CATEGORIES = [
  { label: "Wrong image",            value: "wrong_image"            },
  { label: "Wrong name or number",   value: "wrong_name_or_number"   },
  { label: "Wrong rarity",           value: "wrong_rarity"           },
  { label: "Wrong price",            value: "wrong_price"            },
  { label: "Missing card or variant",value: "missing_card_or_variant"},
  { label: "Other",                  value: "other"                  },
];

const DETAILS_WARN = 1000;
const DETAILS_MAX  = 2000;

export function ReportCardForm({ isOpen, onClose, onSuccess }) {
  const [mounted, setMounted]       = useState(false);
  const [category, setCategory]     = useState("");
  const [details, setDetails]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const sheetRef   = useRef(null);
  const selectRef  = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // Reset form whenever sheet closes
  useEffect(() => {
    if (!isOpen) {
      setCategory("");
      setDetails("");
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  // Focus category dropdown on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => selectRef.current?.focus());
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
        "button:not([disabled]), select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [isOpen]);

  const canSubmit = category !== "" && details.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from("card_reports").insert({
        reporter_id: user.id,
        category,
        details: details.trim(),
      });
      if (insertErr) throw insertErr;
      onSuccess();
    } catch {
      setSubmitting(false);
      setError("Couldn't send your report. Please try again.");
    }
  };

  if (!mounted || !isOpen) return null;

  const detailsOver = details.length > DETAILS_WARN;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report a card issue"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111113",
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px 40px",
          maxHeight: "80vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* drag handle */}
        <div style={{
          width: 40, height: 4,
          background: "rgba(244,244,246,0.18)",
          borderRadius: 2,
          margin: "0 auto 20px",
        }} />

        {/* title */}
        <p style={{
          margin: "0 0 20px",
          fontSize: 16,
          fontWeight: 800,
          color: "rgba(244,244,246,0.9)",
          fontFamily: '"IBM Plex Sans", sans-serif',
        }}>
          Report a card issue
        </p>

        {/* category */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="rcf-category"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(244,244,246,0.55)",
              fontFamily: '"IBM Plex Mono", monospace',
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            CATEGORY
          </label>
          <select
            id="rcf-category"
            ref={selectRef}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              background: "rgba(244,244,246,0.06)",
              border: "1px solid rgba(244,244,246,0.14)",
              borderRadius: 10,
              color: category ? "rgba(244,244,246,0.9)" : "rgba(244,244,246,0.38)",
              fontSize: 15,
              fontFamily: '"IBM Plex Sans", sans-serif',
              cursor: "pointer",
            }}
          >
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* details */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="rcf-details"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(244,244,246,0.55)",
              fontFamily: '"IBM Plex Mono", monospace',
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            DETAILS
          </label>
          <textarea
            id="rcf-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={DETAILS_MAX}
            placeholder="Which card and what&#39;s wrong with it? The more detail the better."
            className="placeholder:text-[rgba(244,244,246,0.35)]"
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 120,
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
              textAlign: "right",
              marginTop: 4,
              fontSize: 11,
              fontFamily: '"IBM Plex Mono", monospace',
              color: details.length > 1800 ? "#f59e0b" : "rgba(244,244,246,0.38)",
            }}>
              {details.length}/{DETAILS_MAX}
            </div>
          )}
        </div>

        {/* inline error */}
        {error && (
          <div style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "rgba(220,38,38,0.12)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "#fca5a5",
            fontFamily: '"IBM Plex Sans", sans-serif',
          }}>
            {error}
          </div>
        )}

        {/* actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "14px",
              background: "transparent",
              border: "1px solid rgba(244,244,246,0.14)",
              borderRadius: 10,
              color: "rgba(244,244,246,0.55)",
              fontSize: 15,
              fontFamily: '"IBM Plex Sans", sans-serif',
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
              flex: 1,
              padding: "14px",
              background: canSubmit ? "#c8ff4a" : "rgba(200,255,74,0.15)",
              border: "none",
              borderRadius: 10,
              color: canSubmit ? "#000" : "rgba(200,255,74,0.35)",
              fontSize: 15,
              fontWeight: 800,
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
  );
}
