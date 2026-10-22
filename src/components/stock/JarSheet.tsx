import type { CSSProperties } from "react";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { RecipeImage } from "../recipe/RecipePlaceholder.jsx";
import { fmtTime } from "@/lib/format.js";
import type { StockLevel, RecipeUsingIngredient } from "@/lib/food/stockLevel.js";
import type { IngredientDbItem } from "@/lib/types.js";

/** Recettes montrées dans la feuille ; la suite est dans la bibliothèque filtrée. */
const SHOWN_RECIPES = 3;

// Chaque choix est un bocal miniature dont le remplissage reprend celui de l'étagère.
const LEVELS: readonly { level: StockLevel; label: string; fill: string }[] = [
  { level: "full", label: "Plein", fill: "72%" },
  { level: "low", label: "Bientôt vide", fill: "28%" },
  { level: "empty", label: "À racheter", fill: "0%" },
];

interface JarSheetProps {
  ingredient: IngredientDbItem;
  level: StockLevel;
  /** Libellé du rayon (catégorie) sous le nom. */
  shelfLabel: string;
  /** Teinte du contenu du bocal, reprise par les bocaux miniatures. */
  fillColor: string;
  /** Recettes utilisant l'ingrédient, déjà triées (cf. `recipesUsingIngredient`). */
  recipes: RecipeUsingIngredient[];
  onSetLevel: (level: StockLevel) => void;
  onOpenIngredient: () => void;
  onOpenRecipe: (recipeId: string) => void;
  onSeeAllRecipes: () => void;
  onClose: () => void;
}

/** Ce qu'il reste à réunir pour une recette, dit comme on le dirait. */
function missingLabel(missing: string[]): string {
  if (!missing.length) return "Tout est en stock";
  const shown = missing.slice(0, 2).map(m => m.toLowerCase()).join(", ");
  return `Il manque ${shown}${missing.length > 2 ? ` +${missing.length - 2}` : ""}`;
}

/**
 * Menu d'un bocal, ouvert par un appui long sur l'étagère : niveau en un geste,
 * recettes à cuisiner avec l'ingrédient, accès à sa fiche. Les navigations
 * referment d'abord la feuille (sortie animée) puis agissent.
 */
export function JarSheet({ ingredient, level, shelfLabel, fillColor, recipes, onSetLevel, onOpenIngredient, onOpenRecipe, onSeeAllRecipes, onClose }: JarSheetProps) {
  const shown = recipes.slice(0, SHOWN_RECIPES);
  return (
    <SwipeableSheet onClose={onClose} style={{ "--fill": fillColor, paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" } as CSSProperties}>
      {(close: (after?: () => void) => void) => {
        // `close(cb)` exécute `cb` À LA PLACE de `onClose` : on referme donc nous-mêmes avant d'agir.
        const leaveThen = (action: () => void) => close(() => { onClose(); action(); });
        return (
        <div className="jsheet">
          <button type="button" className="jsheet-head" onClick={() => leaveThen(onOpenIngredient)}>
            <IngImage src={ingredient.image} alt="" size={48} />
            <span className="jsheet-title">
              <span className="jsheet-name">{ingredient.name}</span>
              <span className="jsheet-shelf">{shelfLabel}</span>
            </span>
            <span className="jsheet-go">Fiche<Icon name="forward" size={14} weight="bold" /></span>
          </button>

          <div className="jsheet-levels" role="radiogroup" aria-label="Niveau dans le placard">
            {LEVELS.map(l => (
              <button key={l.level} type="button" role="radio" aria-checked={l.level === level}
                className="jsheet-level ripple" onClick={() => onSetLevel(l.level)}>
                <span className="jsheet-mini" style={{ "--m": l.fill } as CSSProperties} aria-hidden="true"><i /></span>
                {l.label}
              </button>
            ))}
          </div>

          <div className="jsheet-sec">
            <h3>À cuisiner avec</h3>
            {recipes.length > 0 && <span>{recipes.length} recette{recipes.length > 1 ? "s" : ""}</span>}
          </div>
          {shown.length === 0 ? (
            <p className="jsheet-empty">Aucune de tes recettes n'utilise encore {ingredient.name?.toLowerCase()}.</p>
          ) : (
            <ul className="jsheet-recs">
              {shown.map(({ recipe, missing }) => {
                const recipeId = recipe.id;
                const time = (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0);
                return (
                  <li key={recipe.id}>
                    <button type="button" className="jsheet-rec" onClick={() => { if (recipeId) leaveThen(() => onOpenRecipe(recipeId)); }}>
                      <RecipeImage recipe={recipe} alt="" fontSize={21} style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0 }} />
                      <span className="jsheet-rec-txt">
                        <b>{recipe.name}</b>
                        <small data-ready={missing.length === 0 || undefined}>
                          {time > 0 && <>{fmtTime(time)} · </>}{missingLabel(missing)}
                        </small>
                      </span>
                      <Icon name="forward" size={16} color="var(--text3)" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {recipes.length > SHOWN_RECIPES && (
            <button type="button" className="btn jsheet-more" onClick={() => leaveThen(onSeeAllRecipes)}>
              Voir les {recipes.length} recettes
            </button>
          )}
        </div>
        );
      }}
    </SwipeableSheet>
  );
}
