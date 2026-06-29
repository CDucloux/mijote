import { BaseIcon } from "./BaseIcon.jsx";

// ─── AVATAR OFFICIEL « Mijoté » ───────────────────────────────────────────────
// Pastille de marque pour le compte officiel (préparations de base publiées) :
// un dégradé accent + la cocotte, à la place d'un avatar vide. Réutilisé dans le
// hero d'une recette publique et sous les cartes de découverte.
export function OfficialAvatar({ size = 18, ring = false }) {
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
      <BaseIcon size={Math.round(size * 0.62)} color="#fff" />
    </span>
  );
}
