import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { HouseholdPanel } from "./HouseholdPanel.jsx";
import { useHousehold } from "../hooks/useHousehold.js";

// ─── BADGE FOYER (en-tête des écrans partagés) ───────────────────────────────
// Pill discret affiché uniquement quand un foyer est actif : rappelle que les
// données de l'écran (recettes, planning, courses, stock) sont partagées. Cliquable
// pour ouvrir le panneau de gestion du foyer. Ne rend rien en solo.
export function FoyerBadge({ style }) {
  const { household, loading } = useHousehold();
  const [open, setOpen] = useState(false);
  if (loading || !household) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} title="Foyer partagé — gérer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%",
          padding: "4px 11px 4px 9px", borderRadius: 999, cursor: "pointer",
          background: "rgba(232,112,58,0.10)", border: "1px solid rgba(232,112,58,0.28)",
          ...style,
        }}>
        <Icon name="home" size={12} color="var(--accent)" />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Foyer · {household.name}
        </span>
      </button>
      {open && (
        <SwipeableSheet onClose={() => setOpen(false)} style={{ maxHeight: "88dvh" }}>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: "0 0 16px" }}>Foyer</h2>
          <HouseholdPanel onClose={() => setOpen(false)} />
        </SwipeableSheet>
      )}
    </>
  );
}
