import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";

/**
 * Feuille du menu d'une liste (⋯ de la pastille active ou appui long) : rappel
 * du contexte (type + nombre d'articles), puis accès aux paramètres et à la
 * suppression. Les deux actions remontent au parent.
 */
export function ListMenuSheet({ list, onClose, onSettings, onDelete }) {
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: "rgba(var(--accent-rgb),0.14)", display: "grid", placeItems: "center" }}>
          <Icon name={list.type === "recipe" ? "book" : "shopping"} size={24} color="var(--accent)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{list.name}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>{list.type === "recipe" ? "Depuis une recette" : "Liste libre"} · {list.items.length} article{list.items.length > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <button className="menu-row" onPointerDown={spawnRipple} onClick={() => { onSettings(list); onClose(); }}>
          <Icon name="settings" size={19} color="var(--text2)" /> Paramètres de la liste
        </button>
        <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6 }}
          onPointerDown={spawnRipple}
          onClick={() => { onClose(); onDelete(list); }}>
          <Icon name="trash" size={19} color="var(--red)" /> Supprimer la liste
        </button>
      </div>
    </SwipeableSheet>
  );
}
