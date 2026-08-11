import { Icon } from "./Icon.jsx";
import { BADGE_SIZES } from "./PlusBadge.jsx";

/** Badge « Admin » (pastille violette + bouclier). Signale un compte administrateur
 *  — notamment que les quotas (imports IA, limite de recettes…) ne s'appliquent pas.
 *  Même gabarit/hauteur que {@link PlusBadge}, mais en police de CORPS (pas Fraunces).
 *  `size` : "sm" (en ligne) ou "lg" (hero). */
export function AdminBadge({ size = "sm" }) {
  const s = BADGE_SIZES[size] || BADGE_SIZES.sm;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: s.h, padding: `0 ${s.padX}px`, boxSizing: "border-box", lineHeight: 1, borderRadius: 999, background: "#8b6ff0", color: "#fff", fontFamily: "var(--ff-body)", fontSize: s.fs, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
      <Icon name="shield" size={s.icon} color="#fff" /> <span>Admin</span>
    </span>
  );
}
