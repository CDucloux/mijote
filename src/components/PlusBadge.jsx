import { Icon } from "./Icon.jsx";

/** Badge « Mijoté+ » (pastille accent + étincelle). Signale une fonctionnalité
 * de l'offre premium. `size` : "sm" (en ligne dans une liste) ou "lg" (hero). */
export function PlusBadge({ size = "sm" }) {
  const s = size === "sm" ? { fs: 10.5, pad: "2px 8px", icon: 10 } : { fs: 13, pad: "4px 12px", icon: 13 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: s.pad, borderRadius: 999, background: "var(--accent)", color: "#fff", fontFamily: "var(--ff-display)", fontSize: s.fs + 0.5, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      <Icon name="sparkle" size={s.icon} color="#ffd27a" /> <span>Mijoté<span style={{ color: "#ffd27a", fontWeight: 800, fontSize: "1.15em", verticalAlign: "-0.02em" }}>+</span></span>
    </span>
  );
}
