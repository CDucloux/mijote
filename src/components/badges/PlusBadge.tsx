import { Icon } from "../ui/Icon.jsx";

export type BadgeSize = "sm" | "lg";

interface BadgeGeometry {
  fs: number;
  h: number;
  padX: number;
  icon: number;
}

// Géométrie partagée avec AdminBadge → hauteur FIXE (indépendante du texte, ex. le
// « + » n'agrandit plus la pastille) pour que les deux badges s'alignent parfaitement.
export const BADGE_SIZES: Record<BadgeSize, BadgeGeometry> = {
  sm: { fs: 11, h: 22, padX: 9, icon: 10 },
  lg: { fs: 13.5, h: 28, padX: 13, icon: 13 },
};

interface PlusBadgeProps {
  size?: BadgeSize;
}

/** Badge « Cardamome+ » (pastille accent + étincelle). Signale une fonctionnalité
 * de l'offre premium. `size` : "sm" (en ligne dans une liste) ou "lg" (hero). */
export function PlusBadge({ size = "sm" }: PlusBadgeProps) {
  const geom = BADGE_SIZES[size] || BADGE_SIZES.sm;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: geom.h, padding: `0 ${geom.padX}px`, boxSizing: "border-box", lineHeight: 1, borderRadius: 999, background: "var(--accent)", color: "#fff", fontFamily: "var(--ff-display)", fontSize: geom.fs, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      <Icon name="sparkle" size={geom.icon} color="#fff" /> <span>Cardamome<span style={{ fontWeight: 800, fontSize: "1.22em", verticalAlign: "-0.02em" }}>+</span></span>
    </span>
  );
}
