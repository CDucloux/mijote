import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";

/** Liste de courses telle que ce menu la manipule (forme minimale utilisée ici). */
interface ShoppingList {
  id?: string;
  name?: string;
  type?: string;
  items: unknown[];
  [k: string]: unknown;
}

interface ListMenuSheetProps {
  list: ShoppingList;
  onClose: () => void;
  onSettings: (list: ShoppingList) => void;
  /**
   * Fourni uniquement pour une liste « recette » dont la recette source existe
   * encore : ajoute l'entrée « Planifier la recette ».
   */
  onPlan?: (list: ShoppingList) => void;
  onDelete: (list: ShoppingList) => void;
}

/**
 * Feuille du menu d'une liste (⋯ de la pastille active ou appui long) : rappel
 * du contexte (type + nombre d'articles), puis accès aux paramètres, à la
 * planification (listes issues d'une recette) et à la suppression. Les actions
 * remontent au parent.
 *
 */
export function ListMenuSheet({ list, onClose, onSettings, onPlan, onDelete }: ListMenuSheetProps) {
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: "rgba(var(--accent-rgb),0.14)", display: "grid", placeItems: "center" }}>
          <Icon name={list.type === "recipe" ? "book" : "shopping"} size={24} color="var(--accent)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{list.name}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>{list.type === "recipe" ? "Depuis une recette" : "Liste libre"} · {list.items.length} article{list.items.length > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <button className="menu-row" onPointerDown={spawnRipple} onClick={() => { onSettings(list); onClose(); }}>
          <Icon name="settings" size={19} color="var(--text2)" /> Paramètres de la liste
        </button>
        {onPlan && (
          <button className="menu-row" onPointerDown={spawnRipple} onClick={() => { onClose(); onPlan(list); }}>
            <Icon name="calendar" size={19} color="var(--text2)" /> Planifier la recette
          </button>
        )}
        <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6 }}
          onPointerDown={spawnRipple}
          onClick={() => { onClose(); onDelete(list); }}>
          <Icon name="trash" size={19} color="var(--red)" /> Supprimer la liste
        </button>
      </div>
    </SwipeableSheet>
  );
}
