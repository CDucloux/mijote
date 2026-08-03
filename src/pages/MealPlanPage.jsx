import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Icon } from "../components/Icon.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { NutriScoreBadge } from "../components/NutriScoreBadge.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount } from "@/lib/household/household.js";
import { MEAL_SLOTS, SLOT_BY_ID } from "../constants/mealSlots.js";
import { useMealPlanner } from "../hooks/useMealPlanner.js";
import { useLS } from "../hooks/useLS.js";
import { groupSlotMeals, itemRole, roleLabel, newGroupId, roleForCategory, platNeedsSide } from "@/lib/planning/composedMeal.js";
import { suggestSides } from "@/lib/planning/mealPlanner.js";
import { buildBatchSession, weekEntries, buildMiseEnPlace, groupCookings } from "@/lib/planning/batchSession.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { fmtQtyUnit } from "@/lib/format.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { currentMonth } from "@/lib/food/seasonality.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

// Rôles proposés pour compléter un repas (le plat existe déjà).
const COMPLETE_ROLES = [
  { id: "entree", label: "Entrée" },
  { id: "accompagnement", label: "Accompagnement" },
  { id: "dessert", label: "Dessert" },
];

// ─── MEAL PLAN – module-level constants & pure helpers ────────────────────────
const MP_DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MP_MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MP_SLOT_LABEL = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, `${s.emoji} ${s.label}`]));
const MP_SLOT_COLOR = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.color]));
const MP_SLOT_TEXT = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.text]));
const MP_SLOT_TIMES = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s.ics]));
const MEAL_ROLE_IDS = ["entree", "plat", "accompagnement", "dessert"];

function mpGetWeekDays(ref) {
  const d = new Date(ref), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd.toISOString().slice(0, 10); });
}
function mpPad(n) { return String(n).padStart(2, "0"); }
function mpToICSDate(dateStr, timeStr) { return dateStr.split("-").join("") + "T" + timeStr; }
function mpEscapeICS(s) { return (s || "").split("\n").join("\\n").split(",").join("\\,").split(";").join("\\;"); }

// SlotZone lifted out + memoised → never re-created on parent re-render
const SlotZone = React.memo(function SlotZone({ date, slot, meals, dropTarget, dragInfo, mealPlan, recipesById, onSelectRecipe, onRemoveMeal, onMoveMeal, onSetDropTarget, onSetDragInfo, onComplete }) {
  const dropKey = date + ":" + slot;
  const isOver = dropTarget === dropKey;
  return (
    <div
      onDragOver={e => { e.preventDefault(); onSetDropTarget(dropKey); }}
      onDragLeave={() => onSetDropTarget(null)}
      onDrop={e => { e.preventDefault(); onSetDropTarget(null); if (dragInfo && !(dragInfo.date === date && dragInfo.slot === slot)) { onMoveMeal(dragInfo.date, dragInfo.idx, date, slot); } onSetDragInfo(null); }}
      style={{ borderRadius: 10, padding: "6px 8px", background: isOver ? "rgba(232,112,58,0.12)" : MP_SLOT_COLOR[slot], border: `1px solid ${isOver ? "var(--accent)" : "transparent"}`, transition: "all 0.15s", minHeight: 60, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, justifyContent: meals.length ? "flex-start" : "center" }}>
      {groupSlotMeals(meals, recipesById).map((g, gi) => {
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
          <div key={g.groupId || `g${gi}`} style={composed ? { borderLeft: `2px solid ${MP_SLOT_TEXT[slot]}`, paddingLeft: 7, display: "flex", flexDirection: "column", gap: 5 } : undefined}>
            {items.map(({ item }) => {
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
            {slot !== "matin" && onComplete && !full && (
              <button onClick={() => onComplete(date, slot, g)} title="Compléter le repas (entrée, accompagnement, dessert)"
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: "transparent", color: MP_SLOT_TEXT[slot], border: `1px dashed ${MP_SLOT_TEXT[slot]}`, cursor: "pointer" }}>
                <Icon name="plus" size={10} color={MP_SLOT_TEXT[slot]} /> Compléter
              </button>
            )}
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
  const recipesById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);

  // Composition manuelle : contexte pour suggérer des recettes par rôle.
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const suggestCtx = useMemo(() => ({ resolver, byId: recipesById, month: currentMonth(), stockSet: new Set(stock || []), preferences }), [resolver, recipesById, stock, preferences]);
  const eligiblePool = useMemo(() => recipes.filter(r => !r.isComponent && isEligible(r, preferences, { resolver, byId: recipesById })), [recipes, preferences, resolver, recipesById]);
  const [composeFor, setComposeFor] = useState(null); // { date, slot, groupId, baseIdx, baseRecipeId }
  const [completeRole, setCompleteRole] = useState("accompagnement");
  const [completeSearch, setCompleteSearch] = useState("");

  const openComplete = useCallback((date, slot, group) => {
    const platEntry = group.items.find(x => itemRole(x.item, recipesById.get(x.item.recipeId)) === "plat") || group.items[0];
    setComposeFor({ date, slot, groupId: group.groupId || null, baseIdx: (mealPlan[date] || []).indexOf(platEntry.item), baseRecipeId: platEntry.item.recipeId });
    setCompleteRole("accompagnement"); setCompleteSearch("");
  }, [mealPlan, recipesById]);

  const attachToMeal = useCallback((recipeId, role) => {
    if (!composeFor) return;
    setMealPlan(prev => {
      const entries = [...(prev[composeFor.date] || [])];
      let gid = composeFor.groupId;
      if (!gid) { gid = newGroupId(); const b = entries[composeFor.baseIdx]; if (b) entries[composeFor.baseIdx] = { ...b, groupId: gid, role: b.role || "plat" }; }
      entries.push({ recipeId, slot: composeFor.slot, portions: 1, role, groupId: gid });
      return { ...prev, [composeFor.date]: entries };
    });
    notify("Ajouté au repas");
    setComposeFor(null);
  }, [composeFor, setMealPlan, notify]);

  // Génération de la semaine visible (créneaux midi/soir vides), avec un
  // sous-menu de configuration (style : facile / équilibré / aventureux).
  const [genDone, setGenDone] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genStyle, setGenStyle] = useState("equilibre");
  const [genBatch, setGenBatch] = useState(false); // batch cooking : tout préparer d'avance
  // Créneaux à remplir à la génération auto. Persisté : c'est une habitude récurrente
  // (ex. cantine le midi en semaine → on ne génère que le soir). Au moins un créneau.
  const [genSlots, setGenSlots] = useLS("rf_gen_slots", ["midi", "soir"]);
  const toggleGenSlot = useCallback((slot) => setGenSlots(prev => {
    const set = new Set(prev);
    if (set.has(slot)) { if (set.size === 1) return prev; set.delete(slot); } else set.add(slot);
    // Ordre stable midi → soir (indépendant de l'ordre de clic).
    return ["midi", "soir"].filter(s => set.has(s));
  }), [setGenSlots]);
  const [showBatch, setShowBatch] = useState(false); // panneau session batch ouvert ?
  const runGenerate = useCallback((style, batch) => {
    const ppm = household ? peopleCount(household) : 2; // portions par repas = mangeurs
    const slots = genSlots.length ? genSlots : ["midi", "soir"];
    const slotsLabel = slots.map(s => SLOT_BY_ID[s]?.label || s).join(" et ").toLowerCase();
    const { count } = generate(weekDays, slots, { compose: true, portionsPerMeal: ppm, style });
    setGenOpen(false);
    if (count > 0) {
      setGenDone(true);
      notify(`${count} repas proposés, à relire et ajuster`, "success");
      // Batch cooking demandé → on ouvre directement la session (tout à préparer).
      if (batch) setShowBatch(true);
    } else if (!recipes.length) {
      // Aucune recette en bibliothèque : rien à proposer (≠ semaine déjà remplie).
      notify("Ajoute d'abord des recettes pour générer une semaine", "info");
    } else notify(`Cette semaine est déjà remplie (${slotsLabel})`, "info");
  }, [generate, weekDays, notify, household, recipes, genSlots]);
  const handleUndo = useCallback(() => { if (undo()) { setGenDone(false); notify("Génération annulée", "info"); } }, [undo, notify]);

  // Session batch : vue dérivée de la semaine visible (plats à cuisiner + bases partagées).
  // Calculée UNIQUEMENT quand le panneau batch est ouvert : sinon on la recalculait
  // à chaque changement de semaine (dép. weekDays) pour un panneau fermé — pur gaspi.
  const batch = useMemo(
    () => showBatch ? buildBatchSession(weekEntries(mealPlan, weekDays), recipes) : { dishes: [], bases: [] },
    [showBatch, mealPlan, weekDays, recipes]
  );
  // Mise en place mutualisée (par ingrédient) + cuissons regroupées : calculées
  // uniquement quand le panneau est ouvert (dérivées des plats de la session).
  const categoryOrder = useCallback(cat => DEFAULT_CATEGORIES[cat]?.order ?? 99, []);
  // Seuls les produits frais à travailler valent la mutualisation de la découpe.
  const PREP_CATEGORIES = useMemo(() => new Set(["vegetable", "herbs"]), []);
  const miseEnPlace = useMemo(
    () => showBatch ? buildMiseEnPlace(batch.dishes, { recipesById, resolver, ingredientDB: ingredientDB || [], stockSet: new Set(stock || []), categoryOrder, includeCategories: PREP_CATEGORIES }) : [],
    [showBatch, batch, recipesById, resolver, ingredientDB, stock, categoryOrder, PREP_CATEGORIES]
  );
  const cookingGroups = useMemo(() => showBatch ? groupCookings(batch.dishes) : [], [showBatch, batch]);
  // La semaine visible contient-elle au moins un plat (≠ base) ? Conditionne l'accès
  // à la session batch depuis le header (ré-ouvrable à tout moment, pas seulement
  // juste après une génération).
  const hasWeekDishes = useMemo(() => {
    const ids = new Set(recipes.filter(r => !r.isComponent).map(r => r.id));
    return weekEntries(mealPlan, weekDays).some(e => ids.has(e.recipeId));
  }, [mealPlan, weekDays, recipes]);
  const prepCount = useMemo(() => miseEnPlace.reduce((n, g) => n + g.items.length, 0), [miseEnPlace]);
  const [checkedPrep, setCheckedPrep] = useState(() => new Set());
  const togglePrep = useCallback(key => setCheckedPrep(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; }), []);
  // Repartir d'une checklist vierge à chaque ouverture / changement de session.
  useEffect(() => { if (showBatch) setCheckedPrep(new Set()); }, [showBatch, weekDays]);
  // Change de semaine → on repart d'un état « générable » (le bouton undo ne vaut
  // que pour la dernière génération sur la semaine où elle a eu lieu).
  useEffect(() => { setGenDone(false); }, [weekDays]);

  const getMeals = useCallback((date, slot) => (mealPlan[date] || []).filter(m => m.slot === slot), [mealPlan]);

  const removeMeal = useCallback((date, idx) => setMealPlan(prev => { const arr = [...(prev[date] || [])]; arr.splice(idx, 1); return { ...prev, [date]: arr }; }), [setMealPlan]);
  const moveMeal = useCallback((fromDate, fromIdx, toDate, toSlot) => setMealPlan(prev => {
    const from = [...(prev[fromDate] || [])];
    const [orig] = from.splice(fromIdx, 1);
    if (!orig) return prev;
    const toArr = fromDate === toDate ? from : [...(prev[toDate] || [])];
    // Rattache l'item au repas déjà présent sur le créneau cible (même groupId) :
    // sinon il apparaissait comme un nouveau repas orphelin sous l'existant.
    // Aucun repas cible → il forme son propre repas (midi/soir), matin = sans groupe.
    const targetGroup = toArr.find(m => m.slot === toSlot && m.groupId)?.groupId
      || (toSlot === "matin" ? undefined : newGroupId());
    const moved = { ...orig, slot: toSlot };
    if (targetGroup) moved.groupId = targetGroup; else delete moved.groupId;
    toArr.push(moved);
    return fromDate === toDate ? { ...prev, [fromDate]: toArr } : { ...prev, [fromDate]: from, [toDate]: toArr };
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
  const toICSDate = mpToICSDate;
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
            {hasWeekDishes && (
              <button onClick={() => setShowBatch(true)} title="Session batch : mise en place mutualisée et cuissons regroupées" aria-label="Session batch"
                style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(76,175,125,0.14)", border: "1px solid rgba(76,175,125,0.3)", cursor: "pointer" }}>
                <Icon name="fire" size={17} color="var(--green)" />
              </button>
            )}
            {genDone
              ? <button onClick={handleUndo} className="btn btn-ghost" style={{ padding: "8px 12px", borderRadius: 12, fontSize: 13 }}><Icon name="back" size={15} /> Annuler</button>
              : <button onClick={() => setGenOpen(true)} className="btn btn-primary btn-pill"><Icon name="calendar" size={15} /> Générer</button>}
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
                    {MEAL_SLOTS.filter(s => s.id !== "matin" || getMeals(date, s.id).length).map(s => (
                      <SlotZone key={s.id} date={date} slot={s.id} meals={getMeals(date, s.id)} dropTarget={dropTarget} dragInfo={dragInfo} mealPlan={mealPlan} recipesById={recipesById} onSelectRecipe={onSelectRecipe} onRemoveMeal={removeMeal} onMoveMeal={moveMeal} onSetDropTarget={setDropTarget} onSetDragInfo={setDragInfo} onComplete={openComplete} />
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

      {/* Sous-menu de génération : choix du style de repas */}
      {genOpen && (
        <SwipeableSheet onClose={() => setGenOpen(false)} style={{ maxHeight: "82dvh" }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px" }}>Générer la semaine</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "0 0 16px" }}>Quel style de repas veux-tu pour les créneaux vides&nbsp;?</p>

          {/* Créneaux à remplir : par défaut midi + soir. Décocher « Midi » quand on
              mange à la cantine en semaine (l'auto-génération le laisse alors libre). */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 9 }}>Créneaux à remplir</span>
            <div style={{ display: "flex", gap: 10 }}>
              {["midi", "soir"].map(slot => {
                const active = genSlots.includes(slot);
                return (
                  <button key={slot} onClick={() => toggleGenSlot(slot)} className="pressable" style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
                    padding: "11px 0", borderRadius: 13, fontSize: 14, fontWeight: 600,
                    color: active ? "var(--accent)" : "var(--text3)",
                    background: active ? "rgba(232,112,58,0.12)" : "var(--surface2)",
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent)" : "transparent" }}>
                      {active && <Icon name="check" size={11} color="#fff" />}
                    </span>
                    {SLOT_BY_ID[slot]?.label || slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {[
              { id: "facile", icon: "clock", title: "Facile et rapide", desc: "Peu d'ingrédients, préparation et cuisson courtes. Idéal quand on manque de temps." },
              { id: "equilibre", icon: "leaf", title: "Équilibré", desc: "Un bon compromis entre saison, santé, variété et effort." },
              { id: "aventureux", icon: "fire", title: "Aventureux", desc: "Des recettes plus élaborées et plus difficiles, pour se lancer des défis." },
            ].map(o => {
              const active = genStyle === o.id;
              return (
                <button key={o.id} onClick={() => setGenStyle(o.id)} className="pressable" style={{
                  display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "13px 14px", borderRadius: 15,
                  background: active ? "rgba(232,112,58,0.12)" : "var(--surface2)",
                  border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: active ? "rgba(232,112,58,0.2)" : "var(--surface3)" }}>
                    <Icon name={o.icon} size={19} color={active ? "var(--accent)" : "var(--text2)"} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{o.title}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>{o.desc}</span>
                  </span>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent)" : "transparent" }}>
                    {active && <Icon name="check" size={12} color="#fff" />}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Batch cooking : tout préparer d'avance (ex. le dimanche) */}
          <button onClick={() => setGenBatch(v => !v)} className="pressable" style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
            padding: "12px 14px", borderRadius: 14, marginBottom: 16,
            background: genBatch ? "rgba(76,175,125,0.12)" : "var(--surface2)",
            border: `1.5px solid ${genBatch ? "var(--green)" : "var(--border)"}`,
          }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: genBatch ? "rgba(76,175,125,0.2)" : "var(--surface3)" }}>
              <Icon name="fire" size={18} color={genBatch ? "var(--green)" : "var(--text2)"} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Batch cooking</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>Regroupe tout ce qu'il y a à cuisiner pour la semaine en une seule session à préparer d'avance.</span>
            </span>
            <span style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, padding: 2, background: genBatch ? "var(--green)" : "var(--surface3)", display: "flex", justifyContent: genBatch ? "flex-end" : "flex-start", transition: "background 0.15s" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff" }} />
            </span>
          </button>
          <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "12px 0" }} onClick={() => runGenerate(genStyle, genBatch)}>
            <Icon name="calendar" size={16} /> Générer la semaine
          </button>
        </SwipeableSheet>
      )}

      {/* Session batch : plats à cuisiner + préparations de base partagées */}
      {showBatch && (
        <SwipeableSheet onClose={() => setShowBatch(false)} style={{ maxHeight: "84dvh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(76,175,125,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="fire" size={16} color="var(--green)" /></span>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Session batch</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 14px" }}>Prépare une fois pour toute la semaine : on mutualise la découpe des ingrédients et les cuissons.</p>

          {batch.dishes.length === 0
            ? <p style={{ fontSize: 13, color: "var(--text3)", padding: "8px 0" }}>Planifie des repas cette semaine pour voir la session batch.</p>
            : <>
              {/* Récap de session */}
              <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                {[
                  { n: prepCount, l: "ingrédient", icon: "🔪" },
                  { n: batch.dishes.reduce((s, d) => s + d.cookings, 0), l: "cuisson", icon: "🔥" },
                  { n: batch.dishes.reduce((s, d) => s + d.meals, 0), l: "repas couverts", icon: "🍽️" },
                ].map((c, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 88, padding: "9px 10px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{c.n}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{c.icon} {c.l}{c.n > 1 ? "s" : ""}</div>
                  </div>
                ))}
              </div>

              {/* ── 1. Mise en place mutualisée (par ingrédient) ── */}
              {miseEnPlace.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="field-label" style={{ marginBottom: 4 }}>Mise en place</div>
                  <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 12px", lineHeight: 1.4 }}>Prépare tous ces ingrédients d'un coup, toutes recettes confondues.</p>
                  {miseEnPlace.map(group => {
                    const cat = DEFAULT_CATEGORIES[group.category] || { label: "Autres", icon: "📦" };
                    return (
                      <div key={group.category} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                          <span style={{ fontSize: 13 }}>{cat.icon}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{cat.label}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {group.items.map(it => {
                            const done = checkedPrep.has(it.key);
                            const qty = it.unit ? fmtQtyUnit(it.amount, it.unit) : `${it.amount}`;
                            return (
                              <button key={it.key} onClick={() => togglePrep(it.key)} className="pressable" style={{
                                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer",
                                padding: "8px 10px", borderRadius: 11, background: done ? "rgba(76,175,125,0.08)" : "var(--surface2)",
                                border: `1px solid ${done ? "rgba(76,175,125,0.3)" : "var(--border)"}`, opacity: done ? 0.7 : 1,
                              }}>
                                <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, display: "grid", placeItems: "center", border: `2px solid ${done ? "var(--green)" : "var(--border)"}`, background: done ? "var(--green)" : "transparent" }}>
                                  {done && <Icon name="check" size={12} color="#fff" />}
                                </span>
                                {it.image && <span style={{ width: 26, height: 26, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: "#fff", border: "1px solid var(--border)" }}><Img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} /></span>}
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: done ? "line-through" : "none" }}>{it.name}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{qty}{it.pieces ? ` · ~${it.pieces}` : ""}</span>
                                  </span>
                                  {(it.prepTip || it.usedBy.length > 1) && (
                                    <span style={{ display: "block", fontSize: 10.5, color: "var(--text3)", marginTop: 1 }}>
                                      {it.prepTip ? it.prepTip : ""}{it.prepTip && it.usedBy.length > 1 ? " · " : ""}{it.usedBy.length > 1 ? `pour ${it.usedBy.length} recettes` : ""}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── 2. Cuissons regroupées (mutualiser le four / les feux) ── */}
              {cookingGroups.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="field-label" style={{ marginBottom: 4 }}>Cuissons à mutualiser</div>
                  <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 12px", lineHeight: 1.4 }}>Ces plats partagent le même appareil — lance-les ensemble.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cookingGroups.map(g => (
                      <div key={g.method} style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(232,112,58,0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="fire" size={13} color="var(--accent)" /></span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                          <span style={{ fontSize: 10.5, color: "var(--text3)" }}>· {g.dishes.length} plats</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text2)", paddingLeft: 31 }}>{g.dishes.map(d => d.recipe.name).join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3. Préparations de base à faire d'avance ── */}
              {batch.bases.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="field-label" style={{ marginBottom: 10 }}>À préparer d'avance</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {batch.bases.map(b => (
                      <div key={b.recipe.id} onClick={() => { setShowBatch(false); onSelectRecipe(b.recipe.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: b.shared ? "rgba(76,175,125,0.08)" : "var(--surface2)", borderRadius: 12, border: `1px solid ${b.shared ? "rgba(76,175,125,0.3)" : "var(--border)"}`, cursor: "pointer" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.recipe.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Pour {b.usedBy.join(", ")}</div>
                        </div>
                        {b.shared && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--green)", background: "rgba(76,175,125,0.16)", padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em" }}>Partagé</span>}
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>{b.amount} {b.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 4. Plats à cuisiner ── */}
              <div className="field-label" style={{ marginBottom: 10 }}>À cuisiner</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {batch.dishes.map(d => (
                  <button key={d.recipe.id} onClick={() => { setShowBatch(false); onSelectRecipe(d.recipe.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "left" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Img src={d.recipe.image} alt={d.recipe.name} style={{ width: "100%", height: "100%" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.recipe.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{d.meals} repas · {d.cookings} cuisson{d.cookings > 1 ? "s" : ""} · {d.servings} portions</div>
                    </div>
                    <Icon name="forward" size={15} color="var(--text3)" />
                  </button>
                ))}
              </div>
            </>}
        </SwipeableSheet>
      )}

      {/* Compléter un repas : entrée / accompagnement / dessert, suggérés de saison */}
      {composeFor && (() => {
        const base = recipesById.get(composeFor.baseRecipeId);
        const q = normalizeStr(completeSearch.trim());
        const list = q
          ? eligiblePool.filter(r => roleForCategory(r.category || "") === completeRole && normalizeStr(r.name).includes(q)).slice(0, 20)
          : suggestSides(base, eligiblePool, suggestCtx, { role: completeRole, max: 12 });
        return (
          <SwipeableSheet onClose={() => setComposeFor(null)} style={{ maxHeight: "82dvh" }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>Compléter le repas</h3>
            {base && <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 14 }}>Autour de <strong style={{ color: "var(--text2)" }}>{base.name}</strong></div>}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {COMPLETE_ROLES.map(r => (
                <button key={r.id} onClick={() => setCompleteRole(r.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  background: completeRole === r.id ? "rgba(232,112,58,0.16)" : "var(--surface2)", color: completeRole === r.id ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${completeRole === r.id ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>{r.label}</button>
              ))}
            </div>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={15} color="var(--text3)" /></span>
              <input className="field-input" placeholder={`Rechercher ${roleLabel(completeRole).toLowerCase()}…`} value={completeSearch} onChange={e => setCompleteSearch(e.target.value)} style={{ paddingLeft: 34 }} />
            </div>
            {!q && <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Icon name="sun" size={12} color="var(--accent)" /> Suggestions de saison</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "48vh" }}>
              {list.map(r => (
                <button key={r.id} onClick={() => attachToMeal(r.id, completeRole)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "left" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    {r.cuisine && <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.cuisine}</div>}
                  </div>
                  <Icon name="plus" size={16} color="var(--accent)" />
                </button>
              ))}
              {list.length === 0 && <p style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>Aucune recette « {roleLabel(completeRole).toLowerCase()} » {q ? "trouvée" : "disponible"}</p>}
            </div>
          </SwipeableSheet>
        );
      })()}
    </div>
  );
}
