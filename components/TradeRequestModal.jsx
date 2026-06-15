"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, Send, Loader2 } from "lucide-react";
import { CardHero } from "@/components/CardHero";

// TradeRequestModal — centred dialog shown over /sets after a trade-invite signup/
// signin. Variant A (alreadyFriends=false): friend request + message. Variant C
// (true): message only. Self-contained focus-trap + ESC + scroll-lock + return-focus
// (pattern copied from ReportUserForm). Tokens only; NO amber (--ms-gold reserved).
//
// Props: card { name, setName, number, imageUrl }, owner { id, handle, displayName,
// avatarUrl }, alreadyFriends, onSend(message) [async; throws on failure],
// onDismiss(), onViewProfile().

const SANS = '"IBM Plex Sans", sans-serif';
const MONO = '"IBM Plex Mono", monospace';

// Prefill matches the app's existing message-intent template (straight quotes per
// the project encoding rule; the carried sub-type just picks tone — default here).
function defaultMessage(cardName) {
  const n = cardName || "this card";
  return `Hi! I'd love to chat about your "${n}". Are you open to a trade or sale?`;
}

export function TradeRequestModal({ card, owner, alreadyFriends, onSend, onDismiss, onViewProfile }) {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState(() => defaultMessage(card?.name));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);

  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // Capture the trigger to restore focus on close; lock body scroll; focus the field.
  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      try { returnFocusRef.current?.focus?.(); } catch (e) { /* ignore */ }
    };
  }, []);

  // ESC dismisses (not mid-send).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !sending) onDismiss?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sending, onDismiss]);

  // Focus trap (copied from ReportUserForm).
  useEffect(() => {
    if (!panelRef.current) return;
    const trapTab = (e) => {
      if (e.key !== "Tab") return;
      const nodes = panelRef.current.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
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
  }, []);

  const handleSend = async () => {
    if (sending || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSend(message.trim());
      // On success the parent dismisses + toasts; nothing more to do here.
    } catch (e) {
      setSending(false);
      setError(e?.message || "Couldn't send. Please try again.");
    }
  };

  if (!mounted) return null;

  const ctaLabel = alreadyFriends ? "Send message" : "Send friend request & message";
  const CtaIcon = alreadyFriends ? Send : UserPlus;
  const disabled = sending || !message.trim();

  return createPortal(
    <div
      onClick={() => { if (!sending) onDismiss?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trm-heading"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%", maxWidth: 340,
          maxHeight: "90vh", overflowY: "auto",
          background: "var(--po-bg-soft)",
          border: "1px solid var(--po-border-strong)",
          borderRadius: 16,
          padding: "22px 20px 18px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Dismiss */}
        <button
          onClick={() => { if (!sending) onDismiss?.(); }}
          aria-label="Close"
          style={{
            position: "absolute", top: 12, right: 12,
            background: "none", border: "none",
            color: "var(--po-text-faint)", cursor: "pointer",
            padding: 4, lineHeight: 1,
          }}
        >
          <X size={18} />
        </button>

        {/* Card hero */}
        <CardHero imageUrl={card?.imageUrl} name={card?.name} />

        {/* Card meta */}
        <h2
          id="trm-heading"
          style={{ margin: "0 0 2px", textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 17, lineHeight: 1.25, color: "var(--po-text)" }}
        >
          {card?.name || "Card"}
        </h2>
        <p style={{ margin: "0 0 16px", textAlign: "center", fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: "var(--po-text-dim)" }}>
          {[card?.setName, card?.number].filter(Boolean).join(" · ")}
        </p>

        {/* Owner attribution row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
              background: "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {owner?.avatarUrl ? (
              <img src={owner.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, color: "var(--po-text-dim)" }}>
                {(owner?.handle || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: 13, color: "var(--po-text-dim)" }}>
            <span style={{ color: "var(--po-green)", fontWeight: 700 }}>@{owner?.handle}</span>'s card
          </div>
          <button
            onClick={onViewProfile}
            style={{
              flexShrink: 0, fontFamily: SANS, fontSize: 12, fontWeight: 600,
              padding: "6px 12px", background: "transparent",
              border: "1px solid var(--po-border-strong)", borderRadius: 8,
              color: "var(--po-text)", cursor: "pointer",
            }}
          >
            View profile
          </button>
        </div>

        {/* Message */}
        <label htmlFor="trm-message" style={{ display: "block", fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: "var(--po-text-dim)", marginBottom: 8 }}>
          ADD A MESSAGE
        </label>
        <textarea
          id="trm-message"
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={sending}
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box", minHeight: 92, padding: "12px 14px",
            background: "rgba(244,244,246,0.06)",
            border: `1px solid ${focused ? "var(--po-green)" : "var(--po-border-strong)"}`,
            boxShadow: focused ? "0 0 0 3px rgba(200,255,74,0.18)" : "none",
            borderRadius: 10, color: "var(--po-text)", fontSize: 14, fontFamily: SANS,
            resize: "none", outline: "none",
            transition: "border-color 0.12s, box-shadow 0.12s",
          }}
        />

        {/* CTA */}
        <button
          onClick={handleSend}
          disabled={disabled}
          aria-busy={sending}
          style={{
            width: "100%", marginTop: 14, padding: "13px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: disabled ? "rgba(200,255,74,0.2)" : "var(--po-green)",
            color: disabled ? "rgba(200,255,74,0.5)" : "var(--ms-accent-ink)",
            border: "none", borderRadius: 10,
            fontFamily: SANS, fontWeight: 800, fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <CtaIcon size={16} strokeWidth={2.5} />
              {ctaLabel}
            </>
          )}
        </button>

        {/* Inline error */}
        {error && (
          <p role="alert" style={{ margin: "10px 0 0", textAlign: "center", fontFamily: SANS, fontSize: 12.5, color: "var(--ms-danger)" }}>
            {error}
          </p>
        )}

        {/* Not now */}
        <button
          onClick={() => { if (!sending) onDismiss?.(); }}
          disabled={sending}
          style={{
            width: "100%", marginTop: 10, padding: 8,
            background: "none", border: "none",
            color: "var(--po-text-dim)", fontFamily: SANS, fontSize: 13,
            cursor: sending ? "not-allowed" : "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>,
    document.body
  );
}
