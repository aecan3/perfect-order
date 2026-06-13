"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { FindOnline } from "@/components/FindOnline";
import { track, EVENTS } from "@/lib/track";

function fmtPrice(priceUsd) {
  const val = Number(priceUsd) * 1.53;
  if (!priceUsd || val <= 0) return null;
  return `A$${val < 10 ? val.toFixed(2) : Math.round(val)}`;
}

export function WantListView({ initialCards, isOwner, listId, slug, initialTitle, ownerName, ownerHandle, dateStr }) {
  const supabase = createClient();
  const [cards, setCards] = useState(initialCards);
  const [title, setTitle] = useState(initialTitle);
  const [renaming, setRenaming] = useState(false);
  const [titleInput, setTitleInput] = useState(initialTitle || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  // want_list_viewed — fire once on mount. Relationship is known synchronously
  // here (isOwner is a server-computed prop), so no resolve-wait needed.
  const viewedFiredRef = useRef(false);
  useEffect(() => {
    if (viewedFiredRef.current) return;
    viewedFiredRef.current = true;
    track(EVENTS.WANT_LIST_VIEWED, {
      slug,
      list_owner_handle: ownerHandle ?? null,
      viewer_is_owner: isOwner,
    });
  }, []);

  const heading = title || `${ownerName}'s Want List`;
  const subheading = title
    ? `by ${ownerName} · ${dateStr}`
    : `${cards.length} missing card${cards.length !== 1 ? "s" : ""} · ${dateStr}`;

  const removeCard = async (cardId) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
    await supabase.from("want_list_cards").delete().eq("id", cardId);
  };

  const startRename = () => {
    setTitleInput(title || "");
    setRenaming(true);
  };

  const saveRename = async () => {
    const trimmed = titleInput.trim() || null;
    setTitle(trimmed);
    setRenaming(false);
    await supabase.from("want_lists").update({ title: trimmed }).eq("id", listId);
  };

  const cancelRename = () => {
    setRenaming(false);
  };

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        {renaming ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <input
              ref={inputRef}
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              maxLength={50}
              placeholder={`${ownerName}'s Want List`}
              onKeyDown={e => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") cancelRename();
              }}
              style={{
                flex: 1, fontSize: 20, fontWeight: 800, color: "var(--po-text)",
                background: "rgba(244,244,246,0.06)",
                border: "1px solid rgba(200,255,74,0.4)",
                borderRadius: 8, padding: "4px 8px", outline: "none",
              }}
            />
            <button
              onClick={saveRename}
              style={{
                padding: "6px 12px",
                background: "var(--po-green)", border: "none",
                borderRadius: 6, color: "#050507",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              onClick={cancelRename}
              style={{
                padding: "6px 10px",
                background: "rgba(244,244,246,0.06)",
                border: "0.5px solid var(--po-border)",
                borderRadius: 6, color: "var(--po-text-dim)",
                fontSize: 16, lineHeight: 1, cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 800,
              color: "var(--po-text)", lineHeight: 1.2,
              flex: 1, margin: 0,
            }}>
              {heading}
            </h1>
            {isOwner && (
              <button
                onClick={startRename}
                style={{
                  background: "none", border: "none",
                  padding: "4px", cursor: "pointer",
                  color: "var(--po-text-dim)", flexShrink: 0, marginTop: 3,
                }}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
        <p style={{ fontSize: 13, color: "var(--po-text-dim)", margin: 0 }}>
          {subheading}
        </p>
        {isOwner && (
          <Link
            href={`/want-lists/new?addTo=${slug}`}
            style={{
              display: "inline-block", marginTop: 10,
              padding: "5px 12px",
              background: "rgba(200,255,74,0.06)",
              border: "0.5px solid rgba(200,255,74,0.2)",
              borderRadius: 6,
              color: "var(--po-green)", fontSize: 12, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            + Add cards
          </Link>
        )}
      </div>

      {/* Card grid */}
      {cards.length === 0 ? (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--po-text-dim)", fontSize: 14 }}>
          No cards in this list.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {cards.map(card => {
            const price = fmtPrice(card.price_usd);
            return (
              <div
                key={card.id}
                style={{
                  position: "relative",
                  borderRadius: "var(--border-radius-md)",
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.4)",
                  aspectRatio: "2.5/3.5",
                }}
              >
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.card_name || `#${card.card_number}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 8, textAlign: "center",
                    fontSize: 8, color: "var(--po-text-faint)", lineHeight: 1.3,
                  }}>
                    {card.card_name || `#${card.card_number}`}
                  </div>
                )}

                <FindOnline
                  cardName={card.card_name || `#${card.card_number}`}
                  collectorNumber={String(card.card_number)}
                  userCountry="AU"
                />

                {/* Bottom overlay */}
                <div style={{
                  position: "absolute", inset: "auto 0 0",
                  padding: "28px 6px 6px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "var(--po-green)", marginBottom: 1, lineHeight: 1.2 }}>
                    {card.edition_label}
                  </div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.5)" }}>
                    #{card.card_number}
                  </div>
                  {price && (
                    <div style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                      {price}
                    </div>
                  )}
                </div>

                {/* Remove button — owner only */}
                {isOwner && (
                  <button
                    onClick={() => removeCard(card.id)}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      width: 24, height: 24,
                      background: "rgba(0,0,0,0.65)",
                      backdropFilter: "blur(4px)",
                      border: "none", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    <X size={12} style={{ color: "#fff" }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
