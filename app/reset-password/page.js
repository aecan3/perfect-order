"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  // "loading"  while waiting for Supabase to process the recovery token.
  // "ready"    once recovery session is confirmed — show the password form.
  // "expired"  after getSession() returned nothing AND no PASSWORD_RECOVERY
  //            event arrived within the grace period — link is invalid or used.
  // "done"     after a successful password update.
  const [status, setStatus] = useState("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let settled = false;

    function markReady() {
      if (settled) return;
      settled = true;
      setStatus("ready");
    }

    function markExpired() {
      if (settled) return;
      settled = true;
      setStatus("expired");
    }

    // Listen for PASSWORD_RECOVERY — fires when Supabase exchanges the hash
    // token after the listener attaches.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    // Also check whether Supabase already processed the token before the listener
    // attached (this happens when the page hydrates after the hash is consumed).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        markReady();
      } else {
        // No session yet. Give the PASSWORD_RECOVERY event a real grace period —
        // on a slow mobile connection, Supabase may need several seconds to parse
        // the hash, validate the token, and fire the event.
        const timeout = setTimeout(markExpired, 5000);
        // Store cleanup ref on the closure so the return below can clear it.
        cleanupTimeout = timeout;
      }
    });

    let cleanupTimeout = null;

    return () => {
      subscription.unsubscribe();
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setStatus("done");
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--po-bg)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <MasterSetterLogo className="mx-auto mb-4" />
          <h1 className="text-xl font-black text-[var(--po-text)]">
            {status === "done" ? "Password updated" : "Set new password"}
          </h1>
        </div>

        {status === "loading" && (
          <p className="text-center text-sm text-[var(--po-text-dim)]">Verifying your reset link...</p>
        )}

        {status === "expired" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[var(--po-text-dim)]">
              This reset link has expired or has already been used.
            </p>
            <a
              href="/forgot-password"
              className="inline-block text-sm font-bold text-[var(--po-green)] hover:underline"
            >
              Request a new reset link
            </a>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? "..." : "Update password"}
            </button>
          </form>
        )}

        {status === "done" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[var(--po-text-dim)]">
              Your password has been updated successfully.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 bg-[var(--po-green)] text-black rounded-lg font-black uppercase tracking-widest text-xs po-glow-green"
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
