"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Check, X, Eye, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import { getBlockIds } from "@/lib/queries/blocks";

export default function FriendsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [friendships, setFriendships] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [searchHandle, setSearchHandle] = useState("");
  const [searchError, setSearchError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [blockIds, setBlockIds] = useState(new Set());
  const [authChecked, setAuthChecked] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  const loadFriendships = useCallback(async (uid) => {
    const [{ data: rows }, ids] = await Promise.all([
      supabase
        .from("friendships")
        .select("*")
        .or(`user_a.eq.${uid},user_b.eq.${uid}`),
      getBlockIds(supabase, uid),
    ]);

    setBlockIds(ids);

    const visibleRows = (rows || []).filter((r) => {
      const otherId = r.user_a === uid ? r.user_b : r.user_a;
      return !ids.has(otherId);
    });

    setFriendships(visibleRows);

    const otherIds = visibleRows.map((r) => r.user_a === uid ? r.user_b : r.user_a);
    if (otherIds.length === 0) {
      setProfilesById({});
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("*")
      .in("id", otherIds);
    const map = {};
    (profs || []).forEach((p) => { map[p.id] = p; });
    setProfilesById(map);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/welcome");
        return;
      }
      setUser(user);
      const [{ data: profileData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        loadFriendships(user.id),
      ]);
      setProfile(profileData);
      setAuthChecked(true);
    })();
  }, [router, supabase, loadFriendships]);

  // Debounced search
  useEffect(() => {
    if (selectedResult) return; // don't search if user picked a result
    clearTimeout(debounceRef.current);
    if (!searchHandle.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const q = searchHandle.trim().toLowerCase();
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      const friendAndSelfIds = new Set([
        user?.id,
        ...friendships.map((f) => f.user_a),
        ...friendships.map((f) => f.user_b),
      ]);
      const filtered = (data || []).filter((p) => !friendAndSelfIds.has(p.id) && !blockIds.has(p.id));
      setSearchResults(filtered);
      setShowDropdown(true);
    }, 300);
  }, [searchHandle, selectedResult]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pickResult = (p) => {
    setSelectedResult(p);
    setSearchHandle(p.handle);
    setShowDropdown(false);
    setSearchResults([]);
    setSearchError(null);
  };

  const sendRequest = async (e) => {
    e.preventDefault();
    setSearchError(null);
    setSearchLoading(true);

    const handle = (selectedResult?.handle || searchHandle).trim().toLowerCase();
    if (!handle) { setSearchLoading(false); return; }
    if (handle === profile?.handle) {
      setSearchError("That's you!");
      setSearchLoading(false);
      return;
    }

    const target = selectedResult || await (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .eq("handle", handle)
        .maybeSingle();
      return data;
    })();

    if (!target) {
      setSearchError("No one found with that handle.");
      setSearchLoading(false);
      return;
    }

    const existing = friendships.find(
      (f) =>
        (f.user_a === user.id && f.user_b === target.id) ||
        (f.user_a === target.id && f.user_b === user.id)
    );
    if (existing) {
      setSearchError(
        existing.status === "accepted" ? "You're already friends." : "A request already exists."
      );
      setSearchLoading(false);
      return;
    }

    const { data: blocked } = await supabase.rpc("is_blocked", { viewer: user.id, target: target.id });
    if (blocked) {
      setSearchError("Couldn't send a request to this user.");
      setSearchLoading(false);
      return;
    }

    const { error: insErr } = await supabase.from("friendships").insert({
      user_a: user.id,
      user_b: target.id,
      status: "pending",
    });
    if (insErr) {
      setSearchError(insErr.message);
      setSearchLoading(false);
      return;
    }

    const senderName = profile?.display_name || `@${profile?.handle}` || "Someone";
    await supabase.from("notifications").insert({
      user_id: target.id,
      type: "friend_request",
      title: "New friend request",
      body: `${senderName} sent you a friend request.`,
      link: "/friends",
    });

    setSearchHandle("");
    setSelectedResult(null);
    setSearchLoading(false);
    await loadFriendships(user.id);
  };

  const accept = async (friendshipId) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    await loadFriendships(user.id);
  };

  const remove = async (friendshipId) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    await loadFriendships(user.id);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center text-[var(--po-text-dim)]">
        Loading...
      </div>
    );
  }

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.user_b === user.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.user_a === user.id);
  const otherOf = (f) => (f.user_a === user.id ? f.user_b : f.user_a);

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)]">
      <header className="sticky top-0 z-10 bg-[var(--po-bg)]/90 backdrop-blur border-b border-[var(--po-border)] px-4 py-3 flex items-center gap-3">
        <BackButton href="/you" />
        <h1 className="text-lg font-bold">Friends</h1>
      </header>

      <main className="px-4 py-4 space-y-6 max-w-md mx-auto">
        {/* Your handle */}
        <section className="bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)]">
            Your handle
          </div>
          <div className="text-lg font-bold text-[var(--po-green)]">@{profile?.handle}</div>
          <p className="text-xs text-[var(--po-text-dim)] mt-1">
            Share this with your mate so they can add you.
          </p>
        </section>

        {/* Add friend */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-2">
            Add a friend
          </h2>
          <form onSubmit={sendRequest} className="flex gap-2">
            <div className="flex-1 relative" ref={dropdownRef}>
              <input
                type="text"
                value={searchHandle}
                onChange={(e) => {
                  setSearchHandle(e.target.value.toLowerCase());
                  setSelectedResult(null);
                  if (!e.target.value.trim()) setShowDropdown(false);
                }}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                placeholder="search by handle or name"
                className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)] placeholder:text-[var(--po-text-dim)]"
              />
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg overflow-hidden shadow-lg">
                  {searchResults.length === 0 ? (
                    <div className="px-3 py-2.5 text-sm text-[var(--po-text-dim)]">No users found</div>
                  ) : (
                    searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => pickResult(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[var(--po-bg)] transition-colors flex items-center gap-2"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: "var(--po-bg)", border: "1px solid var(--po-border)", color: "var(--po-green)" }}
                        >
                          {(p.handle || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{p.display_name || p.handle}</div>
                          <div className="text-[10px] text-[var(--po-text-dim)]">@{p.handle}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={searchLoading || !searchHandle.trim()}
              className="px-4 py-2 bg-[var(--po-green)] text-black rounded-lg font-bold uppercase tracking-widest text-xs disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
            >
              <UserPlus size={14} />
              Add
            </button>
          </form>
          {searchError && (
            <div className="mt-2 text-sm text-rose-300">{searchError}</div>
          )}
        </section>

        {/* Incoming requests — collapsible, hidden when empty */}
        {incoming.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setRequestsOpen((v) => !v)}
              aria-expanded={requestsOpen}
              className="w-full text-left text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-2 bg-transparent border-0 p-0 cursor-pointer"
            >
              {requestsOpen ? "▾" : "▸"} Friend requests ({incoming.length})
            </button>
            {requestsOpen && (
              <div className="space-y-2">
                {incoming.map((f) => {
                  const p = profilesById[otherOf(f)];
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg p-3"
                    >
                      <div>
                        <div className="font-bold">{p?.display_name || p?.handle || "Someone"}</div>
                        <div className="text-xs text-[var(--po-text-dim)]">@{p?.handle}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => accept(f.id)}
                          className="w-8 h-8 rounded-full bg-[var(--po-green)] text-black flex items-center justify-center po-glow-green"
                          aria-label="Accept"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => remove(f.id)}
                          className="w-8 h-8 rounded-full bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] flex items-center justify-center hover:border-rose-700 hover:text-rose-400"
                          aria-label="Reject"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Outgoing requests — collapsible, hidden when empty */}
        {outgoing.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setSentOpen((v) => !v)}
              aria-expanded={sentOpen}
              className="w-full text-left text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-2 bg-transparent border-0 p-0 cursor-pointer"
            >
              {sentOpen ? "▾" : "▸"} Pending sent ({outgoing.length})
            </button>
            {sentOpen && (
              <div className="space-y-2">
                {outgoing.map((f) => {
                  const p = profilesById[otherOf(f)];
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg p-3 opacity-60"
                    >
                      <div>
                        <div className="font-bold">{p?.display_name || p?.handle || "Someone"}</div>
                        <div className="text-xs text-[var(--po-text-dim)]">
                          @{p?.handle} · awaiting response
                        </div>
                      </div>
                      <button
                        onClick={() => remove(f.id)}
                        className="px-3 py-1.5 bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] rounded-lg text-xs font-bold uppercase tracking-widest hover:border-rose-700 hover:text-rose-400"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Friends */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-2">
            Friends ({accepted.length})
          </h2>
          {accepted.length === 0 ? (
            <p className="text-sm text-[var(--po-text-dim)]">No friends yet.</p>
          ) : (
            <div className="space-y-2">
              {accepted.map((f) => {
                const p = profilesById[otherOf(f)];
                if (!p) return null;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between bg-[var(--po-bg-soft)] border border-[var(--po-border)] rounded-lg p-3"
                  >
                    <div>
                      <div className="font-bold">{p.display_name || p.handle}</div>
                      <div className="text-xs text-[var(--po-text-dim)]">@{p.handle}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/friend/${p.handle}`}
                        className="px-3 py-1.5 bg-[var(--po-green)] text-black rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-1"
                      >
                        <Eye size={12} />
                        View
                      </Link>
                      <Link
                        href={`/messages/${p.handle}`}
                        className="w-8 h-8 bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] rounded-lg flex items-center justify-center hover:border-[var(--po-green)] hover:text-[var(--po-green)]"
                        aria-label={`Message ${p.handle}`}
                      >
                        <MessageCircle size={14} />
                      </Link>
                      <button
                        onClick={() => { if (confirm(`Unfriend ${p.handle}?`)) remove(f.id); }}
                        className="px-3 py-1.5 bg-[var(--po-bg)] border border-[var(--po-border)] text-[var(--po-text-dim)] rounded-lg text-xs font-bold uppercase tracking-widest hover:border-rose-700 hover:text-rose-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

