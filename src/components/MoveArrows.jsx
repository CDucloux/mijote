import { useState } from "react";
import { Icon } from "./Icon.jsx";

// Flèche ronde (monter/descendre) : fond qui n'apparaît qu'au survol (ghost),
// chevron SVG net. Désactivée aux extrémités.
function ArrowBtn({ dir, disabled, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 26, height: 26, borderRadius: "50%", border: "none", display: "grid", placeItems: "center", cursor: disabled ? "default" : "pointer", background: !disabled && hover ? "var(--surface2)" : "transparent", opacity: disabled ? 0.3 : 1, transition: "background 0.15s" }}>
      <Icon name={dir === "up" ? "chevronUp" : "chevronDown"} size={15} color="var(--text2)" />
    </button>
  );
}

/** Boutons monter/descendre (réordonnancement au clic, sur desktop). */
export function MoveArrows({ index, total, onMove, vertical = true }) {
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 2, flexShrink: 0 }}>
      <ArrowBtn dir="up" disabled={index === 0} onClick={() => index > 0 && onMove(index, index - 1)} />
      <ArrowBtn dir="down" disabled={index === total - 1} onClick={() => index < total - 1 && onMove(index, index + 1)} />
    </div>
  );
}
