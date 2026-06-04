"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

// Returns path if safe for internal redirect, null otherwise.
// Accepts only paths starting with a single "/" — blocks external URLs and
// protocol-relative URLs (//evil.com). Must stay identical to the copy in
// app/login/page.js.
function safeReturnTo(path) {
  if (!path || typeof path !== "string") return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

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
          // onConflict: "id" + ignoreDuplicates generates ON CONFLICT (id) DO NOTHING.
          // A re-confirm (same id) silently succeeds — idempotency preserved.
          // A handle collision (profiles_handle_key, different id) is NOT caught by
          // the id conflict clause and propagates as error code 23505.
          const { error: upsertError } = await supabase.from("profiles").upsert(
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

          if (upsertError) {
            if (upsertError.code === "23505" && upsertError.message?.includes("profiles_handle_key")) {
              setErrorMsg("That handle was taken while you confirmed your email. Please sign in and choose a different one.");
            } else {
              setErrorMsg(upsertError.message || "Something went wrong creating your profile. Please try again.");
            }
            setStatus("invalid");
            return;
          }
        }
      }

      setStatus("confirmed");
      // 800ms cosmetic delay — verification is fully complete at this point
      // (verifyOtp and profile upsert are both awaited above). This is NOT
      // a race against verifyOtp/getSession. The timer just lets the user
      // read the "Confirmed!" state before the redirect fires.
      setTimeout(async () => {
        const intentType = searchParams.get("intentType");
        const sharerHandle = searchParams.get("sharerHandle");
        const targetCardName = searchParams.get("targetCardName");
        const intentSubType = searchParams.get("intentSubType");

        if (intentType === "propose_trade" && sharerHandle) {
          const subType = intentSubType || "message";
          const messageBody = subType === "trade"
            ? (targetCardName
                ? `Hi! I'm interested in trading for your "${targetCardName}". I'm building my own binder — let's chat!`
                : "Hi! I saw your Trade Binder on Master Setter and I'm interested in a trade. Let's chat!")
            : (targetCardName
                ? `Hi! I'd love to chat about your "${targetCardName}". Are you open to a trade or sale?`
                : "Hi! I saw your Trade Binder on Master Setter and wanted to reach out. Want to chat?");
          router.push(`/messages/${sharerHandle}?prefill=${encodeURIComponent(messageBody)}`);
          router.refresh();
        } else {
          // Catch-all: always attempt migration if localStorage has anonymous data,
          // regardless of intentType. Handles cases where the intent param was
          // dropped in the Supabase redirect chain, or a prior attempt failed.
          // Idempotent via ON CONFLICT DO NOTHING.
          try {
            const raw = localStorage.getItem("ms_anon_entries");
            if (raw) {
              const parsed = JSON.parse(raw);
              const entries = (parsed.entries || []).filter((e) => e.setId);
              if (entries.length > 0) {
                const res = await fetch("/api/anonymous-migration", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ entries, setModes: parsed.setModes || {} }),
                });
                const responseText = await res.text();
                if (res.ok) {
                  const result = JSON.parse(responseText);
                  if (result.inserted === entries.length) {
                    localStorage.removeItem("ms_anon_entries");
                  }
                  sessionStorage.setItem("ms_show_restore_toast", JSON.stringify({
                    count: result.inserted,
                    setIds: result.setIds || [],
                  }));
                }
              }
            }
          } catch (e) { /* ignore */ }
          router.push(safeReturnTo(searchParams.get("returnTo")) || "/");
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
