import { Icon } from "../Icon.jsx";
import { NutriScoreBadge } from "../NutriScoreBadge.jsx";
import { fmtTime } from "../../lib/format.js";

/**
 * Bloc mobile juste sous le hero : stats (préparation, cuisson, Nutri-Score) et actions
 * principales (Courses / Planifier), ou le CTA « Garder » en mode public. Présentationnel.
 */
export function RecipeStatsMobile({ recipe, nutriLetter, publicMode, keepCta, onOpenNutrition, onOpenShopping, onOpenMealPlan }) {
  return (
    <div style={{
      // Chevauche le bas du hero et arrondit la transition image / contenu : la
      // remontée fait ré-apparaître l'image dans les deux coins hauts (fin de coupe droite).
      padding: "28px 16px 14px", flexShrink: 0,
      position: "relative", zIndex: 1, background: "var(--bg)",
      marginTop: -18, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    }}>
      <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", borderRadius: 16, padding: "14px 8px", marginBottom: 12, border: "1px solid var(--border)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <Icon name="clock" size={13} color="var(--text3)" />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtTime(recipe.prepTime)}</span>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>Prép.</span>
        </div>
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <Icon name="fire" size={13} color="var(--text3)" />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtTime(recipe.cookTime)}</span>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>Cuisson</span>
        </div>
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
        <button onClick={onOpenNutrition} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer" }}>
          <NutriScoreBadge letter={nutriLetter} />
          <span style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 2 }}>Nutri-Score <Icon name="forward" size={9} color="var(--text3)" /></span>
        </button>
      </div>
      {publicMode ? (
        <div>{keepCta}</div>
      ) : (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onOpenShopping} className="tap" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "1px solid transparent", cursor: "pointer" }}>
          <Icon name="shopping" size={14} color="#fff" /> Courses
        </button>
        <button onClick={onOpenMealPlan} className="tap" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "1px solid var(--border)", cursor: "pointer" }}>
          <Icon name="calendar" size={14} color="var(--text)" /> Planifier
        </button>
      </div>
      )}
    </div>
  );
}
