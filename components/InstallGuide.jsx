"use client";

import { useEffect, useState } from "react";

export default function InstallGuide() {
  // "android" | "ios-safari" | "ios-other" | "other" | null (pre-hydration)
  const [platform, setPlatform] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installDone, setInstallDone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isSafari = isIOS && !/CriOS/.test(ua) && !/FxiOS/.test(ua);

    if (isAndroid) setPlatform("android");
    else if (isIOS && isSafari) setPlatform("ios-safari");
    else if (isIOS) setPlatform("ios-other");
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

  // Gate on platform resolved AND not already installed — no pre-hydration card flash
  if (platform === null || isStandalone) return null;

  return (
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
              <span className="font-bold text-[var(--po-text)]">Chrome</span> on Android, then tap
              the menu and choose{" "}
              <span className="font-bold text-[var(--po-text)]">Add to Home Screen</span>.
            </p>
          )}
        </>
      )}

      {platform === "ios-other" && (
        <p className="text-sm text-[var(--po-text-dim)] leading-relaxed">
          Open this page in{" "}
          <span className="font-bold text-[var(--po-text)]">Safari</span> to add Master Setter to
          your home screen — Chrome and Firefox on iOS don{"'"}t support it.
        </p>
      )}

      {platform === "ios-safari" && (
        <ol className="space-y-3">
          {[
            {
              n: 1,
              text: <>Make sure you{"'"}re in <span className="font-bold">Safari</span></>,
            },
            {
              n: 2,
              text: (
                <>
                  Tap the <span className="font-bold">Share</span> icon (square with arrow up) —
                  bottom bar on most iPhones, or via the{" "}
                  <span className="font-bold">...</span> menu on newer layouts
                </>
              ),
            },
            {
              n: 3,
              text: (
                <>
                  Scroll down and tap{" "}
                  <span className="font-bold">Add to Home Screen</span> (or{" "}
                  <span className="font-bold">Edit Actions</span> if missing, then toggle it on)
                </>
              ),
            },
            {
              n: 4,
              text: (
                <>
                  Tap <span className="font-bold">Add</span> in the top-right
                </>
              ),
            },
          ].map(({ n, text }) => (
            <li key={n} className="flex items-start gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                style={{ background: "var(--po-green)", color: "#050507" }}
              >
                {n}
              </span>
              <p className="text-sm text-[var(--po-text)]">{text}</p>
            </li>
          ))}
        </ol>
      )}

      {platform === "other" && (
        <p className="text-sm text-[var(--po-text-dim)]">
          For the best experience, open Master Setter in{" "}
          <span className="font-bold text-[var(--po-text)]">Safari on iPhone</span> or{" "}
          <span className="font-bold text-[var(--po-text)]">Chrome on Android</span> and add it to
          your home screen.
        </p>
      )}
    </div>
  );
}
