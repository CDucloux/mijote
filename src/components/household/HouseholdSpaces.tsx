import type { CSSProperties } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";

// Les 4 espaces mis en commun dans un foyer (recettes, planning, courses, stock),
// rendus en pastilles cohérentes. Source unique réutilisée par le panneau Foyer,
// la modale d'invitation et la modale de bienvenue (mêmes libellés / icônes).
const ESPACES: { icon: IconName; label: string }[] = [
  { icon: "book", label: "Recettes" },
  { icon: "calendar", label: "Planning" },
  { icon: "shopping", label: "Courses" },
  { icon: "box", label: "Stock" },
];

interface HouseholdSpacesProps {
  /** Styles additionnels du conteneur (ex. marge). */
  style?: CSSProperties;
  /** Si défini (en s), révèle chaque pastille en cascade à partir de ce délai. */
  stagger?: number;
}

/**
 * Rangée de pastilles listant les 4 espaces partagés d'un foyer, disposées en
 * grille 2x2 (Recettes/Planning, puis Courses/Stock) pour un bloc équilibré.
 */
export function HouseholdSpaces({ style, stagger }: HouseholdSpacesProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, ...style }}>
      {[ESPACES.slice(0, 2), ESPACES.slice(2)].map((row, r) => (
        <div key={r} style={{ display: "flex", gap: 7 }}>
          {row.map(({ icon, label }, i) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--surface)", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 999, padding: "5px 11px", animation: stagger != null ? `foyerRise 0.42s ${stagger + (r * 2 + i) * 0.07}s both ease` : undefined }}>
              <Icon name={icon} size={13} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
