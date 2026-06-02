"use client";

import { useState } from "react";
import { createPasskeyClient } from "@/lib/supabase";

// Shared enrollment hook used by PasskeySection (settings) and PasskeyNudge (home).
// Returns { status, enroll }.
//
// status values:
//   "idle"        — not started
//   "pending"     — ceremony in progress (browser prompt showing)
//   "success"     — passkey registered successfully
//   "unsupported" — device/browser does not support WebAuthn
//   "error"       — unexpected failure (message in errorMessage)
export function usePasskeyEnrollment() {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  async function enroll() {
    const supabase = createPasskeyClient();
    setStatus("pending");
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.registerPasskey();

      if (!error) {
        setStatus("success");
        return true;
      }

      // Device / browser does not support WebAuthn at all.
      if (error.message === "Browser does not support WebAuthn") {
        setStatus("unsupported");
        return false;
      }

      // User dismissed the Face ID / fingerprint prompt — silent no-op.
      if (error.cause?.name === "NotAllowedError") {
        setStatus("idle");
        return false;
      }

      // Any other failure — show a short message but don't crash.
      setErrorMessage("Couldn’t set up passkey. Try again.");
      setStatus("error");
      return false;
    } catch {
      // Unexpected throw — treat as cancellation so the user isn't stuck.
      setStatus("idle");
      return false;
    }
  }

  return { status, errorMessage, enroll };
}
