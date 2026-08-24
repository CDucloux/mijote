import { useState } from "react";
import { Icon } from "../Icon.jsx";
import { IngImage } from "../Img.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { splitBulletLines } from "@/lib/food/shoppingList.js";
import { MAX_ITEM_CHARS, MAX_LIST_ITEMS, MAX_LIST_CHARS } from "../../hooks/useShopping.js";

/**
 * Feuille d'ajout à une liste libre : bascule « Article » / « Coller une liste »
 * (contrôle segmenté), aperçu de reconnaissance Master DB en saisie unique, et
 * comptage borné du collage. L'insertion réelle remonte via `onAddItem` /
 * `onAddMany` ; l'état de saisie est local et disparaît à la fermeture.
 */
export function AddItemSheet({ activeList, ingredientDB, onClose, onAddItem, onAddMany }) {
  const [newItemName, setNewItemName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [listMode, setListMode] = useState(false);

  return (
    <SwipeableSheet onClose={onClose}>
      {/* En-tête : puce accent + titre display + nom de la liste */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
          <Icon name={listMode ? "list2" : "shopping"} size={21} color="var(--accent)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>{listMode ? "Coller une liste" : "Ajouter un article"}</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeList.name}</p>
        </div>
      </div>

      {/* Mode : contrôle segmenté avec pastille glissante (façon planning) */}
      <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 16 }}>
        <div aria-hidden="true" style={{
          position: "absolute", top: 4, bottom: 4, left: 4, width: "calc((100% - 8px) / 2)",
          background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          transform: `translateX(calc(${listMode ? 1 : 0} * 100%))`,
          transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.5, 1)",
        }} />
        {[{ label: "Article", val: false }, { label: "Coller une liste", val: true }].map(({ label, val }) => (
          <button key={label} onClick={() => setListMode(val)}
            style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
              background: "transparent", color: listMode === val ? "var(--accent)" : "var(--text3)", transition: "color 0.3s ease" }}>
            {label}
          </button>
        ))}
      </div>

      {listMode ? (() => {
        const count = splitBulletLines(pasteText).length;
        const over = count > MAX_LIST_ITEMS;
        return (
          <>
            <textarea className="field-input" value={pasteText} maxLength={MAX_LIST_CHARS}
              onChange={e => setPasteText(e.target.value.slice(0, MAX_LIST_CHARS))}
              placeholder={"Un article par ligne :\n500g farine\n2 oeufs\n1 sachet de levure"}
              style={{ minHeight: 140, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit", marginBottom: 8 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.3 }}>Une ligne = un article (tirets, puces et numéros acceptés).</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: over ? "var(--red)" : "var(--text3)", flexShrink: 0 }}>{count}/{MAX_LIST_ITEMS}</span>
            </div>
            {over && <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 8 }}>Maximum {MAX_LIST_ITEMS} articles à la fois – retire {count - MAX_LIST_ITEMS} ligne(s).</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={count === 0 || over}
              onClick={() => onAddMany(pasteText)}>
              <Icon name="plusCircle" size={17} /> Ajouter {count > 0 ? `${count} article${count > 1 ? "s" : ""}` : "la liste"}
            </button>
          </>
        );
      })() : (
        <>
          <input className="field-input" placeholder="ex: 500g farine, 2 oeufs…" maxLength={MAX_ITEM_CHARS}
            value={newItemName} onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onAddItem(newItemName); }}
            onPaste={e => {
              const t = (e.clipboardData || window.clipboardData)?.getData("text") || "";
              if (/\r?\n/.test(t)) { e.preventDefault(); setPasteText(p => (p ? p + "\n" : "") + t); setListMode(true); }
            }}
            style={{ marginBottom: 10 }} />
          {newItemName.trim() && (() => {
            const p = parseIngredientInput(newItemName);
            const name = p.name || newItemName.trim();
            const match = findIngredientMatch(name, ingredientDB);
            return (
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                {match?.image && <IngImage src={match.image} alt={match.name} size={34} />}
                {p.amount && <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {p.amount}</span>}
                {p.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {p.unit}</span>}
                {p.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{p.name}</span>}
                {match ? <span style={{ fontSize: 11, background: "rgba(var(--ok-rgb),0.15)", color: "var(--ok)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ Reconnu</span>
                  : p.name ? <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px" }}>Non référencé</span> : null}
              </div>
            );
          })()}
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => onAddItem(newItemName)} disabled={!newItemName.trim()}>
            <Icon name="plusCircle" size={17} /> Ajouter
          </button>
        </>
      )}
    </SwipeableSheet>
  );
}
