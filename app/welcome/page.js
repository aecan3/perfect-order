"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { MasterSetterLogo } from "@/components/MasterSetterLogo";
import InstallGuide from "@/components/InstallGuide";

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/");
    });
  }, []);

  // Forward all intent + returnTo params through to the login page
  const queryString = searchParams.toString();
  const signupHref = queryString ? `/login?mode=signup&${queryString}` : "/login?mode=signup";
  const signinHref = queryString ? `/login?${queryString}` : "/login";

  const sharerHandle = searchParams.get("sharerHandle");
  const targetCardName = searchParams.get("targetCardName");

  return (
    <div className="min-h-screen bg-[var(--po-bg)] text-[var(--po-text)] flex flex-col px-6 py-12 max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center">
        <MasterSetterLogo variant="stacked" height={96} className="mb-3 mx-auto" />
        <p className="mb-10" style={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(244,244,246,0.6)', textAlign: 'center' }}>
          Collect. Trade. Complete.
        </p>

        {/* Intent banner — shown when arriving from a Trade Binder tap */}
        {sharerHandle && (
          <div style={{
            marginBottom: 20,
            padding: "12px 16px",
            background: "rgba(200,255,74,0.08)",
            border: "0.5px solid rgba(200,255,74,0.25)",
            borderRadius: "var(--border-radius-md)",
            fontSize: 14,
            color: "var(--po-green)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            Sign up to message @{sharerHandle}
            {targetCardName ? ` about "${targetCardName}"` : " about this card"}
          </div>
        )}

        <div className="space-y-3 mb-12">
          <Link
            href={signupHref}
            className="block w-full py-3.5 bg-[var(--po-green)] text-black rounded-xl font-black text-sm uppercase tracking-widest text-center po-glow-green"
          >
            Create Account
          </Link>
          <Link
            href={signinHref}
            className="block w-full py-3.5 border border-[var(--po-border)] text-[var(--po-text)] rounded-xl font-bold text-sm uppercase tracking-widest text-center hover:border-[var(--po-green)] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sets"
            className="block w-full py-3 text-[var(--po-text-dim)] rounded-xl font-bold text-sm uppercase tracking-widest text-center hover:text-[var(--po-text)] transition-colors"
          >
            View our Master Sets
          </Link>
        </div>

        <InstallGuide />
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--po-bg)] flex items-center justify-center">
        <MasterSetterLogo variant="stacked" height={96} />
      </div>
    }>
      <WelcomeContent />
    </Suspense>
  );
}
