"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";
import { TERMS_CONTENT, TERMS_LAST_UPDATED } from "@/content/legal/terms";
import { PRIVACY_CONTENT, PRIVACY_LAST_UPDATED } from "@/content/legal/privacy";
import { TOS_VERSION, PRIVACY_VERSION } from "@/lib/legalVersions";

const COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "OTHER", name: "Other" },
];

function renderLegalMarkdown(text) {
  const elements = [];
  let para = [];
  for (const line of text.trim().split("\n")) {
    if (line.startsWith("## ")) {
      if (para.length) { elements.push({ type: "p", text: para.join(" ") }); para = []; }
      elements.push({ type: "h2", text: line.slice(3) });
    } else if (!line.trim()) {
      if (para.length) { elements.push({ type: "p", text: para.join(" ") }); para = []; }
    } else {
      para.push(line.trim());
    }
  }
  if (para.length) elements.push({ type: "p", text: para.join(" ") });

  return elements.map((el, i) =>
    el.type === "h2" ? (
      <h3 key={i} style={{ fontSize: 13, fontWeight: 700, color: "var(--po-text)", marginTop: 18, marginBottom: 4, fontFamily: '"IBM Plex Sans", sans-serif' }}>
        {el.text}
      </h3>
    ) : (
      <p key={i} style={{ fontSize: 12, color: "var(--po-text-dim)", lineHeight: 1.7, marginBottom: 6, fontFamily: '"IBM Plex Sans", sans-serif' }}>
        {el.text}
      </p>
    )
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Honor ?mode=signup from the welcome page "Create Account" button.
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("AU");
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // null | "terms" | "privacy"

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
        setError("Handle must be 3-20 chars: lowercase letters, numbers, underscores only.");
        setLoading(false);
        return;
      }

      if (!country) {
        setError("Please select your country.");
        setLoading(false);
        return;
      }

      if (!legalAgreed) {
        setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
        setLoading(false);
        return;
      }

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

      const agreedAt = new Date().toISOString();

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            handle: handle.toLowerCase(),
            display_name: displayName || handle,
            country,
            tos_version: TOS_VERSION,
            tos_agreed_at: agreedAt,
            privacy_version: PRIVACY_VERSION,
            privacy_agreed_at: agreedAt,
          },
          emailRedirectTo: (() => {
            const p = new URLSearchParams(window.location.search);
            p.delete("mode"); // not needed in confirm URL
            const qs = p.toString();
            return qs
              ? `${window.location.origin}/auth/confirm?${qs}`
              : `${window.location.origin}/auth/confirm`;
          })(),
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setAwaitingConfirmation(true);
      setLoading(false);
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Resolve pending Trade Binder intent — sessionStorage first, URL params as fallback
      let intent = null;
      try {
        const raw = sessionStorage.getItem("ms_anon_intent");
        if (raw) {
          const parsed = JSON.parse(raw);
          const ageMs = Date.now() - (parsed.capturedAt || 0);
          const THIRTY_MIN = 30 * 60 * 1000;
          if (ageMs > THIRTY_MIN) {
            sessionStorage.removeItem("ms_anon_intent");
          } else {
            intent = parsed;
          }
        }
      } catch (e) { /* ignore */ }

      if (!intent) {
        const intentType = searchParams.get("intentType");
        const sharerHandle = searchParams.get("sharerHandle");
        const targetCardName = searchParams.get("targetCardName");
        const intentSubType = searchParams.get("intentSubType");
        if (intentType === "propose_trade" && sharerHandle) {
          intent = { type: "propose_trade", intentSubType, sharerHandle, targetCardName };
        } else if (intentType === "collection_migration") {
          intent = { type: "collection_migration" };
        }
      }

      if (intent?.type === "propose_trade" && intent.sharerHandle) {
        const subType = intent.intentSubType || "message";
        const cardName = intent.targetCardName;
        const messageBody = subType === "trade"
          ? (cardName
              ? `Hi! I'm interested in trading for your "${cardName}". I'm building my own binder — let's chat!`
              : "Hi! I saw your Trade Binder on Master Setter and I'm interested in a trade. Let's chat!")
          : (cardName
              ? `Hi! I'd love to chat about your "${cardName}". Are you open to a trade or sale?`
              : "Hi! I saw your Trade Binder on Master Setter and wanted to reach out. Want to chat?");
        try { sessionStorage.removeItem("ms_anon_intent"); } catch (e) { /* ignore */ }
        router.push(`/messages/${intent.sharerHandle}?prefill=${encodeURIComponent(messageBody)}`);
        router.refresh();
        return;
      }

      if (intent?.type === "collection_migration") {
        try {
          const raw = localStorage.getItem("ms_anon_entries");
          if (raw) {
            const parsed = JSON.parse(raw);
            const entries = (parsed.entries || []).filter((e) => e.setId);
            if (entries.length > 0) {
              const res = await fetch("/api/anonymous-migration", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries }),
              });
              if (res.ok) {
                const result = await res.json();
                if (result.inserted === entries.length) localStorage.removeItem("ms_anon_entries");
                sessionStorage.setItem("ms_show_restore_toast", JSON.stringify({ count: result.inserted, setIds: result.setIds || [] }));
              }
            }
          }
        } catch (e) { /* ignore */ }
        try { sessionStorage.removeItem("ms_anon_intent"); } catch (e) { /* ignore */ }
        router.push("/");
        router.refresh();
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
            onClick={() => { setAwaitingConfirmation(false); setMode("signin"); }}
            className="w-full text-xs text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const legalModalContent = legalModal === "terms"
    ? { title: "Terms of Service", version: TOS_VERSION, updated: TERMS_LAST_UPDATED, body: TERMS_CONTENT }
    : legalModal === "privacy"
    ? { title: "Privacy Policy", version: PRIVACY_VERSION, updated: PRIVACY_LAST_UPDATED, body: PRIVACY_CONTENT }
    : null;

  return (
    <>
      {legalModal && legalModalContent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 500, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--po-border)", background: "var(--po-bg-soft)", flexShrink: 0 }}>
            <div>
              <span style={{ fontWeight: 700, color: "var(--po-text)", fontSize: 15, fontFamily: '"IBM Plex Sans", sans-serif' }}>
                {legalModalContent.title}
              </span>
              <span style={{ display: "block", fontSize: 10, color: "var(--po-text-dim)", fontFamily: '"IBM Plex Mono", monospace', letterSpacing: "0.04em", marginTop: 2 }}>
                v{legalModalContent.version} · {legalModalContent.updated}
              </span>
            </div>
            <button
              onClick={() => setLegalModal(null)}
              style={{ color: "var(--po-text-dim)", background: "none", border: "none", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "4px 8px" }}
              aria-label="Close"
            >
              x
            </button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 32px", background: "var(--po-bg)" }}>
            {renderLegalMarkdown(legalModalContent.body)}
          </div>
        </div>
      )}

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
                  <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">Handle</label>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase())}
                    placeholder="alex_c"
                    required
                    className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
                  />
                  <p className="text-[10px] text-[var(--po-text-dim)] mt-1">Your friend will use this to add you.</p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">Display name</label>
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
              <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
              />
            </div>

            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[var(--po-text-dim)] mb-1">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[var(--po-bg-soft)] border border-[var(--po-border)] text-[var(--po-text)] rounded-lg focus:outline-none focus:border-[var(--po-green)]"
                    style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => setLegalAgreed((v) => !v)}>
                  <div
                    style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                      background: legalAgreed ? "var(--po-green)" : "transparent",
                      border: `2px solid ${legalAgreed ? "var(--po-green)" : "var(--po-border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {legalAgreed && <span style={{ color: "#000", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>v</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--po-text-dim)", lineHeight: 1.6, margin: 0, fontFamily: '"IBM Plex Sans", sans-serif' }}>
                    I am 18 or older and agree to the{" "}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setLegalModal("terms"); }} style={{ color: "var(--po-green)", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline" }}>
                      Terms of Service
                    </button>
                    {" "}and{" "}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setLegalModal("privacy"); }} style={{ color: "var(--po-green)", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline" }}>
                      Privacy Policy
                    </button>
                    .
                  </p>
                </label>
              </>
            )}

            {error && (
              <div className="text-sm text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "signup" && (!legalAgreed || !country))}
              className="w-full py-3 bg-[var(--po-green)] text-black rounded-lg font-black uppercase tracking-widest text-xs disabled:opacity-50 po-glow-green"
            >
              {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          {mode === "signin" && (
            <div className="mt-3 text-center">
              <a href="/forgot-password" style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '0.875rem', color: 'rgba(244,244,246,0.6)', textDecoration: 'none', letterSpacing: '0.05em' }}>
                Forgot password?
              </a>
            </div>
          )}

          <button
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setLegalAgreed(false); }}
            className="w-full mt-4 text-xs text-[var(--po-text-dim)] hover:text-[var(--po-green)]"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center px-4">
          <MasterSetterLogo variant="stacked" height={72} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
