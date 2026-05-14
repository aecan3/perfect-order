import { MSShell } from "@/components/chrome/MSShell";

export default function ChromePreviewPage() {
  return (
    <MSShell activeTab="sets" unreadCount={3}>
      <div style={{ padding: 16, color: "var(--ms-ink)", fontFamily: '"IBM Plex Sans", sans-serif' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Chrome preview</h1>
        <p style={{ marginBottom: 8, color: "var(--ms-dim)" }}>Active tab: sets</p>
        <p style={{ marginBottom: 16, color: "var(--ms-dim)" }}>Scroll down to test the header border transition.</p>
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i} style={{ marginBottom: 12, color: "var(--ms-faint)", fontSize: 14, lineHeight: 1.6 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
        ))}
      </div>
    </MSShell>
  );
}
