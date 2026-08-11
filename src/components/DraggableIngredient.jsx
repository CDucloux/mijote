import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { GroupSelect } from "./GroupSelect.jsx";

// Ligne d'ingrédient réorganisable. Drag tactile sur mobile (draggable=true),
// boutons ↑/↓ sur desktop (draggable=false, le drag HTML5 y est pénible).
export function DraggableIngredient({
  ing, index, total, draggable: isDraggable = true,
  ingredientDB, recipes, autoFocus, groups, onSetGroup,
  onRawChange, onUpdateAmount, onRemove, onMove, onEnter,
}) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const dragProps = isDraggable ? {
    draggable: true,
    onDragStart: e => { e.dataTransfer.setData("ingIdx", String(index)); setDragging(true); },
    onDragEnd: () => setDragging(false),
    onDragOver: e => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: e => { e.preventDefault(); setOver(false); const from = +e.dataTransfer.getData("ingIdx"); if (Number.isInteger(from) && from !== index) onMove(from, index); },
  } : {};

  const handle = isDraggable ? (
    <span style={{ flexShrink: 0, color: "var(--text3)", cursor: "grab", display: "flex", alignItems: "center", touchAction: "none" }}>
      <Icon name="drag" size={16} color="var(--text3)" />
    </span>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
      <button onClick={() => index > 0 && onMove(index, index - 1)} disabled={index === 0} style={{ width: 22, height: 20, borderRadius: 5, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: index > 0 ? "pointer" : "default", opacity: index === 0 ? 0.3 : 1, fontSize: 11 }}>↑</button>
      <button onClick={() => index < total - 1 && onMove(index, index + 1)} disabled={index === total - 1} style={{ width: 22, height: 20, borderRadius: 5, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: index < total - 1 ? "pointer" : "default", opacity: index === total - 1 ? 0.3 : 1, fontSize: 11 }}>↓</button>
    </div>
  );

  const trashBtn = (
    <button onClick={() => onRemove(ing.id)} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      <Icon name="trash" size={14} color="var(--red)" />
    </button>
  );

  const groupSel = onSetGroup ? (
    <GroupSelect value={ing.group || ""} groups={groups} onChange={g => onSetGroup(ing.id, g)} />
  ) : null;

  // ── Ligne composant (préparation de base référencée) ──
  if (ing.recipeId) {
    const comp = (recipes || []).find(r => r.id === ing.recipeId);
    return (
      <div {...dragProps} style={{ background: "rgba(232,112,58,0.06)", borderRadius: 12, padding: 12, border: `1px solid ${over ? "var(--accent)" : "rgba(232,112,58,0.4)"}`, opacity: dragging ? 0.5 : 1, transition: "opacity 0.15s, border-color 0.15s", display: "flex", alignItems: "center", gap: 10 }}>
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
        {groupSel}
        {trashBtn}
      </div>
    );
  }

  // ── Ligne ingrédient brut ──
  const img = ing.dbId ? ingredientDB.find(d => d.id === ing.dbId)?.image : null;
  return (
    <div {...dragProps} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: `1px solid ${over ? "var(--accent)" : "var(--border)"}`, opacity: dragging ? 0.5 : 1, transition: "opacity 0.15s, border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {handle}
        {img
          ? <IngImage src={img} alt={ing.name} size={36} />
          : <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "var(--surface2)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="leaf" size={15} color="var(--text3)" /></span>}
        <input className="field-input" placeholder="ex: 500g pois chiches, 2 oeufs…"
          ref={inputRef}
          value={ing._raw !== undefined ? ing._raw : ""}
          onChange={e => onRawChange(ing.id, e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
          style={{ marginBottom: 0, flex: 1, minWidth: 0 }} />
        {groupSel}
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
