"use client";

import { useState, useEffect, useCallback } from "react";

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("ms-anon-entries-changed", { detail: data }));
  } catch {
    // localStorage quota exceeded — silently skip
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

      setCollection((prev) => {
        const existing = prev.entries.find((e) => e.printingId === printingId);
        if (existing) return prev;

        return {
          ...prev,
          entries: [
            ...prev.entries,
            { printingId, cardNumber, setId, quantity: 1, priceUsd, addedAt: new Date().toISOString() },
          ],
          startedAt: prev.startedAt ?? new Date().toISOString(),
        };
      });
    },
    [isAnonymous, setId, printingsMap]
  );

  const updateQuantity = useCallback(
    (printingId, newQty) => {
      if (!isAnonymous) return;

      setCollection((prev) => {
        if (newQty <= 0) {
          return { ...prev, entries: prev.entries.filter((e) => e.printingId !== printingId) };
        }

        const existing = prev.entries.find((e) => e.printingId === printingId);
        if (existing) {
          return {
            ...prev,
            entries: prev.entries.map((e) =>
              e.printingId === printingId ? { ...e, quantity: newQty } : e
            ),
          };
        }

        const printing = printingsMap?.get(printingId);
        if (!printing) return prev;
        const cardNumber = printing.cardNumber ?? printing.card_number ?? printing.cards?.number;
        if (cardNumber == null) return prev;
        const priceUsd = printing.price_usd ?? null;

        return {
          ...prev,
          entries: [
            ...prev.entries,
            { printingId, cardNumber, setId, quantity: newQty, priceUsd, addedAt: new Date().toISOString() },
          ],
          startedAt: prev.startedAt ?? new Date().toISOString(),
        };
      });
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
