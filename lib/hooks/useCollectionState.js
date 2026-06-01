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

const EMPTY = { setId: null, entries: [], startedAt: null };

/**
 * Anonymous-only collection state backed by localStorage.
 * Pass isAnonymous=false to get a no-op instance (authenticated path
 * continues to use Supabase directly — this hook owns nothing in that mode).
 */
export function useCollectionState({ isAnonymous, setId, printingsMap }) {
  const [collection, setCollection] = useState(EMPTY);

  // Load from localStorage on mount (anonymous only)
  useEffect(() => {
    if (!isAnonymous) return;
    const stored = loadFromStorage();
    if (stored) {
      setCollection(stored);
    } else {
      setCollection(EMPTY);
    }
  }, [isAnonymous]);

  // Persist whenever collection changes
  useEffect(() => {
    if (!isAnonymous) return;
    if (collection === EMPTY) return;
    saveToStorage(collection);
  }, [isAnonymous, collection]);

  const addPrinting = useCallback(
    (printingId) => {
      if (!isAnonymous) return;
      const printing = printingsMap?.get(printingId);
      if (!printing) return; // no card_number or price — skip invalid entry

      const cardNumber = printing.cardNumber ?? printing.card_number ?? printing.cards?.number;
      if (cardNumber == null) return;

      const priceUsd = printing.price_usd ?? null;

      setCollection((prev) => {
        const existing = prev.entries.find((e) => e.printingId === printingId);
        if (existing) return prev; // already tracked — no-op (use updateQuantity to change)

        const newEntries = [
          ...prev.entries,
          { printingId, cardNumber, quantity: 1, priceUsd, addedAt: new Date().toISOString() },
        ];
        return {
          setId: setId ?? prev.setId,
          entries: newEntries,
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
          const newEntries = prev.entries.filter((e) => e.printingId !== printingId);
          return { ...prev, entries: newEntries };
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

        // Entry doesn't exist yet — create it (need printingsMap for card_number)
        const printing = printingsMap?.get(printingId);
        if (!printing) return prev;
        const cardNumber = printing.cardNumber ?? printing.card_number ?? printing.cards?.number;
        if (cardNumber == null) return prev;
        const priceUsd = printing.price_usd ?? null;

        return {
          setId: setId ?? prev.setId,
          entries: [
            ...prev.entries,
            { printingId, cardNumber, quantity: newQty, priceUsd, addedAt: new Date().toISOString() },
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

  const totalCount = collection.entries.reduce((s, e) => s + e.quantity, 0);
  const totalValueUsd = collection.entries.reduce(
    (s, e) => s + (e.priceUsd || 0) * e.quantity,
    0
  );

  return {
    collection,
    addPrinting,
    updateQuantity,
    clearCollection,
    totalCount,
    totalValueUsd,
  };
}
