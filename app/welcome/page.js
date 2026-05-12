"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";

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
        <MasterSetterLogo variant="stacked" height={96} className="mb-3 mx-auto" />
        <p className="mb-10" style={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(244,244,246,0.6)' }}>
          Collect. Trade. Complete.
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
                  {[
                    { n: 1, text: <>Open this page in <span className="font-bold">Safari</span> (not Chrome)</> },
                    { n: 2, text: <>Tap the <span className="font-bold">...</span> button in the bottom-right corner of Safari</>, icon: true },
                    { n: 3, text: <>Tap <span className="font-bold">Share</span></> },
                    { n: 4, text: <>Tap <span className="font-bold">View More</span></> },
                    { n: 5, text: <>Tap <span className="font-bold">Add to Home Screen</span></> },
                    { n: 6, text: <>Tap <span className="font-bold">Add</span> in the top right</> },
                  ].map(({ n, text, icon }) => (
                    <li key={n} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                        style={{ background: "var(--po-green)", color: "#050507" }}
                      >
                        {n}
                      </span>
                      <div>
                        <p className="text-sm text-[var(--po-text)]">{text}</p>
                        {icon && (
                          <div
                            className="mt-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md"
                            style={{ background: "var(--po-bg)", border: "1px solid var(--po-border)" }}
                          >
                            <span className="text-sm font-black tracking-tighter text-[var(--po-text)]">...</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {platform === "other" && (
              <p className="text-sm text-[var(--po-text-dim)]">
                For the best experience, open Master Setter in{" "}
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
