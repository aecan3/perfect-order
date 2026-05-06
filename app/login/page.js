"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("signin"); // "signin" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      // Validate handle (lowercase letters, numbers, underscores; 3-20 chars)
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
        setError("Handle must be 3-20 chars: lowercase letters, numbers, underscores only.");
        setLoading(false);
        return;
      }

      // Check handle availability first
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Create profile row
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          handle: handle.toLowerCase(),
          display_name: displayName || handle,
        });
        if (profileError) {
          setError("Account created but profile failed: " + profileError.message);
          setLoading(false);
          return;
        }
      }

      router.push("/");
      router.refresh();
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4" style={{ fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-black mb-1 text-stone-900">Perfect Order</h1>
        <p className="text-sm text-stone-500 mb-6">
          {mode === "signup" ? "Create your collection" : "Sign in to your collection"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1">
                  Handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="alex_c"
                  required
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-700"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Your friend will use this to add you.
                </p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-700"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-700"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-700"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-stone-900 text-white rounded-lg font-bold uppercase tracking-widest text-xs disabled:opacity-50"
          >
            {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="w-full mt-4 text-xs text-stone-500 hover:text-stone-900"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Don't have an account? Create one"}
        </button>
      </div>
    </div>
  );
}
