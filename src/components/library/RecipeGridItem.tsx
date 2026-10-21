import { memo } from "react";
import { RecipeCard } from "../recipe/RecipeCard.jsx";
import type { useLongPress } from "../../hooks/useLongPress.js";
import { asNutriLetter } from "@/lib/recipes/nutriscore.js";
import type { SavedRecipe } from "@/lib/types.js";
import type { RecipeDerived } from "@/lib/recipes/recipeDerived.js";

type LongPress = ReturnType<typeof useLongPress>;

interface RecipeGridItemProps {
  recipe: SavedRecipe;
  derived: RecipeDerived | undefined;
  animate: boolean;
  animDelay: string;
  onOpen: (recipe: SavedRecipe) => void;
  onMenu: (recipe: SavedRecipe) => void;
  startLongPress: LongPress["startLongPress"];
  cancelLongPress: LongPress["cancelLongPress"];
  moveLongPress: LongPress["moveLongPress"];
}

/**
 * Carte de la grille, mémoïsée : elle ne re-rend que si SES props changent (sans ça,
 * chaque lot chargé re-rendait toutes les cartes déjà visibles). Les callbacks reçus
 * sont stables et prennent la recette en argument.
 */
export const RecipeGridItem = memo(function RecipeGridItem({ recipe, derived, animate, animDelay, onOpen, onMenu, startLongPress, cancelLongPress, moveLongPress }: RecipeGridItemProps) {
  return (
    <div className="discover-card"
      onPointerDown={(e) => startLongPress(e, () => onMenu(recipe))} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
      onContextMenu={(e) => { e.preventDefault(); onMenu(recipe); }}>
      <RecipeCard recipe={recipe} onClick={() => onOpen(recipe)} inSeason={derived?.inSeason || false} vegan={derived?.vegan || false} nutriLetter={asNutriLetter(derived?.nutriLetter)} animate={animate} style={animate ? { animationDelay: animDelay } : undefined} />
    </div>
  );
});
