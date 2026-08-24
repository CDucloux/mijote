import { Icon } from "../Icon.jsx";
import { NutriScoreBadge } from "../NutriScoreBadge.jsx";
import { fmtTime } from "../../lib/format.js";

/**
 * Barre d'infos desktop (carte arrondie façon mobile) : préparation, cuisson,
 * Nutri-Score cliquable et sélecteur de portions. Présentationnel.
 */
export function RecipeInfoBarDesktop({ recipe, nutriLetter, servings, setServings, onOpenNutrition }) {
  return (
    <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "stretch", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "10px 0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {/* Prép. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <Icon name="clock" size={12} color="var(--text3)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtTime(recipe.prepTime)}</span>
          </div>
          <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Prép.</span>
        </div>
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
        {/* Cuisson */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <Icon name="fire" size={12} color="var(--text3)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtTime(recipe.cookTime)}</span>
          </div>
          <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Cuisson</span>
        </div>
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
        {/* Nutri-Score */}
        <button onClick={onOpenNutrition} title="Analyse nutritionnelle" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <NutriScoreBadge letter={nutriLetter} />
          </div>
          <span style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 2, marginTop: 3 }}>Nutri-Score <Icon name="forward" size={9} color="var(--text3)" /></span>
        </button>
        <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
        {/* Portions */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", border: "none", cursor: "pointer", lineHeight: 1 }}>
              <svg width="10" height="2" viewBox="0 0 10 2"><rect x="0" y="0" width="10" height="2" rx="1" fill="currentColor"/></svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 18, textAlign: "center" }}>{servings}</span>
            <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", border: "none", cursor: "pointer", lineHeight: 1 }}>
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" y="0" width="2" height="10" rx="1" fill="currentColor"/><rect x="0" y="4" width="10" height="2" rx="1" fill="currentColor"/></svg>
            </button>
          </div>
          <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Portions</span>
        </div>
      </div>
    </div>
  );
}
