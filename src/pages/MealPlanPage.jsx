import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Icon } from "../components/Icon.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { NutriScoreBadge } from "../components/NutriScoreBadge.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { MEAL_SLOTS, SLOT_BY_ID } from "../constants/mealSlots.js";
import { useMealPlanner } from "../hooks/useMealPlanner.js";
import { groupSlotMeals, itemRole, roleLabel } from "../lib/composedMeal.js";

// ─── MEAL PLAN – module-level constants & pure helpers ────────────────────────
const MP_DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MP_MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MP_SLOT_LABEL = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, `${s.emoji} ${s.label}`]));
const MP_SLOT_COLOR = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.color]));
const MP_SLOT_TEXT = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.text]));
const MP_SLOT_TIMES = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.ics]));

function mpGetWeekDays(ref) {
  const d = new Date(ref), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd.toISOString().slice(0, 10); });
}
function mpGetMonthDays(ref) {
  const y = ref.getFullYear(), m = ref.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0), days = [];
  for (let i = 0; i < (first.getDay() || 7) - 1; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d).toISOString().slice(0, 10));
  return days;
}
function mpPad(n) { return String(n).padStart(2, "0"); }
function mpToICSDate(dateStr, timeStr) { return dateStr.split("-").join("") + "T" + timeStr; }
function mpEscapeICS(s) { return (s || "").split("\n").join("\\n").split(",").join("\\,").split(";").join("\\;"); }

// SlotZone lifted out + memoised → never re-created on parent re-render
const SlotZone = React.memo(function SlotZone({ date, slot, meals, dropTarget, dragInfo, mealPlan, recipesById, onSelectRecipe, onRemoveMeal, onMoveMeal, onSetDropTarget, onSetDragInfo }) {
  const dropKey = date + ":" + slot;
  const isOver = dropTarget === dropKey;
  return (
    <div
      onDragOver={e => { e.preventDefault(); onSetDropTarget(dropKey); }}
      onDragLeave={() => onSetDropTarget(null)}
      onDrop={e => { e.preventDefault(); onSetDropTarget(null); if (dragInfo && !(dragInfo.date === date && dragInfo.slot === slot)) { onMoveMeal(dragInfo.date, dragInfo.idx, date, slot); } onSetDragInfo(null); }}
      style={{ borderRadius: 10, padding: "6px 8px", background: isOver ? "rgba(232,112,58,0.12)" : MP_SLOT_COLOR[slot], border: `1px solid ${isOver ? "var(--accent)" : "transparent"}`, transition: "all 0.15s", minHeight: 60, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, justifyContent: meals.length ? "flex-start" : "center" }}>
      {groupSlotMeals(meals, recipesById).map((g, gi) => {
        const composed = !!g.groupId && g.items.length > 1;
        return (
          <div key={g.groupId || `g${gi}`} style={composed ? { borderLeft: `2px solid ${MP_SLOT_TEXT[slot]}`, paddingLeft: 7, display: "flex", flexDirection: "column", gap: 5 } : undefined}>
            {g.items.map(({ item }) => {
              const r = recipesById.get(item.recipeId);
              if (!r) return null;
              const globalIdx = (mealPlan[date] || []).indexOf(item);
              const role = itemRole(item, r);
              const label = composed ? roleLabel(role) : MP_SLOT_LABEL[slot];
              return (
                <div key={globalIdx} draggable
                  onDragStart={() => onSetDragInfo({ date, idx: globalIdx, slot })}
                  onDragEnd={() => onSetDragInfo(null)}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "grab" }}>
                  <div style={{ width: composed ? 38 : 46, height: composed ? 38 : 46, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                  <button onClick={() => onSelectRecipe(r.id)} style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: MP_SLOT_TEXT[slot] }}>{label}</div>
                    {item.portions > 1 && <div style={{ fontSize: 9, color: "var(--text3)" }}>1/{item.portions}</div>}
                  </button>
                  <button className="mp-remove-btn" onClick={() => onRemoveMeal(date, globalIdx)} title="Retirer du planning"><Icon name="close" size={13} /></button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

// ─── MEAL PLAN TAB ────────────────────────────────────────────────────────────
export function MealPlanPage({ mealPlan, recipes, setMealPlan, onSelectRecipe, ingredientDB, preferences = {}, stock = [] }) {
  const { notify, user } = useAppShell();
  const { household } = useHousehold();
  const { generate, undo } = useMealPlanner({ recipes, ingredientDB, preferences, stock, mealPlan, setMealPlan });
  const [viewMode] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragInfo, setDragInfo] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [searchQ, setSearchQ] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekDays = useMemo(() => mpGetWeekDays(currentDate), [currentDate]);
  const monthDays = useMemo(() => mpGetMonthDays(currentDate), [currentDate]);
  const recipesById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);

  // Génération automatique de la semaine visible (créneaux midi/soir vides).
  const [genDone, setGenDone] = useState(false);
  const handleGenerate = useCallback(() => {
    const { count } = generate(weekDays, ["midi", "soir"], { compose: true });
    if (count > 0) { setGenDone(true); notify(`${count} repas proposés, à relire et ajuster`, "success"); }
    else notify("Cette semaine est déjà remplie (midi et soir)", "info");
  }, [generate, weekDays, notify]);
  const handleUndo = useCallback(() => { if (undo()) { setGenDone(false); notify("Génération annulée", "info"); } }, [undo, notify]);
  // Change de semaine → on repart d'un état « générable » (le bouton undo ne vaut
  // que pour la dernière génération sur la semaine où elle a eu lieu).
  useEffect(() => { setGenDone(false); }, [weekDays]);

  const getMeals = useCallback((date, slot) => (mealPlan[date] || []).filter(m => m.slot === slot), [mealPlan]);

  const removeMeal = useCallback((date, idx) => setMealPlan(prev => { const arr = [...(prev[date] || [])]; arr.splice(idx, 1); return { ...prev, [date]: arr }; }), [setMealPlan]);
  const moveMeal = useCallback((fromDate, fromIdx, toDate, toSlot) => setMealPlan(prev => {
    if (fromDate === toDate) {
      // Same day: splice + re-insert in one atomic array operation
      const arr = [...(prev[fromDate] || [])];
      const [item] = arr.splice(fromIdx, 1);
      item.slot = toSlot;
      arr.push(item);
      return { ...prev, [fromDate]: arr };
    }
    // Different days
    const from = [...(prev[fromDate] || [])];
    const [item] = from.splice(fromIdx, 1);
    item.slot = toSlot;
    return { ...prev, [fromDate]: from, [toDate]: [...(prev[toDate] || []), item] };
  }), [setMealPlan]);
  const addMeal = useCallback((date, slots, recipeId) => {
    setMealPlan(prev => { const e = [...(prev[date] || [])]; slots.forEach(slot => e.push({ recipeId, slot, portions: 1 })); return { ...prev, [date]: e }; });
    setAddModal(null); setSearchQ("");
  }, [setMealPlan]);

  const navigate = useCallback(dir => setCurrentDate(prev => {
    const d = new Date(prev);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    return d;
  }), [viewMode]);

  const openAdd = useCallback((date, slots) => { setAddModal({ date, slots }); setSearchQ(""); }, []);

  const filteredRecipes = useMemo(() =>
    recipes.filter(r => !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase())),
    [recipes, searchQ]
  );

  const SLOT_TIMES = MP_SLOT_TIMES;

  const pad = mpPad;
  const toICSDate = mpToICSDate; // eslint-disable-line
  const escapeICS = mpEscapeICS;

  const exportICS = () => {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RecipeApp//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    let count = 0;

    // En mode foyer, on ajoute les membres comme participants : l'utilisateur courant
    // est l'organisateur, les autres membres sont invités (ATTENDEE) sur chaque repas.
    const myEmail = (user?.email || "").toLowerCase();
    const memberEmails = household ? (household.memberEmails || []) : [];
    const peopleLines = [];
    if (memberEmails.length > 1 && myEmail) {
      peopleLines.push(`ORGANIZER;CN=${escapeICS(user?.displayName || myEmail)}:mailto:${myEmail}`);
      for (const email of memberEmails) {
        if (!email || email.toLowerCase() === myEmail) continue;
        peopleLines.push(`ATTENDEE;CN=${escapeICS(email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`);
      }
    }

    Object.entries(mealPlan).forEach(([date, meals]) => {
      (meals || []).forEach(meal => {
        const recipe = recipes.find(r => r.id === meal.recipeId);
        if (!recipe) return;
        const slot = meal.slot || "midi";
        const times = SLOT_TIMES[slot] || SLOT_TIMES.midi;
        const slotLabel = SLOT_BY_ID[slot]?.meal || "Repas";
        const uid = `${date}-${slot}-${recipe.id}@recipeapp`;
        const now = new Date();
        const dtstamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

        const descParts = [
          recipe.description,
          meal.portions > 1 ? `${recipe.servings} portions sur ${meal.portions} jours` : "",
          `Préparation : ${recipe.prepTime} min`,
          `Cuisson : ${recipe.cookTime} min`,
          `Score santé : ${recipe.healthScore || "–"}/100`,
          recipe.ingredients?.map(i => `• ${i.name} ${i.amount} ${i.unit}`).join("\n") || "",
          recipe.source ? `Source : ${recipe.source}` : "",
        ].filter(Boolean).join("\n");

        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;TZID=Europe/Paris:${toICSDate(date, times.start)}`,
          `DTEND;TZID=Europe/Paris:${toICSDate(date, times.end)}`,
          `SUMMARY:${escapeICS(slotLabel + " – " + recipe.name)}`,
          `DESCRIPTION:${escapeICS(descParts)}`,
          `CATEGORIES:${escapeICS(slotLabel)}`,
          ...peopleLines,
          "END:VEVENT"
        );
        count++;
      });
    });

    lines.push("END:VCALENDAR");

    if (count === 0) { notify?.("Aucun repas dans le planning à exporter", "error"); return; }

    const CRLF = "\r\n";
    const blob = new Blob([lines.join(CRLF)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Mijoté - Planning repas.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    notify?.("Planning exporté dans ton calendrier");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 16px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Planning Repas</h1></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {genDone
              ? <button onClick={handleUndo} className="btn btn-ghost" style={{ padding: "8px 12px", borderRadius: 12, fontSize: 13 }}><Icon name="back" size={15} /> Annuler</button>
              : <button onClick={handleGenerate} className="btn btn-primary" style={{ padding: "8px 13px", borderRadius: 12 }}><Icon name="sparkle" size={15} /> Générer</button>}
            <UserAvatar />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="back" size={16} /></button>
          <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
            {`${new Date(weekDays[0] + "T12:00").getDate()} – ${new Date(weekDays[6] + "T12:00").getDate()} ${MP_MONTHS_FR[new Date(weekDays[6] + "T12:00").getMonth()]} ${new Date(weekDays[6] + "T12:00").getFullYear()}`}
          </span>
          <button onClick={() => navigate(1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="forward" size={16} /></button>
          <button onClick={() => setCurrentDate(new Date())} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(232,112,58,0.15)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.3)", flexShrink: 0 }}>Auj.</button>
          <button onClick={exportICS} title="Ajouter le planning à ton agenda (Google Agenda, Apple Calendrier…)" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(91,156,246,0.15)", border: "1px solid rgba(91,156,246,0.35)", color: "var(--blue)", flexShrink: 0 }}>
            <Icon name="calendar" size={13} color="var(--blue)" /> Agenda
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 12px 16px" }}>
        {viewMode === "week" && (
          <div key={`week-${weekDays[0]}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {weekDays.map((date, di) => {
              const isToday = date === todayStr;
              const d = new Date(date + "T12:00");
              return (
                <div key={date} className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 10, border: `1px solid ${isToday ? "rgba(232,112,58,0.5)" : "var(--border)"}`, animationDelay: `${di * 0.04}s` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text)" }}>
                        {MP_DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                      </span>
                      {isToday && <span style={{ fontSize: 10, background: "rgba(232,112,58,0.2)", color: "var(--accent)", padding: "2px 7px", borderRadius: 10 }}>Aujourd'hui</span>}
                    </div>
                    <button onClick={() => openAdd(date, ["midi"])} className="mp-add-btn" title="Ajouter une recette au planning">
                      <span className="mp-add-label">Ajouter une recette au planning</span>
                      <Icon name="plus" size={13} color="currentColor" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {MEAL_SLOTS.map(s => (
                      <SlotZone key={s.id} date={date} slot={s.id} meals={getMeals(date, s.id)} dropTarget={dropTarget} dragInfo={dragInfo} mealPlan={mealPlan} recipesById={recipesById} onSelectRecipe={onSelectRecipe} onRemoveMeal={removeMeal} onMoveMeal={moveMeal} onSetDropTarget={setDropTarget} onSetDragInfo={setDragInfo} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Add recipe modal */}
      {addModal && (
        <SwipeableSheet onClose={() => { setAddModal(null); setSearchQ(""); }} style={{ maxHeight: "80dvh" }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Ajouter une recette</h3>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>
            {new Date(addModal.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>Repas</div>
            {(() => {
              const slots = addModal.slots;
              // Multi-sélection : on peut ajouter la recette à un ou plusieurs créneaux.
              const toggle = (id) => setAddModal(p => {
                const has = p.slots.includes(id);
                const next = has ? p.slots.filter(s => s !== id) : [...p.slots, id];
                return { ...p, slots: next.length ? next : p.slots }; // garde toujours ≥ 1
              });
              return (
                <div style={{ display: "flex", gap: 5, padding: 5, background: "var(--surface2)", borderRadius: 14, border: "1px solid var(--border)" }}>
                  {MEAL_SLOTS.map(s => {
                    const active = slots.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggle(s.id)}
                        style={{ flex: 1, padding: "9px 6px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                          background: active ? s.color : "transparent",
                          color: active ? s.text : "var(--text3)",
                          border: `1px solid ${active ? "transparent" : "var(--border)"}`, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          transition: "all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
                        <span style={{ fontSize: 15 }}>{s.emoji}</span>{s.label}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={15} color="var(--text3)" /></span>
            <input className="field-input" placeholder="Rechercher une recette…" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ paddingLeft: 34 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "44vh" }}>
            {filteredRecipes.map(r => (
              <button key={r.id} onClick={() => addMeal(addModal.date, addModal.slots, r.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{(r.prepTime || 0) + (r.cookTime || 0)}min | {r.servings} portions</div>
                </div>
                <NutriScoreBadge letter={r.nutriLetter} compact />
              </button>
            ))}
            {filteredRecipes.length === 0 && <p style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>Aucune recette trouvée</p>}
          </div>
        </SwipeableSheet>
      )}
    </div>
  );
}
