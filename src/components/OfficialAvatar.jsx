// ─── AVATAR OFFICIEL « Cardamome » ────────────────────────────────────────────
// Pastille de marque pour le compte officiel (recettes & bases publiées) : la
// gousse de cardamome (comme le favicon), sur un rond d'accent plat. On n'utilise
// plus la louche, réservée aux préparations de base, pour éviter toute confusion.
export function OfficialAvatar({ size = 18, ring = false }) {
  const m = Math.round(size * 0.82);
  return (
    <span
      aria-label="Cardamome"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "var(--accent)",
        boxShadow: ring ? "0 0 0 1.5px rgba(255,255,255,0.55)" : "none",
      }}
    >
      <svg width={m} height={m} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="#10120e" />
        <g stroke="var(--accent)" strokeLinecap="round" fill="none">
          <path d="M50 26 C50 41 50 61 50 74" strokeWidth="3.4" />
          <path d="M43 31 C40.5 45 42 59 47 72" strokeWidth="2.8" />
          <path d="M57 31 C59.5 45 58 59 53 72" strokeWidth="2.8" />
        </g>
      </svg>
    </span>
  );
}
