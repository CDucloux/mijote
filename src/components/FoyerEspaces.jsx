import { Icon } from "./Icon.jsx";

// ─── PASTILLES DES ESPACES PARTAGÉS ───────────────────────────────────────────
// Les 4 espaces mis en commun dans un foyer (recettes, planning, courses, stock),
// rendus en pastilles cohérentes. Source unique réutilisée par le panneau Foyer,
// la modale d'invitation et la modale de bienvenue (mêmes libellés / icônes).
const ESPACES = [
  { icon: "book", label: "Recettes" },
  { icon: "calendar", label: "Planning" },
  { icon: "shopping", label: "Courses" },
  { icon: "box", label: "Stock" },
];

/**
 * Rangée de pastilles listant les 4 espaces partagés d'un foyer.
 *
 * @param {{ style?: import("react").CSSProperties }} props
 * @param props.style - Styles additionnels du conteneur (ex. marge).
 */
export function FoyerEspaces({ style }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, ...style }}>
      {ESPACES.map(({ icon, label }) => (
        <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface)", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 999, padding: "5px 11px" }}>
          <Icon name={icon} size={13} color="var(--accent)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        </span>
      ))}
    </div>
  );
}
