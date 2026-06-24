import { Img } from "./Img.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { Icon } from "./Icon.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { fmtTime } from "../lib/format.js";

export function RecipeCard({ recipe, onClick, style }) {
  const total = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  return (
    <button className="slide-up recipe-card" onClick={onClick} style={{ background: "var(--surface)", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", ...style }}>
      <div className="recipe-card-thumb" style={{ aspectRatio: "16/10", position: "relative" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to top,rgba(0,0,0,0.65),transparent)" }} />
        {recipe.isComponent && (
          <span style={{ position: "absolute", top: 8, right: 8, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 6px", borderRadius: 20, background: "rgba(210,96,40,0.88)", backdropFilter: "blur(4px)", pointerEvents: "none" }}>
            <BaseIcon size={11} color="#fff" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>Base</span>
          </span>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3, letterSpacing: "-0.01em", height: "2.6em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{recipe.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>
            <span style={{ width: 1, height: 10, background: "var(--border)", display: "inline-block", borderRadius: 1 }} />
            <span>{recipe.ingredients?.length || 0} ingr.</span>
          </span>
          <NutriScoreBadge letter={recipe.nutriLetter} compact />
        </div>
      </div>
    </button>
  );
}
