import { Icon } from "../Icon.jsx";
import { BaseIcon } from "../BaseIcon.jsx";
import { VeganBadge, SeasonBadge } from "../Badges.jsx";
import { DifficultyBadge } from "../DifficultyBadge.jsx";
import { cuisineEmoji } from "../../constants/cuisines.js";
import { categoryLabel, categoryEmoji } from "../../constants/recipeCategories.js";

/**
 * Rangée de badges du hero (base, vegan, saison, difficulté, catégorie, cuisine,
 * carnets, ajout au carnet). Partagée entre le hero desktop et mobile ; le conteneur
 * (avec sa ref d'animation côté mobile) reste fourni par chaque hero. `variant` porte
 * les seuls écarts cosmétiques hérités de l'existant (opacité de bordure des tags).
 */
export function RecipeHeroBadges({ recipe, recipeVegan, recipeInSeason, difficulty, difficultyExplain, difficultyTitle, collections, publicMode, onOpenBaseInfo, onOpenDifficulty, onOpenCollections, variant }) {
  const tagBorder = variant === "desktop" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.2)";
  return (
    <>
      {recipe.isComponent && (
        <button onClick={onOpenBaseInfo} aria-label="Préparation de base" className="tag" style={{ gap: 5, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}>
          <BaseIcon size={12} color="#fff" /> Base
        </button>
      )}
      {recipeVegan && (
        <VeganBadge />
      )}
      {recipeInSeason && (
        <SeasonBadge />
      )}
      <DifficultyBadge score={difficulty.score} onImage title={difficultyExplain ? "Voir comment la difficulté est calculée" : difficultyTitle} onClick={difficultyExplain ? onOpenDifficulty : undefined} />
      {categoryLabel(recipe.category) && <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: `1px solid ${tagBorder}` }}><span style={{ fontSize: 12, lineHeight: 1 }}>{categoryEmoji(recipe.category)}</span>{categoryLabel(recipe.category)}</span>}
      {recipe.cuisine && <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: `1px solid ${tagBorder}` }}><span style={{ fontSize: 12, lineHeight: 1 }}>{cuisineEmoji(recipe.cuisine)}</span>{recipe.cuisine}</span>}
      {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
      {!publicMode && <button onClick={onOpenCollections} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: `1px solid ${tagBorder}`, display: "inline-flex", alignItems: "center", gap: 4, ...(variant === "desktop" ? {} : { cursor: "pointer" }) }}><Icon name="plus" size={10} color="#fff" /> Carnet</button>}
    </>
  );
}
