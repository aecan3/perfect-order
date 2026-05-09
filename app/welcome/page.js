"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const BRAND = "PokéBinder";

export default function WelcomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [platform, setPlatform] = useState(null); // "android" | "ios" | "other"
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installDone, setInstallDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/");
    });
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);

    if (isIOS) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
    else setPlatform("other");

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstallDone(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)] flex flex-col px-6 py-12 max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="po-wordmark text-5xl mb-3">{BRAND}</h1>
        <p className="text-[var(--po-text-dim)] text-base leading-relaxed mb-10">
          Track your collection.<br />Trade with friends.
        </p>

        <div className="space-y-3 mb-12">
          <Link
            href="/login?mode=signup"
            className="block w-full py-3.5 bg-[var(--po-green)] text-black rounded-xl font-black text-sm uppercase tracking-widest text-center po-glow-green"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="block w-full py-3.5 border border-[var(--po-border)] text-[var(--po-text)] rounded-xl font-bold text-sm uppercase tracking-widest text-center hover:border-[var(--po-green)] transition-colors"
          >
            Sign In
          </Link>
        </div>

        {!isStandalone && (
          <div
            className="rounded-2xl border border-[var(--po-border)] p-5"
            style={{ background: "var(--po-bg-soft)" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--po-text-dim)] mb-3">
              Add to Home Screen
            </p>

            {platform === "android" && (
              <>
                {deferredPrompt && !installDone ? (
                  <button
                    onClick={triggerInstall}
                    className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-black po-glow-green"
                    style={{ background: "var(--po-green)" }}
                  >
                    Install App
                  </button>
                ) : installDone ? (
                  <p className="text-sm font-bold" style={{ color: "var(--po-green)" }}>
                    Installed! Open from your home screen.
                  </p>
                ) : (
                  <p className="text-sm text-[var(--po-text-dim)]">
                    Open this page in{" "}
                    <span className="font-bold text-[var(--po-text)]">Chrome</span> on Android,
                    then tap the menu and choose{" "}
                    <span className="font-bold text-[var(--po-text)]">Add to Home Screen</span>.
                  </p>
                )}
              </>
            )}

            {platform === "ios" && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--po-text-dim)] leading-relaxed">
                  Apple only allows this through Safari &mdash; it won{"'"}t work in Chrome on iPhone.
                </p>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                      style={{ background: "var(--po-green)", color: "#050507" }}
                    >
                      1
                    </span>
                    <p className="text-sm text-[var(--po-text)]">
                      Open this page in <span className="font-bold">Safari</span>
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                      style={{ background: "var(--po-green)", color: "#050507" }}
                    >
                      2
                    </span>
                    <div>
                      <p className="text-sm text-[var(--po-text)]">
                        Tap the <span className="font-bold">Share icon</span> at the bottom of the screen
                      </p>
                      {/* iOS Share icon — box with arrow pointing up */}
                      <svg
                        className="mt-1.5"
                        width="28" height="28" viewBox="0 0 24 24" fill="none"
                        stroke="var(--po-text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                      style={{ background: "var(--po-green)", color: "#050507" }}
                    >
                      3
                    </span>
                    <p className="text-sm text-[var(--po-text)]">
                      Scroll down and tap <span className="font-bold">Add to Home Screen</span>
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                      style={{ background: "var(--po-green)", color: "#050507" }}
                    >
                      4
                    </span>
                    <p className="text-sm text-[var(--po-text)]">
                      Tap <span className="font-bold">Add</span> in the top-right corner
                    </p>
                  </li>
                </ol>
              </div>
            )}

            {platform === "other" && (
              <p className="text-sm text-[var(--po-text-dim)]">
                For the best experience, open {BRAND} in{" "}
                <span className="font-bold text-[var(--po-text)]">Safari on iPhone</span> or{" "}
                <span className="font-bold text-[var(--po-text)]">Chrome on Android</span> and add
                it to your home screen.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
