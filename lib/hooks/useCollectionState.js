"use client";

import { useState, useEffect, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";
import { track, EVENTS } from "@/lib/track";

const STORAGE_KEY = "ms_anon_entries";

function loadFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  if (typeof window === "undefined") return;
  try {
    // Merge with the current blob so keys the hook doesn't own (e.g. setModes
    // written by setAnonEditionMode) are never clobbered by a save.
    let existing = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) existing = JSON.parse(raw) || {};
    } catch { /* ignore — start from empty if blob is corrupt */ }
    const merged = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("ms-anon-entries-changed", { detail: merged }));
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "QuotaExceededError")) {
      Sentry.captureException(err, { tags: { location: "useCollectionState-saveToStorage" } });
    }
  }
}

function upgradeLegacyShape(parsed) {
  // Old shape: { setId, entries: [...], startedAt }
  // New shape: { entries: [{ ..., setId }, ...], startedAt }
  if (parsed.setId && Array.isArray(parsed.entries)) {
    const upgraded = {
      entries: parsed.entries.map((e) => ({ ...e, setId: e.setId ?? parsed.setId })),
      startedAt: parsed.startedAt ?? new Date().toISOString(),
    };
    saveToStorage(upgraded);
    return upgraded;
  }
  return parsed;
}

const EMPTY = { entries: [], startedAt: null };

export function useCollectionState({ isAnonymous, setId, printingsMap }) {
  const [collection, setCollection] = useState(EMPTY);

  useEffect(() => {
    if (!isAnonymous) return;
    const stored = loadFromStorage();
    if (!stored) {
      setCollection(EMPTY);
      return;
    }
    // Validate minimum expected shape
    if (!Array.isArray(stored.entries)) {
      setCollection(EMPTY);
      return;
    }
    const upgraded = upgradeLegacyShape(stored);
    setCollection(upgraded);
  }, [isAnonymous]);

  useEffect(() => {
    if (!isAnonymous) return;
    if (collection === EMPTY) return;
    saveToStorage(collection);
  }, [isAnonymous, collection]);

  const addPrinting = useCallback(
    (printingId) => {
      if (!isAnonymous) return;
      const printing = printingsMap?.get(printingId);
      if (!printing) return;

      const cardNumber = printing.cardNumber ?? printing.card_number ?? printing.cards?.number;
      if (cardNumber == null) return;

      const priceUsd = printing.price_usd ?? null;

      // Capture post-update total inside the updater, fire track() after it
      // returns (keeps the updater free of side effects under strict-mode
      // double-invocation; track() is fire-and-forget).
      let postTotal = null;
      let shouldTrack = false;
      setCollection((prev) => {
        const existing = prev.entries.find((e) => e.printingId === printingId);
        if (existing) return prev;

        const next = {
          ...prev,
          entries: [
            ...prev.entries,
            { printingId, cardNumber, setId, quantity: 1, priceUsd, addedAt: new Date().toISOString() },
          ],
          startedAt: prev.startedAt ?? new Date().toISOString(),
        };
        shouldTrack = true;
        postTotal = next.entries.reduce((s, e) => s + e.quantity, 0);
        return next;
      });
      if (shouldTrack) {
        track(EVENTS.CARD_ADDED, {
          set_id: setId,
          printing_id: printingId,
          card_number: cardNumber,
          is_anonymous: true,
          total_count_after: postTotal,
        });
      }
    },
    [isAnonymous, setId, printingsMap]
  );

  const updateQuantity = useCallback(
    (printingId, newQty) => {
      if (!isAnonymous) return;

      // card_added fires only when quantity strictly increases (covers dup
      // increments and the new-entry path); never on decrement/removal.
      let postTotal = null;
      let shouldTrack = false;
      let trackCardNumber = null;
      let trackSetId = setId;
      setCollection((prev) => {
        if (newQty <= 0) {
          return { ...prev, entries: prev.entries.filter((e) => e.printingId !== printingId) };
        }

        const existing = prev.entries.find((e) => e.printingId === printingId);
        if (existing) {
          const next = {
            ...prev,
            entries: prev.entries.map((e) =>
              e.printingId === printingId ? { ...e, quantity: newQty } : e
            ),
          };
          if (newQty > existing.quantity) {
            shouldTrack = true;
            trackCardNumber = existing.cardNumber;
            trackSetId = existing.setId;
            postTotal = next.entries.reduce((s, e) => s + e.quantity, 0);
          }
          return next;
        }

        const printing = printingsMap?.get(printingId);
        if (!printing) return prev;
        const cardNumber = printing.cardNumber ?? printing.card_number ?? printing.cards?.number;
        if (cardNumber == null) return prev;
        const priceUsd = printing.price_usd ?? null;

        const next = {
          ...prev,
          entries: [
            ...prev.entries,
            { printingId, cardNumber, setId, quantity: newQty, priceUsd, addedAt: new Date().toISOString() },
          ],
          startedAt: prev.startedAt ?? new Date().toISOString(),
        };
        // New entry via updateQuantity — quantity rose from 0, an increase.
        shouldTrack = true;
        trackCardNumber = cardNumber;
        trackSetId = setId;
        postTotal = next.entries.reduce((s, e) => s + e.quantity, 0);
        return next;
      });
      if (shouldTrack) {
        track(EVENTS.CARD_ADDED, {
          set_id: trackSetId,
          printing_id: printingId,
          card_number: trackCardNumber,
          is_anonymous: true,
          total_count_after: postTotal,
        });
      }
    },
    [isAnonymous, setId, printingsMap]
  );

  const clearCollection = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setCollection(EMPTY);
  }, []);

  const currentSetEntries = collection.entries.filter((e) => e.setId === setId);

  const totalCount = collection.entries.reduce((s, e) => s + e.quantity, 0);
  const totalValueUsd = collection.entries.reduce(
    (s, e) => s + (e.priceUsd || 0) * e.quantity,
    0
  );

  return {
    entries: currentSetEntries,
    allEntries: collection.entries,
    addPrinting,
    updateQuantity,
    clearCollection,
    totalCount,
    totalValueUsd,
  };
}
