"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";
import * as Sentry from "@sentry/nextjs";
import { track, EVENTS, identifyOnSignup, hasFired, markFired } from "@/lib/track";

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
        // verifyOtp can fail because the token was already CONSUMED by a prior
        // successful confirm — a StrictMode double-mount, a re-mount (e.g. a stray
        // router.refresh), or the back button. That is NOT a bad link when the
        // user is already authenticated: a consumed token + an established session
        // means "already confirmed." Check authoritatively via getUser (validates
        // the JWT server-side, unlike getSession which can read a momentarily-stale
        // local value) and only fail when there is genuinely no session.
        // Invariant: a user WITH a valid session is never shown "invalid".
        const { data: { user: existingUser } } = await supabase.auth.getUser();
        if (!existingUser) {
          setErrorMsg(otpError.message);
          setStatus("invalid");
          return;
        }
        // Session already established by the first invocation — fall through.
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
        // Shared post-confirm work (stash migration + identity stitch +
        // signup_completed), run by BOTH the trade-invite and catch-all branches
        // before they navigate. No routing inside — each branch does its own push.
        async function runPostConfirmMigrationAndAnalytics() {
          // Cross-device onboarding: the SERVER STASH (keyed by the confirmed
          // user's email) is the source of truth; localStorage is a same-device
          // fallback used only when the stash migrated nothing (e.g. the
          // signup-start stash write failed but this device still holds the data).
          let effectiveMigrated = 0;
          let effectiveSetIds = [];
          let stashedAnonId = null; // original signup-device anon_id, if recovered

          // 1. Consume the server-side stash (authenticated via the session cookie).
          //    Resilient: ANY failure (network / 401 / 500) falls through to the
          //    localStorage fallback — the user must always reach the app.
          try {
            const res = await fetch("/api/anon-stash/consume", { method: "POST" });
            if (res.ok) {
              const data = await res.json();
              effectiveMigrated = data.migrated ?? 0;
              effectiveSetIds = data.setIds ?? [];
              stashedAnonId = data.anon_id ?? null;
            } else {
              Sentry.captureMessage("anon-stash consume HTTP error (confirm page)", {
                level: "warning",
                tags: { path: "/api/anon-stash/consume", status: res.status },
              });
            }
          } catch (e) {
            Sentry.captureException(e, { tags: { location: "confirm-stash-consume" } });
          }

          // 2. FALLBACK: only when the stash migrated nothing, migrate any local
          //    ms_anon_entries via the existing /api/anonymous-migration path.
          if (effectiveMigrated === 0) {
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
                  if (!res.ok) {
                    Sentry.captureMessage("anonymous-migration HTTP error (confirm page)", {
                      level: "error",
                      tags: { path: "/api/anonymous-migration", status: res.status },
                    });
                  } else {
                    const result = JSON.parse(responseText);
                    if (result.inserted !== entries.length) {
                      Sentry.captureMessage("anonymous-migration count mismatch (confirm page)", {
                        level: "warning",
                        extra: { inserted: result.inserted, expected: entries.length },
                      });
                    }
                    effectiveMigrated = result.inserted ?? 0;
                    effectiveSetIds = result.setIds ?? [];
                  }
                }
              }
            } catch (e) {
              Sentry.captureException(e, { tags: { location: "confirm-migration" } });
            }
          }

          // 3. After a successful migrate via EITHER path, clear local entries (so a
          //    later same-device visit doesn't re-migrate / re-toast) and surface the
          //    "restored N cards" toast with the single effective count.
          if (effectiveMigrated > 0) {
            try { localStorage.removeItem("ms_anon_entries"); } catch (e) { /* ignore */ }
            sessionStorage.setItem("ms_show_restore_toast", JSON.stringify({
              count: effectiveMigrated,
              setIds: effectiveSetIds,
            }));
          }

          // 4. Identity stitch — CRITICAL cross-device FIX. If the stash was consumed
          //    and carried an anon_id, link the ORIGINAL signup-device anon_id ->
          //    user_id. Otherwise (consume failed / no stash / fallback) pass undefined
          //    so identifyOnSignup uses the local anon_id (on same-device, that IS the
          //    original signup anon_id).
          if (user?.id) identifyOnSignup(user.id, stashedAnonId || undefined);

          // 5. signup_completed — genuine new-account completion (email confirmed).
          // Fires once per session, unconditionally (even a zero-entry signup), with
          // the single effective migration count from whichever path ran.
          if (!hasFired("signup_completed")) {
            track(EVENTS.SIGNUP_COMPLETED, {
              migrated_entries: effectiveMigrated,
              migrated_set_ids: effectiveSetIds,
              source: "confirm",
            });
            markFired("signup_completed");
          }
        }

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
          await runPostConfirmMigrationAndAnalytics();
          // Navigating away to /messages — do NOT router.refresh() the current
          // /auth/confirm route. Refreshing it mid-navigation re-mounts this page
          // and re-runs the one-shot confirm() against the now-consumed token → a
          // false "invalid" / stranded user. The destination fetches its own data.
          router.push(`/messages/${sharerHandle}?prefill=${encodeURIComponent(messageBody)}`);
        } else {
          await runPostConfirmMigrationAndAnalytics();

          // Navigating away — no router.refresh() (same re-mount race as the
          // propose_trade branch above); the destination loads its own data.
          router.push(safeReturnTo(searchParams.get("returnTo")) || "/");
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
