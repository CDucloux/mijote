import { Icon } from "./Icon.jsx";

/** Badge « Admin » (pastille violette + bouclier). Signale un compte administrateur
 *  — notamment que les quotas (imports IA, limite de recettes…) ne s'appliquent pas.
 *  Même gabarit que {@link PlusBadge}. `size` : "sm" (en ligne) ou "lg" (hero). */
export function AdminBadge({ size = "sm" }) {
  const s = size === "sm" ? { fs: 10.5, pad: "2px 8px", icon: 10 } : { fs: 13, pad: "4px 12px", icon: 13 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: s.pad, borderRadius: 999, background: "#8b6ff0", color: "#fff", fontFamily: "var(--ff-display)", fontSize: s.fs + 0.5, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      <Icon name="shield" size={s.icon} color="#fff" /> <span>Admin</span>
    </span>
  );
}
