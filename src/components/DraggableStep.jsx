import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { AutoResizeTextarea } from "./AutoResizeTextarea.jsx";

export function DraggableStep({ step, index, total, ingredients, utensils, onUpdate, onRemove, onMove }) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("stepIdx", String(index)); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const from = +e.dataTransfer.getData("stepIdx"); if (from !== index) onMove(from, index); }}
      style={{ background: "var(--surface)", borderRadius: 12, padding: 14, border: `1px solid ${over ? "var(--accent)" : "var(--border)"}`, opacity: dragging ? 0.5 : 1, transition: "opacity 0.15s, border-color 0.15s", cursor: "grab" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--text3)", cursor: "grab" }}><Icon name="drag" size={16} color="var(--text3)" /></span>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {index > 0 && <button onClick={() => onMove(index, index - 1)} style={{ padding: "2px 6px", borderRadius: 6, background: "var(--surface2)", fontSize: 11, border: "1px solid var(--border)" }}>↑</button>}
            {index < total - 1 && <button onClick={() => onMove(index, index + 1)} style={{ padding: "2px 6px", borderRadius: 6, background: "var(--surface2)", fontSize: 11, border: "1px solid var(--border)" }}>↓</button>}
          </div>
        </div>
        <button onClick={() => onRemove(step.id)}><Icon name="trash" size={14} color="var(--red)" /></button>
      </div>
      <AutoResizeTextarea className="field-input" placeholder="Instructions…" value={step.text} onChange={e => onUpdate(step.id, "text", e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ingrédients liés</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {ingredients.map(ing => {
          const linked = step.ingredients?.includes(ing.id); return (
            <button key={ing.id} onClick={() => onUpdate(step.id, "ingredients", linked ? step.ingredients.filter(x => x !== ing.id) : [...(step.ingredients || []), ing.id])}
              style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: linked ? "rgba(232,112,58,0.2)" : "var(--surface2)", color: linked ? "var(--accent)" : "var(--text3)", border: `1px solid ${linked ? "rgba(232,112,58,0.5)" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 4 }}>
              {ing.name || "?"}
              {linked && <span style={{ fontSize: 10, color: "var(--accent2)" }}>{ing.amount}{ing.unit}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ustensiles liés</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {utensils.map(u => {
          const linked = step.utensils?.includes(u.id); return (
            <button key={u.id} onClick={() => onUpdate(step.id, "utensils", linked ? step.utensils.filter(x => x !== u.id) : [...(step.utensils || []), u.id])}
              style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: linked ? "rgba(76,175,125,0.2)" : "var(--surface2)", color: linked ? "var(--green)" : "var(--text3)", border: `1px solid ${linked ? "rgba(76,175,125,0.5)" : "var(--border)"}` }}>
              {u.name || "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
