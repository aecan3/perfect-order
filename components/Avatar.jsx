"use client";

export function Avatar({ profile, size = 40, themePrimary = "#b9ff3c" }) {
  const letter = ((profile?.display_name || profile?.handle || "?")[0]).toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name || profile.handle}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: themePrimary,
        color: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontWeight: 900,
        fontSize: Math.round(size * 0.42),
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {letter}
    </div>
  );
}
