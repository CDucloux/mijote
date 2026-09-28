import React from "react";
import { Icon } from "../Icon.jsx";
import { Img } from "../Img.jsx";
import { MEAL_SLOTS, SLOT_BY_ID } from "../../constants/mealSlots.js";
import { mealsForSlot, itemRole, roleLabel, platNeedsSide } from "@/lib/planning/composedMeal.js";

const MP_SLOT_LABEL = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, `${s.emoji} ${s.label}`]));
const MP_SLOT_COLOR = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.color]));
const MP_SLOT_TEXT = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.text]));
const MEAL_ROLE_IDS = ["entree", "plat", "accompagnement", "dessert"];

// Créneau d'une journée du planning : liste les repas (composés ou simples) posés
// sur ce slot, gère le drag-and-drop, le menu contextuel (appui long) et le bouton
// « Compléter » quand le repas n'est pas encore complet.
// Sorti du composant page et mémoïsé → jamais recréé au re-render du parent.
export const SlotZone = React.memo(function SlotZone({ date, slot, meals, dropTarget, dragInfo, mealPlan, recipesById, onSelectRecipe, onRemoveMeal, onMoveMeal, onSetDropTarget, onSetDragInfo, onComplete, onOpenItemMenu, onAdd, startLongPress, cancelLongPress, moveLongPress, wasLongPress }) {
  const dropKey = date + ":" + slot;
  const isOver = dropTarget === dropKey;
  const slotGroups = mealsForSlot(meals, recipesById);
  const hasContent = slotGroups.some(g => g.items.some(({ item }) => recipesById.has(item.recipeId)));
  const meta = SLOT_BY_ID[slot];
  const mealLower = meta.meal.toLowerCase();
  return (
    <div
      onDragOver={e => { e.preventDefault(); onSetDropTarget(dropKey); }}
      onDragLeave={() => onSetDropTarget(null)}
      onDrop={e => { e.preventDefault(); onSetDropTarget(null); if (dragInfo && !(dragInfo.date === date && dragInfo.slot === slot)) { onMoveMeal(dragInfo.date, dragInfo.idx, date, slot); } onSetDragInfo(null); }}
      style={{ borderRadius: 10, padding: hasContent ? "6px 8px" : 0, background: isOver ? "rgba(var(--accent-rgb),0.12)" : (hasContent ? MP_SLOT_COLOR[slot] : "transparent"), border: `1px solid ${isOver ? "var(--accent)" : "transparent"}`, transition: "all 0.15s", minHeight: 60, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, justifyContent: hasContent ? "flex-start" : "center" }}>
      {hasContent ? (() => {
      // La barre verticale ne distingue les repas que s'il y en a PLUSIEURS dans le
      // slot (ex. un 2ᵉ plat). Un repas unique (même composé plat+entrée+dessert) ne
      // porte pas de barre : les rôles suffisent à le lire.
      const multiMeal = slotGroups.length > 1;
      return slotGroups.map((g, gi) => {
        // On ignore les items dont la recette n'existe plus (recette supprimée de
        // la bibliothèque → entrée orpheline). Un groupe entièrement orphelin ne
        // rend rien : sinon la bordure + le bouton « Compléter » restaient affichés
        // sur un créneau visuellement vide.
        const items = g.items.filter(({ item }) => recipesById.has(item.recipeId));
        if (items.length === 0) return null;
        // Un item généré porte toujours un groupId → c'est un repas (composé),
        // même s'il n'a qu'un plat pour l'instant (plus de « plat orphelin »).
        const composed = !!g.groupId;
        const roles = new Set(items.map(({ item }) => itemRole(item, recipesById.get(item.recipeId))));
        // Un plat qui se suffit (soupe, pasta…) n'attend pas d'accompagnement :
        // le repas est « complet » sans lui.
        const platItem = items.find(({ item }) => itemRole(item, recipesById.get(item.recipeId)) === "plat");
        const needsSide = !platItem || platNeedsSide(recipesById.get(platItem.item.recipeId));
        const required = needsSide ? MEAL_ROLE_IDS : MEAL_ROLE_IDS.filter(r => r !== "accompagnement");
        const full = required.every(r => roles.has(r));
        return (
          <div key={g.groupId || `g${gi}`} style={composed ? { ...(multiMeal ? { borderLeft: `2px solid ${MP_SLOT_TEXT[slot]}`, paddingLeft: 7 } : {}), display: "flex", flexDirection: "column", gap: 5 } : undefined}>
            {items.map(({ item }) => {
              const r = recipesById.get(item.recipeId);
              if (!r) return null;
              const globalIdx = (mealPlan[date] || []).indexOf(item);
              const role = itemRole(item, r);
              const label = composed ? roleLabel(role) : MP_SLOT_LABEL[slot];
              return (
                <div key={globalIdx} draggable className="hov-tint"
                  onDragStart={() => { cancelLongPress(); onSetDragInfo({ date, idx: globalIdx, slot }); }}
                  onDragEnd={() => onSetDragInfo(null)}
                  onContextMenu={e => { e.preventDefault(); onOpenItemMenu({ date, idx: globalIdx, slot, recipeId: item.recipeId }); }}
                  onPointerDown={e => startLongPress(e, () => onOpenItemMenu({ date, idx: globalIdx, slot, recipeId: item.recipeId }))}
                  onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "grab" }}>
                  <div style={{ width: composed ? 38 : 46, height: composed ? 38 : 46, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                  <button onClick={() => { if (wasLongPress()) return; onSelectRecipe(r.id, date); }} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: MP_SLOT_TEXT[slot] }}>{label}</div>
                    {item.portions > 1 && <div style={{ fontSize: 9, color: "var(--text3)" }}>1/{item.portions}</div>}
                  </button>
                  <button className="mp-remove-btn" onClick={() => onRemoveMeal(date, globalIdx)} title="Retirer du planning"><Icon name="close" size={13} /></button>
                </div>
              );
            })}
            {slot !== "matin" && onComplete && !full && (
              <button onClick={() => onComplete(date, slot, g)} title="Compléter le repas (entrée, accompagnement, dessert)"
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: "transparent", color: MP_SLOT_TEXT[slot], border: `1px dashed ${MP_SLOT_TEXT[slot]}`, cursor: "pointer" }}>
                <Icon name="plus" size={10} color={MP_SLOT_TEXT[slot]} /> Compléter
              </button>
            )}
          </div>
        );
      });
      })() : (
        <button type="button" className="mp-empty-slot ripple" data-slot={slot}
          onClick={() => onAdd(date, [slot], true)}
          aria-label={`Ajouter le ${mealLower}`}>
          <Icon name={meta.icon} size={20} weight="duotone" />
          <span className="mp-empty-txt"><b>{meta.label}</b><em>Ajouter le {mealLower}</em></span>
        </button>
      )}
    </div>
  );
});
