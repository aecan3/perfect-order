"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "ms_edition_explainer_seen";

export function hasSeenEditionExplainer() {
  try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
}

export function markEditionExplainerSeen() {
  try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
}

/**
 * One-time bottom sheet explaining the edition switcher.
 * - blockerOpen: pass true whenever AnonymousCollectionBlocker is open;
 *   the sheet defers (stays hidden) while any blocking modal is up.
 * - editionOptions: array from getEditionOptions() — drives the data-driven copy.
 * - show: caller controls whether this set qualifies (getEditionOptions().length >= 2).
 */
export function EditionExplainerSheet({ show, editionOptions = [], blockerOpen = false }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!show) return;
    if (hasSeenEditionExplainer()) return;
    if (blockerOpen) return;
    setVisible(true);
  }, [mounted, show, blockerOpen]);

  // If the blocker opens while the sheet is showing, dismiss the sheet.
  useEffect(() => {
    if (blockerOpen && visible) setVisible(false);
  }, [blockerOpen, visible]);

  const dismiss = () => {
    markEditionExplainerSeen();
    setVisible(false);
  };

  if (!visible || !mounted) return null;

  const LABELS = {
    first_edition: "1st Edition",
    shadowless: "Shadowless",
    unlimited: "Unlimited",
  };
  const editionList = editionOptions
    .map((e) => LABELS[e] || e)
    .join(", ");

  return createPortal(
    <>
      <div
        onClick={() => setVisible(false)}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 190,
        }}
      />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "var(--po-bg)",
          border: "0.5px solid rgba(244,244,246,0.15)",
          borderRadius: "var(--border-radius-md) var(--border-radius-md) 0 0",
          padding: "20px 20px 32px",
          zIndex: 191,
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: "var(--po-text)",
          margin: "0 0 8px", lineHeight: 1.3,
        }}>
          Edition switcher
        </h2>
        <p style={{
          fontSize: 14, color: "var(--po-text-dim)",
          margin: "0 0 20px", lineHeight: 1.6,
        }}>
          This set was printed in{" "}
          <span style={{ color: "var(--po-text)", fontWeight: 600 }}>{editionList}</span>.
          Use the edition switcher to view and collect a specific edition — or stay on Any
          to count each card once, whichever edition you own.
        </p>
        <button
          onClick={dismiss}
          style={{
            width: "100%", padding: 13,
            background: "var(--po-green)", color: "#050507",
            border: "none", borderRadius: "var(--border-radius-md)",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </>,
    document.body
  );
}
