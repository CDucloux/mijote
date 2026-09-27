import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { MoveArrows } from "./MoveArrows.jsx";
import { IngredientMatchSheet } from "./IngredientMatchSheet.jsx";
import { DecoupeSheet } from "./DecoupeSheet.jsx";
import { useDragReorder, LIFTED_ROW_STYLE } from "../hooks/useDragReorder.js";
import { FORME_LABEL } from "@/lib/recipes/decoupe.js";
import { ingredientMatch } from "@/lib/recipes/ingredientMatch.js";
import { capitalize } from "../lib/format.js";

// Registre visuel de la pastille de statut d'appariement (foreground + fond doux).
// L'ambre n'a pas de token `--…-rgb` : rgba littéral, idiome déjà présent ailleurs.
const MATCH_TONE = {
  ok: { fg: "var(--ok)", soft: "rgba(var(--ok-rgb),0.14)", icon: "check" },
  warn: { fg: "var(--orange)", soft: "rgba(240,153,42,0.14)", icon: "warning" },
};

// Ligne d'ingrédient réorganisable LIBREMENT dans la liste complète (index global).
// Glisser au doigt sur mobile (poignée), flèches ↑/↓ sur desktop. La section est
// déterminée par la POSITION (pas de pastille) : voir `moveWithAdopt`.
export function DraggableIngredient({
  ing, index, total, draggable: isDraggable = true,
  ingredientDB, recipes, autoFocus, isDropTarget = false,
  onRawChange, onUpdateAmount, onRemove, onMove, onTargetChange, onEnter, onBackspaceEmpty, onCutChange,
}) {
  const [trashHover, setTrashHover] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [showCut, setShowCut] = useState(false);
  const inputRef = useRef(null);
  const { dragging, rowProps, handleProps } = useDragReorder({ index, enabled: isDraggable, onMove, onTargetChange });
  // La ligne saisie se soulève ; la ligne VISÉE s'entoure d'accent.
  const dragStyle = dragging ? LIFTED_ROW_STYLE : null;
  const aimed = isDropTarget && !dragging;

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const handle = isDraggable ? (
    <span {...handleProps} style={{ ...handleProps.style, flexShrink: 0, color: "var(--text3)", display: "flex", alignItems: "center" }}>
      <Icon name="drag" size={16} color="var(--text3)" />
    </span>
  ) : (
    <MoveArrows index={index} total={total} onMove={onMove} />
  );

  const trashBtn = (
    <button onClick={() => onRemove(ing.id)} onMouseEnter={() => setTrashHover(true)} onMouseLeave={() => setTrashHover(false)}
      style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", background: trashHover ? "rgba(224,82,82,0.14)" : "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.15s" }}>
      <Icon name="trash" size={15} color="var(--red)" />
    </button>
  );

  // ── Ligne composant (préparation de base référencée) ──
  if (ing.recipeId) {
    const comp = (recipes || []).find(r => r.id === ing.recipeId);
    return (
      <div {...rowProps} style={{ background: "rgba(var(--accent-rgb),0.06)", borderRadius: 12, padding: 12, border: `1px solid ${aimed ? "var(--accent)" : "rgba(var(--accent-rgb),0.4)"}`, transition: "border-color 0.15s, box-shadow 0.2s", display: "flex", alignItems: "center", gap: 10, ...dragStyle }}>
        {handle}
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><BaseIcon size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {comp?.name || ing.name || "Base supprimée"}
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", marginLeft: 6 }}>BASE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input className="field-input field-soft no-spin" type="number" min="0" step="any" placeholder="Quantité" value={ing.amount} onChange={e => onUpdateAmount(ing.id, e.target.value === "" ? "" : +e.target.value)} style={{ marginBottom: 0, maxWidth: 120 }} />
            <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>{ing.unit}</span>
            {!comp ? <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 600 }}>⚠ introuvable</span>
              : comp.yield?.amount ? <span style={{ fontSize: 11, color: "var(--text3)" }}>/ {comp.yield.amount} {comp.yield.unit} produits</span> : null}
          </div>
        </div>
        {trashBtn}
      </div>
    );
  }

  // ── Ligne ingrédient brut ──
  const img = ing.dbId ? ingredientDB.find(d => d.id === ing.dbId)?.image : null;
  // Statut d'appariement condensé en UNE pastille (à droite, avant la corbeille) qui
  // ouvre le détail à la demande, plutôt qu'une rangée de pilules sous chaque ligne.
  const match = ingredientMatch(ing);
  const tone = MATCH_TONE[match.tone];
  // Pastille de statut posée À L'INTÉRIEUR du champ gris, calée à droite. Ouvre le
  // détail à la demande. Onde tactile mobile (`ripple`) + survol desktop (`match-dot`).
  // top/marginTop (et non translateY) pour le centrage : `.tap:active` remplace le
  // transform par un scale, ce qui ferait sauter un centrage porté par transform.
  const matchBtn = tone && (
    <button type="button" className="match-dot ripple tap" onClick={() => setShowMatch(true)}
      title={match.summary} aria-label={`Analyse : ${match.summary}`}
      style={{ position: "absolute", top: "50%", right: 6, marginTop: -14, "--dot-fg": tone.fg, width: 28, height: 28, borderRadius: "50%", background: tone.soft, border: "none", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
      <Icon name={tone.icon} size={14} color={tone.fg} />
    </button>
  );
  return (
    <div {...rowProps} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: `1px solid ${aimed ? "var(--accent)" : "var(--border)"}`, transition: "border-color 0.15s, box-shadow 0.2s", ...dragStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {handle}
        {img
          ? <IngImage src={img} alt={ing.name} size={36} />
          : <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "var(--surface2)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="leaf" size={15} color="var(--text3)" /></span>}
        {/* Champ + pastille de statut logée à l'intérieur (padding-right réservé). */}
        <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
          <input className="field-input field-soft" placeholder="ex: 500g pois chiches, 2 oeufs…"
            ref={inputRef}
            enterKeyHint="enter"
            value={ing._raw !== undefined ? ing._raw : ""}
            onChange={e => onRawChange(ing.id, e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); onEnter(); }
              // Retour arrière sur une ligne VIDE → supprime la ligne (miroir d'Entrée).
              else if (e.key === "Backspace" && !(ing._raw || "") && onBackspaceEmpty) { e.preventDefault(); onBackspaceEmpty(ing.id); }
            }}
            style={{ marginBottom: 0, flex: 1, minWidth: 0, paddingRight: tone ? 42 : undefined }} />
          {matchBtn}
        </div>
        {trashBtn}
      </div>
      {showMatch && <IngredientMatchSheet ing={ing} image={img} onClose={() => setShowMatch(false)} />}
      {/* Découpe de mise en place : optionnelle, donc réduite à UN déclencheur discret
          quand rien n'est posé (« + Découpe »), ou à une pill accent résumant le choix.
          L'édition (forme + calibre) se fait dans une feuille dédiée, pas en <select>. */}
      {ing.name && onCutChange && (
        <div style={{ marginTop: 8, marginLeft: isDraggable ? 72 : 82 }}>{/* Aligné au bord gauche
            du champ gris : poignée (16/26) + image (36) + 2 gouttières (10). */}
          {ing.cut?.forme
            ? <button type="button" className="tap ripple" onClick={() => setShowCut(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.35)" }}>
                <Icon name="knife" size={13} color="var(--accent)" />
                {FORME_LABEL[ing.cut.forme]}{ing.cut.calibre ? ` · ${capitalize(ing.cut.calibre)}` : ""}
              </button>
            : <button type="button" className="tap ripple" onClick={() => setShowCut(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 9px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: "transparent", color: "var(--text3)", border: "1px dashed var(--border)" }}>
                <Icon name="plus" size={13} color="var(--text3)" /> Découpe
              </button>}
        </div>
      )}
      {showCut && (
        <DecoupeSheet name={ing.name} cut={ing.cut}
          onChange={cut => onCutChange(ing.id, cut)} onClose={() => setShowCut(false)} />
      )}
    </div>
  );
}
