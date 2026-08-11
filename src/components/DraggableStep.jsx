import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { fmtQtyUnit } from "../lib/format.js";
import { AutoResizeTextarea } from "./AutoResizeTextarea.jsx";
import { ImageUpload } from "./ImageUpload.jsx";
import { MoveArrows } from "./MoveArrows.jsx";
import { IngImage } from "./Img.jsx";
import { UtImage } from "./StepPills.jsx";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";

// Petit label de sous-bloc (Ingrédients liés / Ustensiles liés) — épuré, sans capitales.
function BlockLabel({ icon, color, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
      <Icon name={icon} size={13} color={color} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)", letterSpacing: "0.01em" }}>{children}</span>
    </div>
  );
}

export function DraggableStep({ step, index, total, ingredients, utensils, recipes, ingredientDB, utensilDB, draggable: isDraggable = true, onUpdate, onRemove, onMove }) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [trashHover, setTrashHover] = useState(false);
  // Champs optionnels repliés par défaut pour garder une carte d'étape compacte.
  const [showPhoto, setShowPhoto] = useState(!!step.image);
  const [showTip, setShowTip] = useState(!!step.tip);

  const ingImg = (ing) => ing.recipeId
    ? ((recipes || []).find(r => r.id === ing.recipeId)?.image || "")
    : ((ingredientDB || []).find(d => d.id === ing.dbId)?.image || (ing.name ? findIngredientMatch(ing.name, ingredientDB || [])?.image || "" : ""));
  const utImg = (u) => (utensilDB || []).find(d => d.id === u.dbId)?.image || "";

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? e => { e.dataTransfer.setData("stepIdx", String(index)); setDragging(true); } : undefined}
      onDragEnd={isDraggable ? () => setDragging(false) : undefined}
      onDragOver={isDraggable ? e => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={isDraggable ? () => setOver(false) : undefined}
      onDrop={isDraggable ? e => { e.preventDefault(); setOver(false); const raw = e.dataTransfer.getData("stepIdx"); if (raw === "") return; const from = +raw; if (from !== index) onMove(from, index); } : undefined}
      style={{ background: "var(--surface)", borderRadius: 18, padding: 16, border: `1px solid ${over ? "var(--accent)" : "var(--border)"}`, opacity: dragging ? 0.5 : 1, boxShadow: over ? "0 8px 24px -12px rgba(232,112,58,0.5)" : "0 1px 2px rgba(0,0,0,0.04)", transition: "opacity 0.15s, border-color 0.15s, box-shadow 0.2s", cursor: isDraggable ? "grab" : "default" }}
    >
      {/* En-tête : poignée + numéro (badge dégradé) · section + supprimer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {isDraggable && <span style={{ display: "flex", color: "var(--text3)", cursor: "grab", touchAction: "none" }}><Icon name="drag" size={16} color="var(--text3)" /></span>}
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), #f0894e)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 2px 6px -1px rgba(232,112,58,0.5)", flexShrink: 0 }}>{index + 1}</span>
          {!isDraggable && <MoveArrows index={index} total={total} onMove={onMove} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => onRemove(step.id)} onMouseEnter={() => setTrashHover(true)} onMouseLeave={() => setTrashHover(false)}
            style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", cursor: "pointer", border: "none", background: trashHover ? "rgba(224,82,82,0.14)" : "transparent", transition: "background 0.15s" }}>
            <Icon name="trash" size={15} color="var(--red)" />
          </button>
        </div>
      </div>

      {/* Instructions — surface douce, sans bordure dure */}
      <AutoResizeTextarea className="field-input step-instructions" placeholder="Décris cette étape…" value={step.text} onChange={e => onUpdate(step.id, "text", e.target.value)}
        style={{ marginBottom: 12, background: "var(--surface2)", border: "1px solid transparent", borderRadius: 14, padding: "13px 15px", fontSize: 14.5, lineHeight: 1.55, minHeight: 88 }} />

      {/* Add-ons optionnels : chips discrètes tant qu'ils ne sont pas utilisés */}
      {(!showPhoto || !showTip) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {!showPhoto && (
            <button onClick={() => setShowPhoto(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--surface2)", color: "var(--text2)", border: "1px dashed var(--border)", cursor: "pointer" }}>
              <Icon name="photo" size={14} color="var(--text3)" /> Photo
            </button>
          )}
          {!showTip && (
            <button onClick={() => setShowTip(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--surface2)", color: "var(--text2)", border: "1px dashed var(--border)", cursor: "pointer" }}>
              <Icon name="bulb" size={14} color="var(--blue)" /> Astuce
            </button>
          )}
        </div>
      )}

      {/* Photo de l'étape */}
      {showPhoto && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Icon name="photo" size={13} color="var(--text3)" /><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}>Photo</span></span>
            <button onClick={() => { onUpdate(step.id, "image", ""); setShowPhoto(false); }} style={{ fontSize: 11.5, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="close" size={12} color="var(--text3)" /> Retirer</button>
          </div>
          <ImageUpload value={step.image} onChange={v => onUpdate(step.id, "image", v)} style={{ height: 130, borderRadius: 14 }} pathPrefix="steps" />
        </div>
      )}

      {/* Astuce du chef */}
      {showTip && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Icon name="bulb" size={13} color="var(--blue)" /><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}>Astuce</span></span>
            <button onClick={() => { onUpdate(step.id, "tip", ""); setShowTip(false); }} style={{ fontSize: 11.5, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="close" size={12} color="var(--text3)" /> Retirer</button>
          </div>
          <input className="field-input" placeholder="Un conseil pour réussir cette étape…" value={step.tip || ""} onChange={e => onUpdate(step.id, "tip", e.target.value)}
            style={{ marginBottom: 0, background: "rgba(91,156,246,0.07)", border: "1px solid rgba(91,156,246,0.25)", borderRadius: 12 }} />
        </div>
      )}

      {/* Ingrédients liés — vignette + nom + quantité, état sélectionné plein accent */}
      {ingredients.length > 0 && (
        <>
          <BlockLabel icon="leaf" color="var(--green)">Ingrédients de l'étape</BlockLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: utensils.length > 0 ? 14 : 0 }}>
            {ingredients.map(ing => {
              const linked = step.ingredients?.includes(ing.id);
              const displayName = ing.recipeId
                ? ((recipes || []).find(r => r.id === ing.recipeId)?.name || ing.name || "Base")
                : (ing.name || "sans nom");
              const img = ingImg(ing);
              return (
                <button key={ing.id} onClick={() => onUpdate(step.id, "ingredients", linked ? step.ingredients.filter(x => x !== ing.id) : [...(step.ingredients || []), ing.id])}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 12px 4px 4px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    background: linked ? "rgba(232,112,58,0.14)" : "var(--surface2)",
                    color: linked ? "var(--accent)" : "var(--text2)",
                    border: `1px solid ${linked ? "rgba(232,112,58,0.5)" : "var(--border)"}`, transition: "background 0.15s, border-color 0.15s, color 0.15s" }}>
                  {img
                    ? <IngImage src={img} alt={displayName} size={24} cover={!!ing.recipeId} />
                    : <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center" }}><Icon name="leaf" size={11} color="var(--text3)" /></span>}
                  <span style={{ textTransform: "capitalize" }}>{displayName}</span>
                  {linked && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", opacity: 0.75 }}>{fmtQtyUnit(ing.amount, ing.unit)}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Ustensiles liés */}
      {utensils.length > 0 && (
        <>
          <BlockLabel icon="settings" color="var(--text3)">Ustensiles de l'étape</BlockLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {utensils.map(u => {
              const linked = step.utensils?.includes(u.id);
              const img = utImg(u);
              return (
                <button key={u.id} onClick={() => onUpdate(step.id, "utensils", linked ? step.utensils.filter(x => x !== u.id) : [...(step.utensils || []), u.id])}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: img ? "4px 12px 4px 4px" : "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    background: linked ? "rgba(76,175,125,0.16)" : "var(--surface2)",
                    color: linked ? "var(--green)" : "var(--text2)",
                    border: `1px solid ${linked ? "rgba(76,175,125,0.5)" : "var(--border)"}`, transition: "background 0.15s, border-color 0.15s, color 0.15s" }}>
                  {img && <UtImage src={img} alt={u.name} size={24} radius={7} />}
                  {u.name || "sans nom"}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
