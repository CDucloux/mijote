import { Icon, type IconName } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { RecipeSheetThumb } from "../recipe/RecipeSheetThumb.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import type { SavedRecipe } from "@/lib/types.js";

/** Actions du menu d'une recette (toutes facultatives : l'action absente ne fait rien). */
export interface RecipeMenuActions {
  onOpen: (recipe: SavedRecipe) => void;
  onPlan?: (recipe: SavedRecipe) => void;
  onShop?: (recipe: SavedRecipe) => void;
  onPickNotebooks: (recipe: SavedRecipe) => void;
  onEdit?: (recipe: SavedRecipe) => void;
  onDuplicate?: (recipe: SavedRecipe) => void;
  onShare?: (recipe: SavedRecipe) => void;
  onDelete: (recipe: SavedRecipe) => void;
}

interface RecipeMenuSheetProps extends RecipeMenuActions {
  recipe: SavedRecipe;
  onClose: () => void;
}

interface MenuAction { icon: IconName; label: string; run?: (recipe: SavedRecipe) => void }

/**
 * Menu d'une recette (appui long / clic droit). Une préparation de base ne se
 * planifie, ne se range ni ne se partage : seules ses actions d'édition restent.
 */
export function RecipeMenuSheet({ recipe, onClose, onOpen, onPlan, onShop, onPickNotebooks, onEdit, onDuplicate, onShare, onDelete }: RecipeMenuSheetProps) {
  const isComp = !!recipe.isComponent;
  const actions: MenuAction[] = [
    { icon: "forward", label: "Ouvrir", run: onOpen },
    ...(isComp ? [] : [
      { icon: "calendar", label: "Planning", run: onPlan },
      { icon: "shopping", label: "Courses", run: onShop },
      { icon: "fileText", label: "Carnet", run: onPickNotebooks },
    ] satisfies MenuAction[]),
    { icon: "edit", label: "Modifier", run: onEdit },
    { icon: "copy", label: "Dupliquer", run: onDuplicate },
    ...(isComp ? [] : [{ icon: "share", label: "Partager", run: onShare }] satisfies MenuAction[]),
  ];
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <RecipeSheetThumb image={recipe.image} isComponent={isComp} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipe.name}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>{isComp ? "Préparation de base" : "Recette"}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {actions.map(a => (
          <button key={a.label} className="menu-row" onPointerDown={spawnRipple} onClick={() => { onClose(); a.run?.(recipe); }}>
            <Icon name={a.icon} size={19} color="var(--text2)" /> {a.label}
          </button>
        ))}
        <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6 }} onPointerDown={spawnRipple} onClick={() => { onClose(); onDelete(recipe); }}>
          <Icon name="trash" size={19} color="var(--red)" /> Supprimer
        </button>
      </div>
    </SwipeableSheet>
  );
}
