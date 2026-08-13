import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { MoveArrows } from "./MoveArrows.jsx";
import { useDragReorder, LIFTED_ROW_STYLE } from "../hooks/useDragReorder.js";

// Ligne d'ingrédient réorganisable LIBREMENT dans la liste complète (index global).
// Glisser au doigt sur mobile (poignée), flèches ↑/↓ sur desktop. La section est
// déterminée par la POSITION (pas de pastille) : voir `moveWithAdopt`.
export function DraggableIngredient({
  ing, index, total, draggable: isDraggable = true,
  ingredientDB, recipes, autoFocus, isDropTarget = false,
  onRawChange, onUpdateAmount, onRemove, onMove, onTargetChange, onEnter, onBackspaceEmpty,
}) {
  const [trashHover, setTrashHover] = useState(false);
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
      <div {...rowProps} style={{ background: "rgba(232,112,58,0.06)", borderRadius: 12, padding: 12, border: `1px solid ${aimed ? "var(--accent)" : "rgba(232,112,58,0.4)"}`, transition: "border-color 0.15s, box-shadow 0.2s", display: "flex", alignItems: "center", gap: 10, ...dragStyle }}>
        {handle}
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><BaseIcon size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {comp?.name || ing.name || "Base supprimée"}
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", marginLeft: 6 }}>BASE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input className="field-input no-spin" type="number" min="0" step="any" placeholder="Quantité" value={ing.amount} onChange={e => onUpdateAmount(ing.id, e.target.value === "" ? "" : +e.target.value)} style={{ marginBottom: 0, maxWidth: 120 }} />
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
  return (
    <div {...rowProps} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: `1px solid ${aimed ? "var(--accent)" : "var(--border)"}`, transition: "border-color 0.15s, box-shadow 0.2s", ...dragStyle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {handle}
        {img
          ? <IngImage src={img} alt={ing.name} size={36} />
          : <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "var(--surface2)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="leaf" size={15} color="var(--text3)" /></span>}
        <input className="field-input" placeholder="ex: 500g pois chiches, 2 oeufs…"
          ref={inputRef}
          enterKeyHint="enter"
          value={ing._raw !== undefined ? ing._raw : ""}
          onChange={e => onRawChange(ing.id, e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); onEnter(); }
            // Retour arrière sur une ligne VIDE → supprime la ligne (miroir d'Entrée).
            else if (e.key === "Backspace" && !(ing._raw || "") && onBackspaceEmpty) { e.preventDefault(); onBackspaceEmpty(ing.id); }
          }}
          style={{ marginBottom: 0, flex: 1, minWidth: 0 }} />
        {trashBtn}
      </div>
      {(ing.name || ing.amount) && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          {Number(ing.amount) > 0
            ? <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {ing.amount}</span>
            : <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>⚠ Quantité manquante</span>}
          {ing.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {ing.unit}</span>}
          {ing.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{ing.name}</span>}
          {ing.dbId
            ? <span style={{ fontSize: 11, background: "rgba(76,175,125,0.15)", color: "var(--green)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ Ingrédient reconnu</span>
            : ing.name ? <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✕ Non référencé</span> : null}
        </div>
      )}
    </div>
  );
}
