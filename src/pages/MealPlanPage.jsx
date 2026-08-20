import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { EmptyArt } from "../components/EmptyArt.jsx";
import { LoadingSpinner } from "../components/LoadingSpinner.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { NutriScoreBadge } from "../components/NutriScoreBadge.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { SearchField } from "../components/SearchField.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount } from "@/lib/household/household.js";
import { MEAL_SLOTS, SLOT_BY_ID } from "../constants/mealSlots.js";
import { useLS } from "../hooks/useLS.js";
import { mealsForSlot, itemRole, roleLabel, newGroupId, roleForCategory, platNeedsSide } from "@/lib/planning/composedMeal.js";
import { suggestSides } from "@/lib/planning/mealPlanner.js";
import { buildBatchSession, weekEntries, buildMiseEnPlace, groupCookings } from "@/lib/planning/batchSession.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { fmtQtyUnit, fmtTime } from "@/lib/format.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { currentMonth } from "@/lib/food/seasonality.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { ElasticScroll } from "../components/ElasticScroll.jsx";

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
      style={{ borderRadius: 10, padding: "6px 8px", background: isOver ? "rgba(var(--accent-rgb),0.12)" : MP_SLOT_COLOR[slot], border: `1px solid ${isOver ? "var(--accent)" : "transparent"}`, transition: "all 0.15s", minHeight: 60, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, justifyContent: meals.length ? "flex-start" : "center" }}>
      {(() => {
      const slotGroups = mealsForSlot(meals, recipesById);
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
      });
      })()}
    </div>
  );
});

// ─── MEAL PLAN TAB ────────────────────────────────────────────────────────────
export function MealPlanPage({ mealPlan, recipes, setMealPlan, onSelectRecipe, ingredientDB, preferences = {}, stock = [], loading = false, generate, undo, undoKey = null }) {
  const { notify, user, isPlus } = useAppShell();
  // Routeur (distinct du `navigate` local de navigation entre semaines) : renvoie
  // vers l'offre Cardamome+ quand une fonctionnalité premium est verrouillée.
  const gotoRoute = useNavigate();
  const goPlus = () => gotoRoute("/plus");
  const { household } = useHousehold();
  const [viewMode] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragInfo, setDragInfo] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [addedId, setAddedId] = useState(null); // recette en cours de confirmation (+→✓)

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
  // Session batch = PAGE dédiée portée par l'URL (/meal-plan/batch), comme le mode
  // cuisine : accès direct, retour arrière propre, survit à un remontage.
  const location = useLocation();
  const batchOpen = location.pathname === "/meal-plan/batch";
  const openBatch = useCallback(() => gotoRoute("/meal-plan/batch"), [gotoRoute]);
  const closeBatch = useCallback(() => gotoRoute("/meal-plan"), [gotoRoute]);
  const runGenerate = useCallback((style, batch) => {
    const ppm = household ? peopleCount(household) : 2; // portions par repas = mangeurs
    const slots = genSlots.length ? genSlots : ["midi", "soir"];
    const slotsLabel = slots.map(s => SLOT_BY_ID[s]?.label || s).join(" et ").toLowerCase();
    const { count } = generate(weekDays, slots, { compose: true, portionsPerMeal: ppm, style, batch });
    setGenOpen(false);
    if (count > 0) {
      notify(`${count} repas proposés, à relire et ajuster`, "success");
      // Batch cooking demandé → on ouvre directement la session (tout à préparer).
      if (batch) openBatch();
    } else if (!recipes.length) {
      // Aucune recette en bibliothèque : rien à proposer (≠ semaine déjà remplie).
      notify("Ajoute d'abord des recettes pour générer une semaine", "info");
    } else notify(`Cette semaine est déjà remplie (${slotsLabel})`, "info");
  }, [generate, weekDays, notify, household, recipes, genSlots]);
  const handleUndo = useCallback(() => { if (undo()) notify("Génération annulée", "info"); }, [undo, notify]);

  // Session batch : vue dérivée de la semaine visible (plats à cuisiner + bases partagées).
  // Calculée UNIQUEMENT quand le panneau batch est ouvert : sinon on la recalculait
  // à chaque changement de semaine (dép. weekDays) pour un panneau fermé, pur gaspi.
  // Session batch : VUE LIVE dérivée du planning de la semaine visible. Recalculée
  // à chaque changement du planning (ajout / retrait) pour rester toujours à jour,
  // c'est une vue pure et peu coûteuse (une semaine de repas).
  const batch = useMemo(
    () => buildBatchSession(weekEntries(mealPlan, weekDays), recipes),
    [mealPlan, weekDays, recipes]
  );
  // Mise en place mutualisée (par ingrédient) + cuissons regroupées, dérivées des
  // plats de la session (donc elles aussi toujours à jour).
  const categoryOrder = useCallback(cat => DEFAULT_CATEGORIES[cat]?.order ?? 99, []);
  // Seuls les produits frais à travailler valent la mutualisation de la découpe.
  const PREP_CATEGORIES = useMemo(() => new Set(["vegetable", "herbs"]), []);
  const miseEnPlace = useMemo(
    () => buildMiseEnPlace(batch.dishes, { recipesById, resolver, ingredientDB: ingredientDB || [], stockSet: new Set(stock || []), categoryOrder, includeCategories: PREP_CATEGORIES }),
    [batch, recipesById, resolver, ingredientDB, stock, categoryOrder, PREP_CATEGORIES]
  );
  const cookingGroups = useMemo(() => groupCookings(batch.dishes), [batch]);
  // La semaine visible contient-elle au moins un plat (≠ base) ? Conditionne l'accès
  // à la session batch depuis le header (ré-ouvrable à tout moment, pas seulement
  // juste après une génération).
  const hasWeekDishes = useMemo(() => {
    const ids = new Set(recipes.filter(r => !r.isComponent).map(r => r.id));
    return weekEntries(mealPlan, weekDays).some(e => ids.has(e.recipeId));
  }, [mealPlan, weekDays, recipes]);
  // Repas couverts = occasions distinctes (date × créneau) occupées par un plat,
  // un repas composé (entrée + plat + dessert sur le même créneau) compte pour 1.
  const mealOccasions = useMemo(() => {
    const ids = new Set(recipes.filter(r => !r.isComponent).map(r => r.id));
    let n = 0;
    for (const date of weekDays) {
      const slots = new Set();
      for (const it of (mealPlan[date] || [])) if (ids.has(it.recipeId)) slots.add(it.slot || "midi");
      n += slots.size;
    }
    return n;
  }, [mealPlan, weekDays, recipes]);
  // Cuissons = sessions de cuisson réelles : seuls les plats qui cuisent (cookTime > 0)
  // comptent, pondérés par leur nombre de cuissons (une cuisson batch couvre plusieurs repas).
  const cookCount = useMemo(() => batch.dishes.reduce((s, d) => s + (Number(d.recipe.cookTime) > 0 ? d.cookings : 0), 0), [batch]);
  const prepCount = useMemo(() => miseEnPlace.reduce((n, g) => n + g.items.length, 0), [miseEnPlace]);
  const [checkedPrep, setCheckedPrep] = useState(() => new Set());
  const togglePrep = useCallback(key => setCheckedPrep(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; }), []);
  // En-tête de section de la feuille batch : pastille emoji + titre (+ sous-titre).
  const secHead = (emoji, title, sub) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: "var(--surface2)", display: "grid", placeItems: "center", fontSize: 15, flexShrink: 0 }}>{emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {sub && <p style={{ fontSize: 11.5, color: "var(--text3)", margin: "7px 0 0", lineHeight: 1.45, paddingLeft: 37 }}>{sub}</p>}
    </div>
  );
  // Repartir d'une checklist vierge à chaque ouverture / changement de session.
  useEffect(() => { if (batchOpen) setCheckedPrep(new Set()); }, [batchOpen, weekDays]);

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
    a.download = "Cardamome - Planning repas.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    notify?.("Planning exporté dans ton calendrier");
  };

  const { scrollRef, contentRef } = useElasticScroll();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 16px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Planning</h1></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {undoKey === weekDays[0]
              ? <button onClick={handleUndo} className="btn btn-ghost btn-pill" style={{ padding: "8px 14px", fontSize: 13, background: "var(--surface)" }}><Icon name="undo" size={15} /> Annuler</button>
              : <button onClick={() => isPlus ? setGenOpen(true) : goPlus()} className="btn btn-primary btn-pill"><Icon name={isPlus ? "calendar" : "sparkle"} size={15} /> Générer</button>}
            <UserAvatar />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="back" size={16} /></button>
          <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
            {`${new Date(weekDays[0] + "T12:00").getDate()} – ${new Date(weekDays[6] + "T12:00").getDate()} ${MP_MONTHS_FR[new Date(weekDays[6] + "T12:00").getMonth()]} ${new Date(weekDays[6] + "T12:00").getFullYear()}`}
          </span>
          <button onClick={() => navigate(1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="forward" size={16} /></button>
          <button onClick={() => setCurrentDate(new Date())} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.3)", flexShrink: 0 }}>Auj.</button>
          <button onClick={exportICS} title="Ajouter le planning à ton agenda (Google Agenda, Apple Calendrier…)" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)", flexShrink: 0 }}>
            <Icon name="calendar" size={13} color="var(--text2)" /> Agenda
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 12px var(--page-pad-b)" }}>
        <div ref={contentRef} style={{ minHeight: "100%" }}>
        {loading ? <LoadingSpinner /> : viewMode === "week" && (
          <div key={`week-${weekDays[0]}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Accès à la session batch : bannière contextuelle (ré-ouvrable), affichée
                seulement quand la semaine contient au moins un plat. Sortie du header
                pour ne plus reléguer le titre sur deux lignes. */}
            {hasWeekDishes && (
              <button onClick={() => isPlus ? openBatch() : goPlus()} className="pressable"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "12px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--ok-rgb),0.18)" }}>
                  <Icon name="fire" size={19} color="var(--ok)" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Session batch</span>
                    {!isPlus && <PlusBadge />}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>Mise en place mutualisée & cuissons regroupées</span>
                </span>
                <Icon name="forward" size={16} color="var(--ok)" />
              </button>
            )}
            {weekDays.map((date, di) => {
              const isToday = date === todayStr;
              const d = new Date(date + "T12:00");
              return (
                <div key={date} className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 10, border: `1px solid ${isToday ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, animationDelay: `${di * 0.04}s` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text)" }}>
                        {MP_DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                      </span>
                      {isToday && <span style={{ fontSize: 10, background: "rgba(var(--accent-rgb),0.2)", color: "var(--accent)", padding: "2px 7px", borderRadius: 10 }}>Aujourd'hui</span>}
                    </div>
                    <button onClick={() => openAdd(date, ["midi"])} className="mp-add-btn" title="Ajouter une recette au planning">
                      <span className="mp-add-label">Ajouter</span>
                      <Icon name="plus" size={15} color="currentColor" />
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
      </div>

      {/* Add recipe modal */}
      {addModal && (
        <SwipeableSheet onClose={() => { setAddModal(null); setSearchQ(""); setAddedId(null); }} style={{ maxHeight: "86dvh" }}>
          {(close) => {
          // Créneau UNIQUE (sélecteur simple) : moins ambigu qu'une multi-sélection.
          const activeSlot = addModal.slots[0];
          const activeIdx = Math.max(0, MEAL_SLOTS.findIndex(s => s.id === activeSlot));
          const pickSlot = (id) => setAddModal(p => ({ ...p, slots: [id] }));
          // Clic sur (+) : le rond passe en ✓ vert (animation), puis la feuille se
          // ferme avec sa sortie animée et le repas est ajouté au planning.
          const confirmAdd = (r) => {
            if (addedId) return; // une confirmation à la fois
            setAddedId(r.id);
            setTimeout(() => {
              close(() => {
                setMealPlan(prev => {
                  const arr = [...(prev[addModal.date] || [])];
                  // Matin : pas de repas composé → entrée simple.
                  if (activeSlot === "matin") {
                    arr.push({ recipeId: r.id, slot: activeSlot, portions: 1 });
                    return { ...prev, [addModal.date]: arr };
                  }
                  // Ajouter = COMPLÉTER le repas déjà présent dans le slot (même groupId)
                  // → pas de barre/repas séparé, juste un rôle en plus. Exception : un
                  // 2ᵉ PLAT (le repas a déjà un plat) démarre un nouveau repas.
                  const role = roleForCategory(r.category);
                  const slotItems = arr.map((m, i) => ({ m, i })).filter(x => x.m.slot === activeSlot);
                  const groupIds = [...new Set(slotItems.map(x => x.m.groupId).filter(Boolean))];
                  const groupHasPlat = (gid) => slotItems.some(x => x.m.groupId === gid && itemRole(x.m, recipesById.get(x.m.recipeId)) === "plat");

                  let gid;
                  if (groupIds.length === 0) {
                    // Slot sans repas structuré : démarre un repas et promeut d'éventuels items nus.
                    gid = newGroupId();
                    for (const x of slotItems) if (!arr[x.i].groupId) {
                      const cur = arr[x.i];
                      arr[x.i] = { ...cur, groupId: gid, role: cur.role || itemRole(cur, recipesById.get(cur.recipeId)) };
                    }
                  } else if (role === "plat" && groupIds.every(groupHasPlat)) {
                    gid = newGroupId(); // 2ᵉ plat = nouveau repas (sa propre barre)
                  } else if (role === "plat") {
                    gid = groupIds.find(g => !groupHasPlat(g)) || newGroupId();
                  } else {
                    gid = groupIds[0]; // entrée/dessert/accompagnement → complète le 1er repas
                  }
                  arr.push({ recipeId: r.id, slot: activeSlot, portions: 1, role, groupId: gid });
                  return { ...prev, [addModal.date]: arr };
                });
                setAddModal(null); setSearchQ(""); setAddedId(null);
              });
            }, 500);
          };
          return (<>
          {/* En-tête : puce calendrier + titre + date */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
              <Icon name="calendar" size={21} color="var(--accent)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Ajouter une recette</h3>
              <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {new Date(addModal.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
          </div>

          {/* Créneau : contrôle segmenté avec pastille glissante (transition douce) */}
          <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 14 }}>
            {/* Pastille active : glisse d'un créneau à l'autre (translateX) */}
            <div aria-hidden="true" style={{
              position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${MEAL_SLOTS.length})`,
              background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              transform: `translateX(calc(${activeIdx} * 100%))`,
              transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.5, 1)",
            }} />
            {MEAL_SLOTS.map(s => {
              const active = activeSlot === s.id;
              return (
                <button key={s.id} onClick={() => pickSlot(s.id)}
                  style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
                    background: "transparent", color: active ? s.text : "var(--text3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "color 0.3s ease" }}>
                  <span style={{ fontSize: 14 }}>{s.emoji}</span>{s.label}
                </button>
              );
            })}
          </div>

          {/* Recherche standard (loupe clavier mobile, effacement) */}
          <SearchField value={searchQ} onChange={setSearchQ} placeholder="Rechercher une recette…" style={{ marginBottom: 16 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Icon name={searchQ.trim() ? "search" : "book"} size={13} color="var(--accent)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{searchQ.trim() ? "Résultats" : "Ta bibliothèque"}</span>
            {filteredRecipes.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{filteredRecipes.length}</span>}
          </div>

          <ElasticScroll max={64} style={{ maxHeight: "46vh", margin: "0 -2px", padding: "2px 2px 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {filteredRecipes.map(r => {
              const total = (r.prepTime || 0) + (r.cookTime || 0);
              const nIng = r.ingredients?.length || 0;
              const added = addedId === r.id;
              return (
                <button key={r.id} onClick={() => confirmAdd(r)} disabled={!!addedId} className="complete-row"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: `1px solid ${added ? "rgba(var(--ok-rgb),0.5)" : "var(--border)"}`, textAlign: "left", cursor: addedId ? "default" : "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "border-color 0.25s ease", opacity: addedId && !added ? 0.55 : 1 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{r.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {r.cuisine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{r.cuisine}</span>}
                      {total > 0 && <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>}
                      {nIng > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{nIng} ingr.</span>}
                      {r.nutriLetter && <NutriScoreBadge letter={r.nutriLetter} compact />}
                    </div>
                  </div>
                  {/* (+) → ✓ vert : le + sort en pivotant, le ✓ surgit (keyframes,
                      pour un jeu fiable même juste avant la fermeture de la feuille). */}
                  <span className="complete-add" style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden",
                    background: added ? "var(--ok)" : "rgba(var(--accent-rgb),0.12)", color: added ? "#fff" : "var(--accent)",
                    transition: "background-color 0.3s ease",
                    animation: added ? "confirmBadgePop 0.34s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none" }}>
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                      opacity: added ? 0 : 1,
                      animation: added ? "confirmPlusOut 0.26s ease forwards" : "none" }}>
                      <Icon name="plus" size={17} color="currentColor" />
                    </span>
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                      opacity: added ? 1 : 0,
                      animation: added ? "confirmCheckIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none" }}>
                      <Icon name="check" size={17} color="currentColor" />
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredRecipes.length === 0 && (
              <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
                <EmptyArt name="loupe" size={78} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Aucune recette {searchQ.trim() ? "ne correspond à ta recherche" : "dans ta bibliothèque"}.</p>
              </div>
            )}
          </ElasticScroll>
          </>);
          }}
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
                    background: active ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)",
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
                  background: active ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)",
                  border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: active ? "rgba(var(--accent-rgb),0.2)" : "var(--surface3)" }}>
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
            background: genBatch ? "rgba(var(--ok-rgb),0.12)" : "var(--surface2)",
            border: `1.5px solid ${genBatch ? "var(--ok)" : "var(--border)"}`,
          }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: genBatch ? "rgba(var(--ok-rgb),0.2)" : "var(--surface3)" }}>
              <Icon name="fire" size={18} color={genBatch ? "var(--ok)" : "var(--text2)"} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Batch cooking</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>Regroupe tout ce qu'il y a à cuisiner pour la semaine en une seule session à préparer d'avance.</span>
            </span>
            <span style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, padding: 2, background: genBatch ? "var(--ok)" : "var(--surface3)", display: "flex", justifyContent: genBatch ? "flex-end" : "flex-start", transition: "background 0.15s" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff" }} />
            </span>
          </button>
          <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "12px 0" }} onClick={() => runGenerate(genStyle, genBatch)}>
            <Icon name="calendar" size={16} /> Générer la semaine
          </button>
        </SwipeableSheet>
      )}

      {/* Session batch : PAGE dédiée (route /meal-plan/batch), portée en plein écran */}
      {batchOpen && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 450, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "cookModeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
          {/* En-tête de page */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
            <button onClick={closeBatch} className="cook-close-btn" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="back" size={16} /></button>
            <span style={{ width: 34, height: 34, borderRadius: 11, background: "rgba(var(--ok-rgb),0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="fire" size={18} color="var(--ok)" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 }}>Session batch</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>{`Semaine du ${new Date(weekDays[0] + "T12:00").getDate()} ${MP_MONTHS_FR[new Date(weekDays[0] + "T12:00").getMonth()]}`}</div>
            </div>
          </div>
          {/* Contenu défilant */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", padding: "18px 20px 48px" }}>
              <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 18px" }}>Tout préparer d'un coup pour la semaine : on mutualise la découpe des ingrédients et les cuissons.</p>

          {batch.dishes.length === 0
            ? (
              <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--surface2)", display: "grid", placeItems: "center", margin: "0 auto 12px", fontSize: 26 }}>🍳</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Planifie des repas cette semaine<br />pour préparer ta session batch.</p>
              </div>
            )
            : <>
              {/* Récap de session : tuiles blanches */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 22 }}>
                {[
                  { n: prepCount, l: prepCount > 1 ? "ingrédients" : "ingrédient", icon: "🔪" },
                  { n: cookCount, l: cookCount > 1 ? "cuissons" : "cuisson", icon: "🔥" },
                  { n: mealOccasions, l: mealOccasions > 1 ? "repas" : "repas", icon: "🍽️" },
                ].map((c, i) => (
                  <div key={i} style={{ padding: "13px 8px", background: "var(--surface)", borderRadius: 15, border: "1px solid var(--border)", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 15, marginBottom: 3 }}>{c.icon}</div>
                    <div style={{ fontFamily: "var(--ff-display)", fontSize: 23, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{c.n}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>{c.l}</div>
                  </div>
                ))}
              </div>

              {/* ── 1. Mise en place mutualisée (par ingrédient) ── */}
              {miseEnPlace.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {secHead("🔪", "Mise en place", "Prépare tous ces ingrédients d'un coup, toutes recettes confondues.")}
                  {miseEnPlace.map(group => {
                    const cat = DEFAULT_CATEGORIES[group.category] || { label: "Autres", icon: "📦" };
                    return (
                      <div key={group.category} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 13 }}>{cat.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.label}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {group.items.map(it => {
                            const done = checkedPrep.has(it.key);
                            const qty = it.unit ? fmtQtyUnit(it.amount, it.unit) : `${it.amount}`;
                            return (
                              <button key={it.key} onClick={() => togglePrep(it.key)} className="pressable" style={{
                                display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer",
                                padding: "10px 12px", borderRadius: 13, background: done ? "rgba(var(--ok-rgb),0.07)" : "var(--surface)",
                                border: `1px solid ${done ? "rgba(var(--ok-rgb),0.35)" : "var(--border)"}`, boxShadow: done ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                              }}>
                                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center", border: `2px solid ${done ? "var(--ok)" : "var(--border)"}`, background: done ? "var(--ok)" : "transparent", transition: "background 0.15s, border-color 0.15s" }}>
                                  {done && <Icon name="check" size={13} color="#fff" />}
                                </span>
                                {it.image && <span style={{ width: 30, height: 30, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: "#fff", border: "1px solid var(--border)" }}><Img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} /></span>}
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>{it.name}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{qty}{it.pieces ? ` · ~${it.pieces}` : ""}</span>
                                  </span>
                                  {(it.prepTip || it.usedBy.length > 1) && (
                                    <span style={{ display: "block", fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
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
                <div style={{ marginBottom: 24 }}>
                  {secHead("🔥", "Cuissons à mutualiser", "Ces plats partagent le même appareil, lance-les ensemble.")}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cookingGroups.map(g => (
                      <div key={g.method} style={{ padding: "12px 14px", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(var(--accent-rgb),0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="fire" size={14} color="var(--accent)" /></span>
                          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{g.label}</span>
                          <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "var(--text3)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 999 }}>{g.dishes.length} plats</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text2)", paddingLeft: 34, lineHeight: 1.45 }}>{g.dishes.map(d => d.recipe.name).join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3. Préparations de base à faire d'avance ── */}
              {batch.bases.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {secHead("🧩", "À préparer d'avance", "Les bases partagées entre plusieurs plats.")}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {batch.bases.map(b => (
                      <button key={b.recipe.id} onClick={() => { onSelectRecipe(b.recipe.id); }} className="complete-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: b.shared ? "rgba(var(--ok-rgb),0.07)" : "var(--surface)", borderRadius: 14, border: `1px solid ${b.shared ? "rgba(var(--ok-rgb),0.35)" : "var(--border)"}`, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.recipe.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Pour {b.usedBy.join(", ")}</div>
                        </div>
                        {b.shared && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ok)", background: "rgba(var(--ok-rgb),0.16)", padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>Partagé</span>}
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>{b.amount} {b.unit}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 4. Plats à cuisiner ── */}
              {secHead("🍽️", "À cuisiner", null)}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {batch.dishes.map(d => (
                  <button key={d.recipe.id} onClick={() => { onSelectRecipe(d.recipe.id); }} className="complete-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={d.recipe.image} alt={d.recipe.name} style={{ width: "100%", height: "100%" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{d.recipe.name}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{d.meals} repas</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.1)", borderRadius: 6, padding: "2px 7px" }}>{d.cookings} cuisson{d.cookings > 1 ? "s" : ""}</span>
                        <span style={{ fontSize: 10.5, color: "var(--text3)", padding: "2px 0" }}>{d.servings} portions</span>
                      </div>
                    </div>
                    <span className="complete-add" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface2)", color: "var(--text3)" }}><Icon name="forward" size={15} color="currentColor" /></span>
                  </button>
                ))}
              </div>
            </>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Compléter un repas : entrée / accompagnement / dessert, suggérés de saison */}
      {composeFor && (() => {
        const base = recipesById.get(composeFor.baseRecipeId);
        const q = normalizeStr(completeSearch.trim());
        const list = q
          ? eligiblePool.filter(r => roleForCategory(r.category || "") === completeRole && normalizeStr(r.name).includes(q)).slice(0, 20)
          : suggestSides(base, eligiblePool, suggestCtx, { role: completeRole, max: 12 });
        return (
          <SwipeableSheet onClose={() => setComposeFor(null)} style={{ maxHeight: "86dvh" }}>
            {/* En-tête : vignette du plat de base + titre contextuel */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: "var(--surface2)", display: "grid", placeItems: "center" }}>
                {base?.image ? <Img src={base.image} alt={base.name} style={{ width: "100%", height: "100%" }} /> : <Icon name="plus" size={20} color="var(--accent)" />}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Compléter le repas</h3>
                {base && <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Autour de <strong style={{ color: "var(--text2)" }}>{base.name}</strong></div>}
              </div>
            </div>

            {/* Contrôle segmenté (rôle) : pastille active blanche sur rail teinté */}
            <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 14 }}>
              {COMPLETE_ROLES.map(r => {
                const active = completeRole === r.id;
                return (
                  <button key={r.id} onClick={() => setCompleteRole(r.id)}
                    style={{ flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none",
                      background: active ? "var(--surface)" : "transparent", color: active ? "var(--accent)" : "var(--text3)",
                      boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none", transition: "color 0.15s ease, background-color 0.15s ease" }}>
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Recherche standard (loupe clavier mobile, effacement) */}
            <SearchField value={completeSearch} onChange={setCompleteSearch} placeholder={`Rechercher ${roleLabel(completeRole).toLowerCase()}…`} style={{ marginBottom: 16 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Icon name={q ? "search" : "sun"} size={13} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{q ? "Résultats" : "Suggestions de saison"}</span>
              {list.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{list.length}</span>}
            </div>

            <ElasticScroll max={64} style={{ maxHeight: "46vh", margin: "0 -2px", padding: "2px 2px 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {list.map(r => {
                const total = (r.prepTime || 0) + (r.cookTime || 0);
                const nIng = r.ingredients?.length || 0;
                return (
                  <button key={r.id} onClick={() => attachToMeal(r.id, completeRole)} className="complete-row"
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{r.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {r.cuisine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{r.cuisine}</span>}
                        {total > 0 && <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>}
                        {nIng > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{nIng} ingr.</span>}
                        {r.nutriLetter && <NutriScoreBadge letter={r.nutriLetter} compact />}
                      </div>
                    </div>
                    <span className="complete-add" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)" }}>
                      <Icon name="plus" size={17} color="currentColor" />
                    </span>
                  </button>
                );
              })}
              {list.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
                  <EmptyArt name="loupe" size={78} style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Aucune recette « {roleLabel(completeRole).toLowerCase()} » {q ? "ne correspond à ta recherche" : "disponible pour l'instant"}.</p>
                </div>
              )}
            </ElasticScroll>
          </SwipeableSheet>
        );
      })()}
    </div>
  );
}
