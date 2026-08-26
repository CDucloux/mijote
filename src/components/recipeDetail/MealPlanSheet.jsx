import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";
import { MEAL_SLOTS } from "../../constants/mealSlots.js";

/**
 * Feuille d'ajout de la recette au planning : choix du jour et du repas (contrôle
 * segmenté à pastille glissante). Présentationnel ; l'insertion réelle est faite par le
 * parent via `onConfirm`.
 */
export function MealPlanSheet({ mealDate, setMealDate, mealSlot, setMealSlot, onClose, onConfirm }) {
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)" }}>
          <Icon name="calendar" size={22} color="var(--accent)" />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Ajouter au planning</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "2px 0 0" }}>Choisis le jour et le repas.</p>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 9 }}>Date</span>
        <input type="date" className="field-input" value={mealDate} onChange={e => setMealDate(e.target.value)} />
      </div>

      <div style={{ marginBottom: 22 }}>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 9 }}>Repas</span>
        {/* Contrôle segmenté avec pastille glissante, identique à la sheet du planning */}
        <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14 }}>
          <div aria-hidden="true" style={{
            position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${MEAL_SLOTS.length})`,
            background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            transform: `translateX(calc(${Math.max(0, MEAL_SLOTS.findIndex(s => s.id === mealSlot))} * 100%))`,
            transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
          {MEAL_SLOTS.map(s => {
            const active = mealSlot === s.id;
            return (
              <button key={s.id} onClick={() => setMealSlot(s.id)}
                style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
                  background: "transparent", color: active ? s.text : "var(--text3)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "color 0.3s ease" }}>
                <span style={{ fontSize: 14 }}>{s.emoji}</span>{s.label}
              </button>
            );
          })}
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "13px 0" }} onClick={onConfirm}><Icon name="check" size={16} /> Confirmer</button>
    </SwipeableSheet>
  );
}
