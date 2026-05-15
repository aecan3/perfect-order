"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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

      // Check handle availability
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

      // Store handle + display_name in user metadata so the confirm route can
      // create the profile row after the session is established. The profile
      // insert cannot happen here — with email confirmation enforced, signUp()
      // returns no session, so the authenticated-only INSERT RLS policy blocks it.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            handle: handle.toLowerCase(),
            display_name: displayName || handle,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Email confirmation is required before the user can sign in.
      // Do not navigate into the app — the proxy will bounce them.
      setAwaitingConfirmation(true);
      setLoading(false);
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

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm flex flex-col items-center space-y-6">
          <MasterSetterLogo variant="stacked" height={72} className="mb-2" />
          <div className="text-center space-y-3">
            <h1 className="text-xl font-black text-[var(--po-text)]">Check your email</h1>
            <p className="text-sm text-[var(--po-text-dim)]">
              We sent a confirmation link to <span className="text-[var(--po-text)]">{email}</span>.
              Click it to activate your account.
            </p>
            <p className="text-xs text-[var(--po-text-dim)]">
              Check your spam folder if you don't see it within a minute.
            </p>
          </div>
          <button
            onClick={() => {
              setAwaitingConfirmation(false);
              setMode("signin");
            }}
            className="w-full text-xs text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center">
        <MasterSetterLogo variant="stacked" height={72} className="mb-2" />
        <p className="mb-6" style={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(244,244,246,0.6)', textAlign: 'center' }}>
          Collect. Trade. Complete.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 w-full">
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

        {mode === "signin" && (
          <div className="mt-3 text-center">
            <a
              href="/forgot-password"
              style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '0.875rem', color: 'rgba(244,244,246,0.6)', textDecoration: 'none', letterSpacing: '0.05em' }}
            >
              Forgot password?
            </a>
          </div>
        )}

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
