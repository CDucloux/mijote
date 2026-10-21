import { useState, type CSSProperties } from "react";
import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { findIngredientMatch, type DbEntry } from "@/lib/food/nameMatcher.js";
import { splitBulletLines } from "@/lib/food/shoppingList.js";
import { MAX_ITEM_CHARS, MAX_LIST_ITEMS, MAX_LIST_CHARS } from "../../hooks/useShopping.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";

// Analyse de la saisie en pills neutres (pas une couleur par champ : le libellé
// dit déjà ce qu'est la valeur).
function ParsedPill({ label, value }: { label?: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, padding: "5px 11px", borderRadius: 999, background: "var(--surface2)", fontSize: 12.5, lineHeight: 1.2, maxWidth: "100%", color: "var(--text2)" }}>
      {label && <span style={{ color: "var(--text3)" }}>{label} :</span>}
      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </span>
  );
}

// Vignette de l'ingrédient reconnu, statut en pastille en bas à droite : coche si
// l'article est relié à la base (image, rayon, nutrition), point d'interrogation sinon.
function MatchThumb({ image, name, known }: { image?: string; name: string; known: boolean }) {
  const status = known ? "Reconnu" : "Non référencé";
  return (
    <span role="img" aria-label={`${name} : ${status.toLowerCase()}`} title={status} style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
      <IngImage key={image || "none"} src={image} alt="" size={38} />
      <span aria-hidden style={{ position: "absolute", right: -3, bottom: -3, width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center",
        border: "2px solid var(--surface)", background: known ? "var(--ok)" : "var(--surface3)", color: known ? "#fff" : "var(--text2)" }}>
        <Icon name={known ? "check" : "help"} size={9} color="currentColor" />
      </span>
    </span>
  );
}

/** Panneau d'un mode : empilé dans la cellule commune, effacé quand inactif. */
const panelStyle = (visible: boolean): CSSProperties => ({
  gridArea: "1 / 1", display: "flex", flexDirection: "column",
  visibility: visible ? "visible" : "hidden", opacity: visible ? 1 : 0,
  transition: visible ? "opacity 0.2s ease, visibility 0s" : "opacity 0.2s ease, visibility 0s 0.2s",
});

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
  const pasteCount = splitBulletLines(pasteText).length;
  const over = pasteCount > MAX_LIST_ITEMS;
  const preview = (() => {
    if (!newItemName.trim()) return null;
    const parsed = parseIngredientInput(newItemName);
    const name = parsed.name || newItemName.trim();
    return { parsed, name, match: findIngredientMatch(name, ingredientDB) };
  })();

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
          <button key={label} onClick={() => setListMode(val)} className={`seg-opt${listMode === val ? " on" : ""}`}
            style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
              background: "transparent", color: listMode === val ? "var(--accent)" : undefined }}>
            {label}
          </button>
        ))}
      </div>

      {/* Les deux modes partagent la même cellule de grille : la feuille prend la
          hauteur du plus grand et n'en change plus en basculant (le bouton
          d'action reste sous le pouce, au même endroit). Le mode masqué sort du
          focus et de l'arbre d'accessibilité via `visibility`. */}
      <div style={{ display: "grid" }}>
        <div style={panelStyle(listMode)} aria-hidden={!listMode}>
          <textarea className="field-input field-bare" value={pasteText} maxLength={MAX_LIST_CHARS}
            onChange={e => setPasteText(e.target.value.slice(0, MAX_LIST_CHARS))}
            placeholder={"Un article par ligne :\n500g farine\n2 oeufs\n1 sachet de levure"}
            style={{ height: 140, resize: "none", lineHeight: 1.5, fontFamily: "inherit", marginBottom: 8 }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: over ? "var(--red)" : "var(--text3)", lineHeight: 1.3 }}>
              {over ? `${MAX_LIST_ITEMS} articles maximum à la fois : retire ${pasteCount - MAX_LIST_ITEMS} ligne${pasteCount - MAX_LIST_ITEMS > 1 ? "s" : ""}.` : "Une ligne = un article (tirets, puces et numéros acceptés)."}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: over ? "var(--red)" : "var(--text3)", flexShrink: 0 }}>{pasteCount}/{MAX_LIST_ITEMS}</span>
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: "auto" }} disabled={pasteCount === 0 || over}
            onClick={() => onAddMany(pasteText)}>
            <Icon name="plusCircle" size={17} /> Ajouter {pasteCount > 0 ? `${pasteCount} article${pasteCount > 1 ? "s" : ""}` : "la liste"}
          </button>
        </div>

        <div style={panelStyle(!listMode)} aria-hidden={listMode}>
          <input className="field-input field-bare" placeholder="ex: 500g farine, 2 oeufs…" maxLength={MAX_ITEM_CHARS}
            value={newItemName} onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onAddItem(newItemName); }}
            onPaste={e => {
              const legacyClipboard = (window as unknown as { clipboardData?: DataTransfer }).clipboardData;
              const t = (e.clipboardData || legacyClipboard)?.getData("text") || "";
              if (/\r?\n/.test(t)) { e.preventDefault(); setPasteText(p => (p ? p + "\n" : "") + t); setListMode(true); }
            }}
            style={{ marginBottom: 12 }} />
          {/* Emplacement réservé à l'aperçu : il se remplit à la frappe sans rien pousser. */}
          <div style={{ minHeight: 44, display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            {preview ? (
              <>
                <MatchThumb image={preview.match?.image} name={preview.match?.name || preview.name} known={!!preview.match} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                  {preview.parsed.amount && <ParsedPill label="Quantité" value={String(preview.parsed.amount)} />}
                  {preview.parsed.unit && <ParsedPill label="Unité" value={preview.parsed.unit} />}
                  {preview.parsed.name && <ParsedPill value={preview.parsed.name} />}
                </div>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4 }}>Quantité et unité sont reconnues toutes seules, l'article est rangé dans son rayon.</span>
            )}
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: "auto" }} onClick={() => onAddItem(newItemName)} disabled={!newItemName.trim()}>
            <Icon name="plusCircle" size={17} /> Ajouter
          </button>
        </div>
      </div>
    </SwipeableSheet>
  );
}
