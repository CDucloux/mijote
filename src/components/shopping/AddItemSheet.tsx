import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { findIngredientMatch, type DbEntry } from "@/lib/food/nameMatcher.js";
import { splitBulletLines } from "@/lib/food/shoppingList.js";
import { MAX_ITEM_CHARS, MAX_LIST_ITEMS, MAX_LIST_CHARS } from "../../hooks/useShopping.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";

// Analyse de la saisie en pills neutres (pas une couleur par champ : l'étiquette
// dit déjà ce qu'est la valeur), le nom ressortant par la graisse.
function ParsedPill({ label, value, strong = false }: { label?: string; value: string; strong?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, padding: "5px 11px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 12.5, lineHeight: 1.2, maxWidth: "100%" }}>
      {label && <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--text3)" }}>{label}</span>}
      <span style={{ fontWeight: strong ? 650 : 600, color: strong ? "var(--text)" : "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </span>
  );
}

// Vignette de l'ingrédient reconnu, statut en pastille en bas à droite : coche si
// l'article est relié à la base (image, rayon, nutrition), point d'interrogation sinon.
function MatchThumb({ image, name, known }: { image?: string; name: string; known: boolean }) {
  const status = known ? "Reconnu" : "Non référencé";
  return (
    <span role="img" aria-label={`${name} : ${status.toLowerCase()}`} title={status} style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
      <IngImage src={image} alt="" size={38} />
      <span aria-hidden style={{ position: "absolute", right: -3, bottom: -3, width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center",
        border: "2px solid var(--surface)", background: known ? "var(--ok)" : "var(--surface3)", color: known ? "#fff" : "var(--text2)" }}>
        <Icon name={known ? "check" : "help"} size={9} color="currentColor" />
      </span>
    </span>
  );
}

/** Props de la feuille d'ajout à une liste de courses libre. */
interface AddItemSheetProps {
  activeList: ShoppingList;
  ingredientDB: DbEntry[];
  onClose: () => void;
  onAddItem: (raw: string) => void;
  onAddMany: (text: string) => void;
}

/**
 * Feuille d'ajout à une liste libre : bascule « Article » / « Coller une liste »
 * (contrôle segmenté), aperçu de reconnaissance Master DB en saisie unique, et
 * comptage borné du collage. L'insertion réelle remonte via `onAddItem` /
 * `onAddMany` ; l'état de saisie est local et disparaît à la fermeture.
 */
export function AddItemSheet({ activeList, ingredientDB, onClose, onAddItem, onAddMany }: AddItemSheetProps) {
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
          transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
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
            <textarea className="field-input field-bare" value={pasteText} maxLength={MAX_LIST_CHARS}
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
          <input className="field-input field-bare" placeholder="ex: 500g farine, 2 oeufs…" maxLength={MAX_ITEM_CHARS}
            value={newItemName} onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onAddItem(newItemName); }}
            onPaste={e => {
              const legacyClipboard = (window as unknown as { clipboardData?: DataTransfer }).clipboardData;
              const t = (e.clipboardData || legacyClipboard)?.getData("text") || "";
              if (/\r?\n/.test(t)) { e.preventDefault(); setPasteText(p => (p ? p + "\n" : "") + t); setListMode(true); }
            }}
            style={{ marginBottom: 10 }} />
          {newItemName.trim() && (() => {
            const p = parseIngredientInput(newItemName);
            const name = p.name || newItemName.trim();
            const match = findIngredientMatch(name, ingredientDB);
            return (
              <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
                <MatchThumb image={match?.image} name={match?.name || name} known={!!match} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                  {p.amount && <ParsedPill label="Qté" value={String(p.amount)} />}
                  {p.unit && <ParsedPill label="Unité" value={p.unit} />}
                  {p.name && <ParsedPill value={p.name} strong />}
                </div>
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
