import { useState } from "react";
import { Img } from "./Img.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { BaseInfoModal } from "./BaseInfoModal.jsx";
import { Icon } from "./Icon.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { RecipePlaceholder } from "./RecipePlaceholder.jsx";
import { VeganBadge, SeasonBadge } from "./Badges.jsx";
import { fmtTime } from "../lib/format.js";

// `nutriLetter` (optionnel) : lettre recalculée EN DIRECT par l'appelant, pour rester
// alignée sur la fiche détail. Repli sur la valeur figée de la recette si absente.
export function RecipeCard({ recipe, onClick, style, inSeason = false, vegan = false, animate = true, nutriLetter }) {
  const total = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  return (
    <>
    <div role="button" tabIndex={0} className={`recipe-card pressable ripple${animate ? " slide-up" : ""}`} onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(e); } }}
      style={{ width: "100%", display: "block", background: "var(--surface)", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", cursor: "pointer", ...style }}>
      <div className="recipe-card-thumb" style={{ width: "100%", aspectRatio: "16/10", position: "relative" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} fallback={<RecipePlaceholder name={recipe.name} style={{ width: "100%", height: "100%" }} />} />
        {/* Badges empilés en haut à droite */}
        {(vegan || inSeason || recipe.isComponent) && (
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {vegan && <VeganBadge glass />}
            {inSeason && <SeasonBadge glass />}
            {recipe.isComponent && (
              <button onClick={e => { e.stopPropagation(); setShowBaseInfo(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px 4px 7px", borderRadius: 20, background: "rgba(20,18,16,0.74)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", cursor: "pointer" }}>
                <BaseIcon size={12} color="#fff" />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Base</span>
              </button>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3, letterSpacing: "-0.01em", height: "2.6em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{recipe.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>
            <span style={{ width: 1, height: 10, background: "var(--border)", display: "inline-block", borderRadius: 1 }} />
            <span>{recipe.ingredients?.length || 0} ingr.</span>
          </span>
          <NutriScoreBadge letter={nutriLetter ?? recipe.nutriLetter} compact />
        </div>
      </div>
    </div>
    {showBaseInfo && <BaseInfoModal onClose={() => setShowBaseInfo(false)} />}
    </>
  );
}
