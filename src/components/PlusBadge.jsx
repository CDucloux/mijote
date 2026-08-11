import { Icon } from "./Icon.jsx";

/** Badge « Mijoté+ » (pastille accent + étincelle). Signale une fonctionnalité
 * de l'offre premium. `size` : "sm" (en ligne dans une liste) ou "lg" (hero). */
// Géométrie partagée avec AdminBadge → hauteur FIXE (indépendante du texte, ex. le
// « + » n'agrandit plus la pastille) pour que les deux badges s'alignent parfaitement.
export const BADGE_SIZES = {
  sm: { fs: 11, h: 22, padX: 9, icon: 10 },
  lg: { fs: 13.5, h: 28, padX: 13, icon: 13 },
};

export function PlusBadge({ size = "sm" }) {
  const s = BADGE_SIZES[size] || BADGE_SIZES.sm;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: s.h, padding: `0 ${s.padX}px`, boxSizing: "border-box", lineHeight: 1, borderRadius: 999, background: "var(--accent)", color: "#fff", fontFamily: "var(--ff-display)", fontSize: s.fs, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      <Icon name="sparkle" size={s.icon} color="#fff" /> <span>Mijoté<span style={{ fontWeight: 800, fontSize: "1.22em", verticalAlign: "-0.02em" }}>+</span></span>
    </span>
  );
}
