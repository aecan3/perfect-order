"use client";

// Public-domain AU localities dataset (ABS/GNAF-derived).
// Loaded once and cached in module scope — subsequent renders pay no cost.
import { useState, useEffect, useRef, useCallback } from "react";

let cachedLocalities = null;

async function loadLocalities() {
  if (cachedLocalities) return cachedLocalities;
  const res = await fetch("/data/au-localities.json");
  if (!res.ok) throw new Error("Failed to load localities");
  cachedLocalities = await res.json();
  return cachedLocalities;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function score(locality, q) {
  const s = locality.suburb.toLowerCase();
  if (s === q) return 0;
  if (s.startsWith(q)) return 1;
  if (s.includes(q)) return 2;
  return -1;
}

// Returns up to `limit` matches ranked by prefix proximity.
function search(localities, query, limit = 8) {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];
  const results = [];
  for (const loc of localities) {
    const s = score(loc, q);
    if (s >= 0) results.push({ ...loc, _score: s });
    if (results.length > 200) break; // cap scan once we have plenty of candidates
  }
  return results
    .sort((a, b) => a._score - b._score || a.suburb.localeCompare(b.suburb))
    .slice(0, limit);
}

// ── Component ────────────────────────────────────────────────────────────────

export function SuburbAutocomplete({ value, onChange, placeholder = "Search suburb..." }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const localitiesRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Pre-load the dataset on mount so the first keystroke is instant.
  useEffect(() => {
    loadLocalities()
      .then((d) => { localitiesRef.current = d; })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click.
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleChange = useCallback(async (e) => {
    const q = e.target.value;
    setQuery(q);
    setActiveIdx(-1);

    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (!localitiesRef.current) {
      setLoading(true);
      try {
        localitiesRef.current = await loadLocalities();
      } catch {
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    const matches = search(localitiesRef.current, q);
    setResults(matches);
    setOpen(matches.length > 0);
  }, []);

  const select = useCallback((loc) => {
    const display = `${toTitleCase(loc.suburb)} ${loc.state} ${loc.postcode}`;
    setQuery(display);
    setOpen(false);
    setResults([]);
    onChange({ suburb: loc.suburb, postcode: loc.postcode, state: loc.state, display });
  }, [onChange]);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
  }, [onChange]);

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: "100%",
            padding: "10px 36px 10px 12px",
            background: "var(--ms-bg-soft, var(--po-bg-soft))",
            border: "1px solid var(--ms-border, var(--po-border))",
            borderRadius: 10,
            color: "var(--ms-ink, var(--po-text))",
            fontSize: 15,
            fontFamily: '"IBM Plex Sans", sans-serif',
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocusCapture={(e) => {
            e.target.style.borderColor = "var(--ms-green, var(--po-green))";
          }}
          onBlurCapture={(e) => {
            e.target.style.borderColor = "var(--ms-border, var(--po-border))";
          }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ms-dim, var(--po-text-dim))",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--ms-bg-soft, var(--po-bg-soft))",
            border: "1px solid var(--ms-border, var(--po-border))",
            borderRadius: 10,
            overflow: "hidden",
            zIndex: 50,
            margin: 0,
            padding: 0,
            listStyle: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {results.map((loc, i) => (
            <li
              key={`${loc.suburb}-${loc.postcode}-${loc.state}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); select(loc); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: i === activeIdx
                  ? "rgba(200,255,74,0.08)"
                  : "transparent",
                borderBottom: i < results.length - 1
                  ? "1px solid var(--ms-border, var(--po-border))"
                  : "none",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--ms-ink, var(--po-text))", fontFamily: '"IBM Plex Sans", sans-serif' }}>
                {toTitleCase(loc.suburb)}
              </span>
              <span style={{ fontSize: 12, color: "var(--ms-dim, var(--po-text-dim))", fontFamily: '"IBM Plex Sans", sans-serif', letterSpacing: "0.04em" }}>
                {loc.state} {loc.postcode}
              </span>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <p style={{ fontSize: 12, color: "var(--ms-dim, var(--po-text-dim))", marginTop: 4, fontFamily: '"IBM Plex Sans", sans-serif' }}>
          Loading...
        </p>
      )}

      {value && (
        <p style={{ fontSize: 12, color: "var(--ms-dim, var(--po-text-dim))", marginTop: 6, fontFamily: '"IBM Plex Sans", sans-serif' }}>
          Saved: {toTitleCase(value.suburb)} {value.state} {value.postcode}
        </p>
      )}
    </div>
  );
}
