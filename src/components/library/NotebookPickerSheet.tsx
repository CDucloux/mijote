import { Icon } from "../ui/Icon.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { DEFAULT_NOTEBOOK_COLOR, DEFAULT_NOTEBOOK_ICON, isSmartNotebook } from "@/lib/recipes/notebooks.js";
import type { Notebook, Recipe } from "@/lib/types.js";

interface NotebookPickerSheetProps {
  recipe: Pick<Recipe, "id" | "name" | "collections">;
  /** Tous les carnets : les intelligents sont écartés ici (ils se remplissent par leurs filtres). */
  notebooks: Notebook[];
  onToggle: (recipeId: string, notebookId: string) => void;
  onClose: () => void;
}

/**
 * Rangement d'une recette dans ses carnets manuels, depuis la fiche ou le menu d'une
 * carte. Chaque appui bascule immédiatement l'appartenance (pas de validation finale).
 */
export function NotebookPickerSheet({ recipe, notebooks, onToggle, onClose }: NotebookPickerSheetProps) {
  const manual = notebooks.filter(nb => !isSmartNotebook(nb));
  const memberOf = new Set(recipe.collections || []);
  const inCount = manual.filter(nb => memberOf.has(nb.id)).length;

  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Ranger dans un carnet</h3>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: "4px 0 16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipe.name}</p>

        {manual.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "4px 12px 8px" }}>
            <EmptyArt name="bibliotheque" size={104} style={{ marginBottom: 6 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>Aucun carnet à remplir</p>
            <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, margin: "4px 0 0", maxWidth: 300 }}>Crée un carnet manuel depuis ta bibliothèque. Les carnets intelligents, eux, se remplissent tout seuls.</p>
          </div>
        ) : (
          <div role="group" aria-label="Carnets" style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -10px" }}>
            {manual.map(nb => {
              const on = memberOf.has(nb.id);
              const color = nb.color || DEFAULT_NOTEBOOK_COLOR;
              return (
                <button key={nb.id} role="checkbox" aria-checked={on} className="pressable hover-neutral"
                  onClick={() => { if (recipe.id) onToggle(recipe.id, nb.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left",
                    background: on ? "rgba(var(--accent-rgb),0.08)" : "transparent", transition: "background-color 0.18s ease" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: color + "2e", display: "grid", placeItems: "center", fontSize: 19 }}>{nb.icon || DEFAULT_NOTEBOOK_ICON}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nb.name}</span>
                    {typeof nb.count === "number" && <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 1 }}>{nb.count} recette{nb.count > 1 ? "s" : ""}</span>}
                  </span>
                  {/* Case : l'anneau se remplit d'accent et la coche surgit (rebond). */}
                  <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", boxSizing: "border-box",
                    background: on ? "var(--accent)" : "transparent", border: on ? "none" : "1.5px solid var(--text3)",
                    transition: "background-color 0.18s ease" }}>
                    <span style={{ display: "grid", transform: on ? "scale(1)" : "scale(0)", transition: "transform 0.24s cubic-bezier(0.34,1.56,0.64,1)" }}>
                      <Icon name="check" size={13} color="#fff" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
          {manual.length > 0 && <span style={{ flex: 1, fontSize: 13, color: "var(--text3)" }}>{inCount ? `Dans ${inCount} carnet${inCount > 1 ? "s" : ""}` : "Dans aucun carnet"}</span>}
          <button className="btn btn-primary btn-pill btn-flat" style={{ flex: manual.length > 0 ? "0 0 auto" : 1, padding: "12px 26px" }} onClick={() => close()}>Terminé</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
