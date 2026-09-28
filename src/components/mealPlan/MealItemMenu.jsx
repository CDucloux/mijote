import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";

/**
 * Menu contextuel d'un repas planifié (clic droit / appui long) : ouvrir la recette,
 * replanifier, dupliquer, supprimer. Les actions sont déléguées au parent.
 */
export function MealItemMenu({ item, recipe, onOpen, onReschedule, onDuplicate, onRemove, onClose }) {
  const slotLabel = SLOT_BY_ID[item.slot]?.label || "Repas";
  const dateLabel = new Date(item.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: "hidden", background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 24 }}>
          {recipe?.image ? <img src={recipe.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🍽️"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipe?.name || "Recette supprimée"}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>{slotLabel} · {dateLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {recipe && (
          <button className="menu-row" onPointerDown={spawnRipple} onClick={onOpen}>
            <Icon name="forward" size={19} color="var(--text2)" /> Ouvrir
          </button>
        )}
        <button className="menu-row" onPointerDown={spawnRipple} onClick={onReschedule}>
          <Icon name="calendar" size={19} color="var(--text2)" /> Replanifier
        </button>
        {recipe && (
          <button className="menu-row" onPointerDown={spawnRipple} onClick={onDuplicate}>
            <Icon name="copy" size={19} color="var(--text2)" /> Dupliquer sur d'autres jours
          </button>
        )}
        <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6 }} onPointerDown={spawnRipple} onClick={onRemove}>
          <Icon name="trash" size={19} color="var(--red)" /> Supprimer du calendrier
        </button>
      </div>
    </SwipeableSheet>
  );
}
