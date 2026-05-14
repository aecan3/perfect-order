"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
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
          <h1 className="text-xl font-black text-[var(--po-text)]">Reset password</h1>
          <p className="text-sm text-[var(--po-text-dim)] mt-1">
            {sent
              ? "Check your email for a reset link."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
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
              {loading ? "..." : "Send reset link"}
            </button>
          </form>
        )}

        <button
          onClick={() => router.push("/login")}
          className="w-full text-xs text-[var(--po-text-dim)] hover:text-[var(--po-green)] transition-colors"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
