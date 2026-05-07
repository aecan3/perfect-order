"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Check, X, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase";

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
  const [authChecked, setAuthChecked] = useState(false);

  const loadFriendships = useCallback(async (uid) => {
    const { data: rows } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);

    setFriendships(rows || []);

    const otherIds = (rows || []).map((r) =>
      r.user_a === uid ? r.user_b : r.user_a
    );
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
        router.replace("/login");
        return;
      }
      setUser(user);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(profileData);
      await loadFriendships(user.id);
      setAuthChecked(true);
    })();
  }, [router, supabase, loadFriendships]);

  const sendRequest = async (e) => {
    e.preventDefault();
    setSearchError(null);
    setSearchLoading(true);

    const handle = searchHandle.trim().toLowerCase();
    if (!handle) { setSearchLoading(false); return; }
    if (handle === profile?.handle) {
      setSearchError("That's you!");
      setSearchLoading(false);
      return;
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .eq("handle", handle)
      .maybeSingle();

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

    setSearchHandle("");
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
        Loading…
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
        <Link href="/" className="text-[var(--po-text-dim)] hover:text-[var(--po-green)]">
          <ArrowLeft size={20} />
        </Link>
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
            <input
              type="text"
              value={searchHandle}
              onChange={(e) => setSearchHandle(e.target.value.toLowerCase())}
              placeholder="their_handle"
              className="flex-1 px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)] placeholder:text-[var(--po-text-dim)]"
            />
            <button
              type="submit"
              disabled={searchLoading || !searchHandle.trim()}
              className="px-4 py-2 bg-[var(--po-green)] text-black rounded-lg font-bold uppercase tracking-widest text-xs disabled:opacity-50 flex items-center gap-1"
            >
              <UserPlus size={14} />
              Send
            </button>
          </form>
          {searchError && (
            <div className="mt-2 text-sm text-rose-300">{searchError}</div>
          )}
        </section>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-2">
              Requests for you
            </h2>
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

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-2">
              Pending (sent)
            </h2>
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
          </section>
        )}
      </main>
    </div>
  );
}
