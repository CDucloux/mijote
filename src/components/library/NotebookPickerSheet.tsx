import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { DEFAULT_NOTEBOOK_COLOR, DEFAULT_NOTEBOOK_ICON } from "@/lib/recipes/notebooks.js";
import type { Notebook, Recipe } from "@/lib/types.js";

interface NotebookPickerSheetProps {
  recipe: Recipe;
  /** Carnets manuels seulement : les intelligents se remplissent par leurs filtres. */
  notebooks: Notebook[];
  onToggle: (recipeId: string, notebookId: string) => void;
  onClose: () => void;
}

/** Choix des carnets d'une recette (action « Carnet » de son menu). */
export function NotebookPickerSheet({ recipe, notebooks, onToggle, onClose }: NotebookPickerSheetProps) {
  return (
    <SwipeableSheet onClose={onClose}>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Ajouter à un carnet</h3>
      <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>« {recipe.name} »</p>
      {notebooks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "8px 0 12px", color: "var(--text3)", fontSize: 13.5 }}>Aucun carnet manuel pour l'instant.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notebooks.map(nb => {
            const inNb = (recipe.collections || []).includes(nb.id);
            return (
              <button key={nb.id} onClick={() => { if (recipe.id) onToggle(recipe.id, nb.id); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, background: inNb ? "rgba(var(--accent-rgb),0.10)" : "var(--surface2)", border: `1px solid ${inNb ? "rgba(var(--accent-rgb),0.4)" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "background 0.15s, border-color 0.15s" }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: (nb.color || DEFAULT_NOTEBOOK_COLOR) + "33", display: "grid", placeItems: "center", fontSize: 18 }}>{nb.icon || DEFAULT_NOTEBOOK_ICON}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nb.name}</span>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: inNb ? "var(--accent)" : "transparent", border: `2px solid ${inNb ? "var(--accent)" : "var(--border)"}`, display: "grid", placeItems: "center" }}>
                  {inNb && <Icon name="check" size={12} color="#fff" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Terminé</button>
    </SwipeableSheet>
  );
}
