"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, X } from "lucide-react";

export function OverflowMenu({ targetHandle, items }) {
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);
  const sheetRef              = useRef(null);
  const triggerRef            = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus trap within the sheet
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const trapTab = (e) => {
      if (e.key !== "Tab") return;
      const nodes = sheetRef.current.querySelectorAll(
        "button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
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
  }, [open]);

  // Focus first item row when sheet opens
  useEffect(() => {
    if (open && sheetRef.current) {
      requestAnimationFrame(() => {
        const first = sheetRef.current?.querySelector("button[data-item]");
        first?.focus();
      });
    }
  }, [open]);

  // Return focus to trigger when sheet closes
  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  const sheet = open && mounted && createPortal(
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-end",
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for @${targetHandle}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 448, margin: "0 auto",
          background: "var(--po-bg-soft)",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--po-border)" }} />
        </div>

        {/* Sheet header — confirms who the actions apply to */}
        <div style={{
          padding: "10px 20px 14px",
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 12,
          color: "var(--po-text-dim)",
          letterSpacing: "0.08em",
          borderBottom: "1px solid var(--po-border)",
        }}>
          @{targetHandle}
        </div>

        {/* Action rows */}
        {items.map(({ icon: Icon, label, onClick, destructive }) => (
          <button
            key={label}
            data-item
            onClick={() => { setOpen(false); onClick(); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14,
              padding: "16px 20px",
              background: "none", border: "none", cursor: "pointer",
              color: destructive ? "#f87171" : "var(--po-text)",
              fontSize: 16, fontFamily: '"IBM Plex Sans", sans-serif',
              borderBottom: "1px solid var(--po-border)",
              textAlign: "left",
            }}
          >
            {Icon && <Icon size={20} aria-hidden="true" />}
            {label}
          </button>
        ))}

        {/* Cancel row */}
        <button
          onClick={() => setOpen(false)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px 20px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--po-text-dim)",
            fontSize: 16, fontFamily: '"IBM Plex Sans", sans-serif',
          }}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label="More options"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 6,
          color: "var(--po-text-dim)", display: "flex", alignItems: "center",
        }}
      >
        <MoreVertical size={20} />
      </button>
      {sheet}
    </>
  );
}
