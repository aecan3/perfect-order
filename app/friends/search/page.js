"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import BackButton from "@/components/BackButton";

function FriendsSearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState(null); // null = not yet searched
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const runSearch = async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(trimmed)}&limit=50`);
      if (!res.ok) throw new Error("Search failed");
      const { results: list } = await res.json();
      setResults(list || []);
    } catch {
      setError("Something went wrong. Try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Run search immediately on mount if q param provided
  useEffect(() => {
    if (initialQ.trim()) {
      runSearch(initialQ);
    }
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.replace(`/friends/search?q=${encodeURIComponent(q)}`, { scroll: false });
    runSearch(q);
  };

  const statusLabel = (s) => {
    if (s.friendship_status === "friends") return { text: "Friends", color: "var(--po-green)" };
    if (s.friendship_status === "pending_received") return { text: "Wants to add you", color: "var(--po-text-dim)" };
    return null;
  };

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3 flex items-center gap-3">
        <BackButton href="/friends" />
        <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by handle or name"
            className="flex-1 px-3 py-1.5 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg text-sm focus:outline-none focus:border-[var(--po-green)] placeholder:text-[var(--po-text-dim)]"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="px-4 py-1.5 bg-[var(--po-green)] text-black rounded-lg font-bold uppercase tracking-widest text-xs disabled:opacity-50 flex-shrink-0"
          >
            {loading ? "…" : "Search"}
          </button>
        </form>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {error && (
          <p className="text-sm text-rose-300 mb-4">{error}</p>
        )}

        {results === null && !loading && (
          <p className="text-sm text-[var(--po-text-dim)]">
            Search for people by handle or name.
          </p>
        )}

        {results !== null && results.length === 0 && !loading && (
          <p className="text-sm text-[var(--po-text-dim)]">No users found for &ldquo;{query}&rdquo;.</p>
        )}

        {results !== null && results.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mb-3">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            {results.map((s) => {
              const label = statusLabel(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => router.push(`/friend/${s.handle}`)}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg hover:border-[var(--po-green)] transition-colors"
                >
                  <Avatar profile={s} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{s.display_name || s.handle}</div>
                    <div className="text-xs text-[var(--po-text-dim)]">@{s.handle}</div>
                  </div>
                  {label && (
                    <span
                      className="text-[10px] uppercase tracking-widest flex-shrink-0"
                      style={{ color: label.color }}
                    >
                      {label.text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function FriendsSearchPage() {
  return (
    <Suspense>
      <FriendsSearchInner />
    </Suspense>
  );
}
