"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // "loading"   while verifyOtp + profile creation are in flight.
  // "confirmed" user is verified and session is established — routing to app.
  // "invalid"   token missing, expired, or already used.
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState(null);

  // Prevents verifyOtp being called twice (React StrictMode double-mount).
  // Reset at effect start so each genuine mount gets one attempt.
  const verifiedRef = useRef(false);

  useEffect(() => {
    verifiedRef.current = false;

    async function confirm() {
      if (verifiedRef.current) return;
      verifiedRef.current = true;

      // Supabase rejected the token upstream — error params are in the URL.
      const urlError = searchParams.get("error_description") || searchParams.get("error");
      if (urlError) {
        setErrorMsg(urlError);
        setStatus("invalid");
        return;
      }

      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      // No token — direct visit with no confirmation link.
      if (!token_hash) {
        setStatus("invalid");
        return;
      }

      // verifyOtp exchanges the token_hash for an authenticated session.
      // Does not require a PKCE code verifier — works from any browser context.
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type || "signup",
      });

      if (otpError) {
        // If verifyOtp failed but a session already exists, the first
        // invocation succeeded (StrictMode double-mount consumed the token).
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setErrorMsg(otpError.message);
          setStatus("invalid");
          return;
        }
        // Session exists from first invocation — fall through to profile step.
      }

      // Session is now established. Create the profile row using the handle
      // and display_name stored in user metadata at signup time.
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const meta = user.user_metadata || {};
        const handle = meta.handle;
        const displayName = meta.display_name || handle;

        if (handle) {
          // Insert is idempotent: if a prior attempt already created the row
          // (e.g. StrictMode second mount), the conflict is silently ignored.
          await supabase.from("profiles").upsert(
            {
              id: user.id,
              handle,
              display_name: displayName,
              country: meta.country ?? null,
              tos_version: meta.tos_version ?? null,
              tos_agreed_at: meta.tos_agreed_at ?? null,
              privacy_version: meta.privacy_version ?? null,
              privacy_agreed_at: meta.privacy_agreed_at ?? null,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
        }
      }

      setStatus("confirmed");
      // 800ms cosmetic delay — verification is fully complete at this point
      // (verifyOtp and profile upsert are both awaited above). This is NOT
      // a race against verifyOtp/getSession. The timer just lets the user
      // read the "Confirmed!" state before the redirect fires.
      setTimeout(() => {
        const intentType = searchParams.get("intentType");
        const sharerHandle = searchParams.get("sharerHandle");
        const targetCardName = searchParams.get("targetCardName");

        if (intentType === "propose_trade" && sharerHandle) {
          const cardRef = targetCardName
            ? ` about your "${targetCardName}"`
            : " about a card from your Trade Binder";
          const messageBody = `Hi! I'm interested in trading${cardRef}. Want to chat?`;
          router.push(`/messages/${sharerHandle}?prefill=${encodeURIComponent(messageBody)}`);
          router.refresh();
        } else {
          router.push("/");
          router.refresh();
        }
      }, 800);
    }

    confirm();
  }, []);

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <MasterSetterLogo className="mx-auto mb-4" />
        <h1 className="text-xl font-black text-[var(--po-text)]">
          {status === "confirmed" ? "Email confirmed" : "Confirming your email"}
        </h1>
      </div>

      {status === "loading" && (
        <p className="text-center text-sm text-[var(--po-text-dim)]">
          Confirming your email...
        </p>
      )}

      {status === "confirmed" && (
        <p className="text-center text-sm text-[var(--po-text-dim)]">
          You're all set. Taking you in...
        </p>
      )}

      {status === "invalid" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[var(--po-text-dim)]">
            {errorMsg || "This confirmation link has expired or has already been used."}
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3 bg-[var(--po-green)] text-black rounded-lg font-black uppercase tracking-widest text-xs po-glow-green"
          >
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}

export default function ConfirmPage() {
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
              <h1 className="text-xl font-black text-[var(--po-text)]">Confirming your email</h1>
            </div>
            <p className="text-center text-sm text-[var(--po-text-dim)]">Confirming your email...</p>
          </div>
        }
      >
        <ConfirmContent />
      </Suspense>
    </div>
  );
}
