import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Founder analytics dashboard (PART 2). Async server component: gated inline
// (page-level admin check + the in-RPC admin gate = belt-and-suspenders), fetches
// the four PART 1 RPCs server-side with the cookie client so auth.uid() resolves
// to the admin. Read-only; always fresh per request.
export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [1, 7, 30, 90];
const MONO = '"IBM Plex Mono", monospace';
const SANS = '"IBM Plex Sans", system-ui, sans-serif';

const fmt = (n) => (Number(n) || 0).toLocaleString("en-AU");

// Window naming: days=1 is the 24h view; everything else is "last N days".
const windowLabel = (days) => (days === 1 ? "last 24 hours" : `last ${days} days`);
const windowChip = (days) => (days === 1 ? "24h" : `${days}d`);

function surfaceLabel(key) {
  if (key === "find_online_search") return "Find Online (search)";
  if (key === "marketplace_listing") return "Marketplace (buy)";
  return key || "unknown";
}

// ---------- presentational helpers (plain functions — server component) ----------

function NoData() {
  return (
    <span style={{ fontFamily: SANS, fontSize: 12, color: "var(--po-text-faint)", fontStyle: "italic" }}>
      no data yet
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--po-bg-soft)", border: "1px solid var(--po-border)",
      borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 28, lineHeight: 1, color: accent ? "var(--po-green)" : "var(--po-text)" }}>
        {value}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12, color: "var(--po-text-dim)" }}>{label}</div>
      {sub && (
        <div style={{ fontFamily: SANS, fontSize: 10, color: "var(--po-text-faint)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--po-text-dim)", margin: 0 }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function BarRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((Number(value) / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <div style={{ width: 150, flexShrink: 0, fontFamily: SANS, fontSize: 13, color: "var(--po-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--po-green)", borderRadius: 4 }} />
      </div>
      <div style={{ width: 44, textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--po-text)" }}>
        {fmt(value)}
      </div>
    </div>
  );
}

function Sparkline({ data, valueKey }) {
  const w = 100, h = 28;
  const n = data.length || 1;
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(1, ...vals);
  const bw = w / n;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 28, display: "block" }}>
      {vals.map((v, i) => {
        const bh = (v / max) * (h - 1);
        return <rect key={i} x={i * bw} y={h - bh} width={Math.max(0.6, bw - 0.6)} height={bh} fill="var(--po-green)" />;
      })}
    </svg>
  );
}

function TrendRow({ label, data, valueKey, first }) {
  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: first ? "none" : "1px solid var(--po-border)" }}>
      <div style={{ width: 130, flexShrink: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: "var(--po-text)" }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--po-text-faint)" }}>{fmt(total)} total</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {total > 0 ? <Sparkline data={data} valueKey={valueKey} /> : <NoData />}
      </div>
    </div>
  );
}

// ---------- page ----------

export default async function AnalyticsDashboardPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const daysRaw = Number(sp.days);
  const days = ALLOWED_DAYS.includes(daysRaw) ? daysRaw : 1; // default = 24h

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  // Page-level admin gate (house redirect targets). The RPCs are also admin-gated.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");
  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (profile?.is_admin !== true) redirect("/you");

  const [funnelRes, acqRes, ebayRes, dailyRes] = await Promise.all([
    supabase.rpc("dashboard_funnel", { days }),
    supabase.rpc("dashboard_acquisition", { days }),
    supabase.rpc("dashboard_ebay", { days }),
    supabase.rpc("dashboard_daily", { days }),
  ]);

  const f = funnelRes.data?.[0] ?? {};
  const acquisition = acqRes.data ?? [];
  const ebayRows = ebayRes.data ?? [];
  const daily = dailyRes.data ?? [];

  const surfaces = ebayRows.filter((r) => r.dimension === "surface");
  const sets = ebayRows.filter((r) => r.dimension === "set");

  const started = Number(f.signups_started) || 0;
  const completed = Number(f.signups_completed) || 0;
  // started>0 & completed=0 → "—" (cleaner than a misleading 0%); started=0 → hide.
  const conversionLabel = started > 0 ? (completed > 0 ? `${Math.round((completed / started) * 100)}%` : "—") : null;

  const acqMax = Math.max(1, ...acquisition.map((a) => Number(a.signups) || 0));
  const surfaceMax = Math.max(1, ...surfaces.map((s) => Number(s.clicks) || 0));
  const setMax = Math.max(1, ...sets.map((s) => Number(s.clicks) || 0));

  const funnelStages = [
    { label: "Referral landings", value: f.referral_landings, test: true },
    { label: "Anon active sessions", value: f.anon_active_sessions, test: true },
    { label: "Signups started", value: f.signups_started, test: true },
    { label: "Signups completed", value: f.signups_completed, accent: true },
    { label: "Activated", value: f.activated, accent: true },
    { label: "D7 retained", value: f.d7_retained, accent: true },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--po-bg)", color: "var(--po-text)", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header + window switcher */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--po-green)" }}>
              Founder dashboard
            </div>
            <h1 style={{ fontFamily: SANS, fontWeight: 800, fontSize: 28, margin: "2px 0 0", letterSpacing: "-0.01em" }}>
              Analytics
            </h1>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {ALLOWED_DAYS.map((d) => {
              const active = d === days;
              return (
                <a key={d} href={`/admin/analytics?days=${d}`} style={{
                  fontFamily: MONO, fontSize: 12, padding: "6px 12px", borderRadius: 8, textDecoration: "none",
                  border: `1px solid ${active ? "var(--po-green)" : "var(--po-border)"}`,
                  color: active ? "var(--po-green)" : "var(--po-text-dim)",
                  background: active ? "rgba(200,255,74,0.08)" : "transparent",
                }}>
                  {windowChip(d)}
                </a>
              );
            })}
          </div>
        </div>

        {/* FUNNEL */}
        <Section
          title={`Funnel · ${windowLabel(days)}`}
          right={conversionLabel != null ? (
            <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--po-text-dim)" }}>
              started→completed <span style={{ color: "var(--po-green)" }}>{conversionLabel}</span>
            </span>
          ) : null}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 10 }}>
            {funnelStages.map((s, i) => (
              <StatCard
                key={i}
                label={s.label}
                value={fmt(s.value)}
                accent={s.accent && (Number(s.value) || 0) > 0}
                sub={s.test ? "incl. test traffic" : null}
              />
            ))}
          </div>
        </Section>

        {/* ACQUISITION */}
        <Section title="Acquisition · completed signups by channel">
          <div style={{ background: "var(--po-bg-soft)", border: "1px solid var(--po-border)", borderRadius: 12, padding: "10px 16px" }}>
            {acquisition.length > 0
              ? acquisition.map((a, i) => <BarRow key={i} label={a.channel} value={a.signups} max={acqMax} />)
              : <NoData />}
          </div>
        </Section>

        {/* EBAY */}
        <Section title="eBay clicks · revenue intent">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--po-bg-soft)", border: "1px solid var(--po-border)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontFamily: SANS, fontSize: 12, color: "var(--po-text-dim)", marginBottom: 8 }}>By surface</div>
              {surfaces.length > 0
                ? surfaces.map((s, i) => <BarRow key={i} label={surfaceLabel(s.key)} value={s.clicks} max={surfaceMax} />)
                : <NoData />}
            </div>
            <div style={{ background: "var(--po-bg-soft)", border: "1px solid var(--po-border)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontFamily: SANS, fontSize: 12, color: "var(--po-text-dim)", marginBottom: 8 }}>Top sets</div>
              {sets.length > 0
                ? sets.slice(0, 8).map((s, i) => <BarRow key={i} label={s.key} value={s.clicks} max={setMax} />)
                : <NoData />}
            </div>
          </div>
        </Section>

        {/* DAILY TREND */}
        <Section title={`Daily trend · ${windowLabel(days)} (Sydney)`}>
          <div style={{ background: "var(--po-bg-soft)", border: "1px solid var(--po-border)", borderRadius: 12, padding: "4px 16px 12px" }}>
            <TrendRow first label="Signups" data={daily} valueKey="signups" />
            <TrendRow label="eBay clicks" data={daily} valueKey="ebay_clicks" />
            <TrendRow label="Referral landings" data={daily} valueKey="referral_landings" />
          </div>
        </Section>

        <p style={{ fontFamily: SANS, fontSize: 11, color: "var(--po-text-faint)", marginTop: 24, lineHeight: 1.6 }}>
          Anon/top funnel stages include internal &amp; test traffic (no identity to filter on). Completed / activated / D7 exclude
          internal &amp; admin accounts. Pre-launch volumes are expected to be small.
        </p>
      </div>
    </div>
  );
}
