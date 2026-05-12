"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      // Validate handle (lowercase letters, numbers, underscores; 3-20 chars)
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
        setError("Handle must be 3-20 chars: lowercase letters, numbers, underscores only.");
        setLoading(false);
        return;
      }

      // Check handle availability first
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", handle)
        .maybeSingle();

      if (existing) {
        setError("That handle is already taken.");
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Create profile row
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          handle: handle.toLowerCase(),
          display_name: displayName || handle,
        });
        if (profileError) {
          setError("Account created but profile failed: " + profileError.message);
          setLoading(false);
          return;
        }
      }

      router.push("/");
      router.refresh();
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="po-wordmark text-4xl mb-1">Master Setter</h1>
        <p className="text-sm text-[var(--po-text-dim)] mb-6">
          {mode === "signup" ? "Create your collection" : "Sign in to your collection"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
                  Handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="alex_c"
                  required
                  className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
                />
                <p className="text-[10px] text-[var(--po-text-dim)] mt-1">
                  Your friend will use this to add you.
                </p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex"
                  className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--po-green)] text-black rounded-lg font-black uppercase tracking-widest text-xs disabled:opacity-50 po-glow-green"
          >
            {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="w-full mt-4 text-xs text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  );
}

