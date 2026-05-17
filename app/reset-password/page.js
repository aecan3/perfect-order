"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // "loading"  while verifyOtp is in flight.
  // "ready"    once the recovery session is confirmed — show the password form.
  // "expired"  token missing, invalid, or already used.
  // "done"     after a successful password update.
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Prevents verifyOtp being called twice (React StrictMode double-mount).
  // Reset at effect start so each genuine mount gets one attempt.
  const verifiedRef = useRef(false);

  useEffect(() => {
    verifiedRef.current = false;

    async function verify() {
      if (verifiedRef.current) return;
      verifiedRef.current = true;

      // If Supabase rejected the token before the redirect, the error is
      // in the URL — surface it immediately.
      const urlError = searchParams.get("error_description") || searchParams.get("error");
      if (urlError) {
        setErrorMsg(urlError);
        setStatus("expired");
        return;
      }

      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      // No token — user visited /reset-password directly with no link.
      if (!token_hash) {
        setStatus("expired");
        return;
      }

      // verifyOtp exchanges the token_hash for a recovery session.
      // Unlike PKCE, this requires no code verifier in localStorage —
      // it works regardless of which browser or context opens the link.
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type || "recovery",
      });

      if (!error) {
        setStatus("ready");
        return;
      }

      // verifyOtp failed. Before showing "expired", check whether a
      // session already exists — this covers the StrictMode double-mount
      // case where the first call succeeded and consumed the token.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("ready");
      } else {
        setErrorMsg(error.message);
        setStatus("expired");
      }
    }

    verify();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (password !== confirm) {
      setFormError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
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
              minLength={8}
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
              minLength={8}
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
