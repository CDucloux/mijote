import type { CSSProperties } from "react";
import { Icon } from "./Icon.jsx";

interface ClearSearchButtonProps {
  onClick: () => void;
  /** Libellé, « Effacer la recherche » par défaut (ex. « Réinitialiser recherche et filtres »). */
  label?: string;
  style?: CSSProperties;
}

// Reset discret des états vides de recherche : pill transparente qui prend un fond
// neutre au survol desktop (`.empty-clear-link`), gomme comprise (currentColor).
export function ClearSearchButton({ onClick, label = "Effacer la recherche", style }: ClearSearchButtonProps) {
  return (
    <button type="button" onClick={onClick} className="empty-clear-link"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, ...style }}>
      <Icon name="eraser" size={15} color="currentColor" /> {label}
    </button>
  );
}
