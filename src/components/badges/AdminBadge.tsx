import { Icon } from "../ui/Icon.jsx";
import { BADGE_SIZES, type BadgeSize } from "./PlusBadge.jsx";

interface AdminBadgeProps {
  size?: BadgeSize;
}

/** Badge « Admin » (pastille violette + bouclier). Signale un compte administrateur,
 *  notamment que les quotas (imports IA, limite de recettes…) ne s'appliquent pas.
 *  Même gabarit/hauteur que {@link PlusBadge}, mais en police de CORPS (pas la police d'affichage).
 *  `size` : "sm" (en ligne) ou "lg" (hero). */
export function AdminBadge({ size = "sm" }: AdminBadgeProps) {
  const geom = BADGE_SIZES[size] || BADGE_SIZES.sm;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: geom.h, padding: `0 ${geom.padX}px`, boxSizing: "border-box", lineHeight: 1, borderRadius: 999, background: "var(--admin)", color: "#fff", fontFamily: "var(--ff-body)", fontSize: geom.fs, fontWeight: 600, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
      <Icon name="shield" size={geom.icon + 3} color="#fff" /> <span>ADMIN</span>
    </span>
  );
}
