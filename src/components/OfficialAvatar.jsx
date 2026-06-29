// ─── AVATAR OFFICIEL « Mijoté » ───────────────────────────────────────────────
// Pastille de marque pour le compte officiel (recettes & bases publiées) : un
// dégradé accent + le monogramme « M » (comme le favicon). On n'utilise plus la
// louche, réservée aux préparations de base, pour éviter toute confusion.
export function OfficialAvatar({ size = 18, ring = false }) {
  const m = Math.round(size * 0.6);
  return (
    <span
      aria-label="Mijoté"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #f0993a, #e8703a)",
        boxShadow: ring ? "0 0 0 1.5px rgba(255,255,255,0.55)" : "none",
      }}
    >
      <svg width={m} height={m} viewBox="0 0 24 24" fill="none" stroke="#fff6ee" strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round">
        <path d="M5 18 V7 L12 15 L19 7 V18" />
      </svg>
    </span>
  );
}
