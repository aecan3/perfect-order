"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getFriendIds } from "@/lib/queries/friends";
import { getBlockIds } from "@/lib/queries/blocks";
import { Avatar } from "@/components/Avatar";

export function NewMessageSheet({ open, onClose }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef(null);

  const [friends, setFriends] = useState(null); // null = loading
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) { setQuery(""); return; }

    // Autofocus search input once sheet is open
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || friends !== null) return;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFriends([]); return; }

      const [friendIds, blockIds] = await Promise.all([
        getFriendIds(supabase, user.id),
        getBlockIds(supabase, user.id),
      ]);

      const visibleIds = friendIds.filter((id) => !blockIds.has(id));
      if (visibleIds.length === 0) { setFriends([]); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", visibleIds);
      setFriends(profiles || []);
    })();
  }, [open, friends, supabase]);

  const q = query.trim().toLowerCase();
  const filtered = (friends || []).filter((p) => {
    if (!q) return true;
    return (
      p.handle?.toLowerCase().includes(q) ||
      p.display_name?.toLowerCase().includes(q)
    );
  });

  const select = (handle) => {
    onClose();
    router.push(`/messages/${handle}?compose=1`);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: "fixed", inset: 0,
          background: "var(--po-bg)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--po-border)",
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--po-text)" }}>
            New Message
          </span>
          <button
            onClick={onClose}
            className="ms-pressable"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--po-text-dim)", padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--po-bg-soft)",
            border: "1px solid var(--po-border)",
            borderRadius: 12,
            padding: "0 12px",
          }}>
            <span style={{ fontSize: 13, color: "var(--po-text-dim)", fontWeight: 600, flexShrink: 0 }}>
              To:
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search friends..."
              style={{
                flex: 1,
                background: "none", border: "none", outline: "none",
                fontSize: 14, color: "var(--po-text)",
                padding: "11px 0",
              }}
            />
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {friends === null && (
            <p style={{ textAlign: "center", color: "var(--po-text-dim)", fontSize: 14, padding: "32px 16px" }}>
              Loading...
            </p>
          )}

          {friends !== null && friends.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <p style={{ color: "var(--po-text-dim)", fontSize: 14, marginBottom: 12 }}>
                Add friends to start messaging.
              </p>
              <Link
                href="/discover"
                onClick={onClose}
                className="ms-pressable"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  background: "var(--po-green)", color: "#050507",
                  borderRadius: 10, fontWeight: 700, fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Find people on Discover
              </Link>
            </div>
          )}

          {friends !== null && friends.length > 0 && filtered.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--po-text-dim)", fontSize: 14, padding: "32px 16px" }}>
              No friends found.
            </p>
          )}

          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.handle)}
              className="ms-pressable"
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Avatar profile={p} size={40} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--po-text)", lineHeight: 1.3 }}>
                  {p.display_name || `@${p.handle}`}
                </div>
                <div style={{ fontSize: 12, color: "var(--po-text-dim)" }}>
                  @{p.handle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
