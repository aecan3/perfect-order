"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // "loading"  while the PKCE code exchange / session check is in progress.
  // "ready"    once a recovery session is confirmed — show the password form.
  // "expired"  after a genuine failure: bad/used code, upstream error, or
  //            timeout with no session and no PASSWORD_RECOVERY event.
  // "done"     after a successful password update.
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Persists across React StrictMode double-mount; reset at effect start.
  const settledRef = useRef(false);

  useEffect(() => {
    // Reset on each effect invocation so StrictMode double-mount works correctly.
    settledRef.current = false;

    function markReady() {
      if (settledRef.current) return;
      settledRef.current = true;
      setStatus("ready");
    }

    function markExpired(msg) {
      if (settledRef.current) return;
      settledRef.current = true;
      if (msg) setErrorMsg(msg);
      setStatus("expired");
    }

    // If Supabase rejected the token before the redirect, the error lands in
    // the URL — surface it immediately without waiting.
    const urlError = searchParams.get("error_description") || searchParams.get("error");
    if (urlError) {
      markExpired(urlError);
      return;
    }

    const hasCode = Boolean(searchParams.get("code"));

    // createBrowserClient is configured with flowType: "pkce" and
    // detectSessionInUrl: true. It auto-exchanges the ?code= param during
    // client init, before this effect runs. Calling exchangeCodeForSession
    // manually would try to use an already-consumed code — do NOT do that.
    //
    // Instead: listen for PASSWORD_RECOVERY (fires after a successful
    // auto-exchange) AND check getSession() (handles the case where the
    // exchange completed before the listener attached).

    let timeoutId = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Exchange already completed — session exists.
        markReady();
        return;
      }

      if (!hasCode) {
        // No code in URL and no session — user arrived without a valid link.
        markExpired(null);
        return;
      }

      // Code is present but session isn't established yet — the auto-exchange
      // is in flight. Give the PASSWORD_RECOVERY event time to arrive.
      // After 5 s, do one final getSession() check before giving up.
      timeoutId = setTimeout(async () => {
        const { data: { session: lateSess } } = await supabase.auth.getSession();
        if (lateSess) {
          markReady();
        } else {
          markExpired(null);
        }
      }, 5000);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (password !== confirm) {
      setFormError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setFormError(updateError.message);
      setLoading(false);
      return;
    }
    setStatus("done");
    setLoading(false);
  }

  return (
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
            {errorMsg || "This reset link has expired or has already been used."}
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

          {formError && (
            <div className="text-sm text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg px-3 py-2">
              {formError}
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
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--po-bg)" }}
    >
      <Suspense
        fallback={
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <MasterSetterLogo className="mx-auto mb-4" />
              <h1 className="text-xl font-black text-[var(--po-text)]">Set new password</h1>
            </div>
            <p className="text-center text-sm text-[var(--po-text-dim)]">Verifying your reset link...</p>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
