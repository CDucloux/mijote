import { useState, useMemo, useCallback, useEffect } from "react";
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
import { itemRole, roleLabel, newGroupId, roleForCategory, moveMealItem, copyMealToDays } from "@/lib/planning/composedMeal.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { suggestSides } from "@/lib/planning/mealPlanner.js";
import { buildMealPlanIcs } from "@/lib/planning/mealPlanIcs.js";
import { computeDayIntake } from "@/lib/planning/dayIntake.js";
import { fmtTime, isoWeek } from "@/lib/format.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { currentMonth } from "@/lib/food/seasonality.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { ElasticScroll } from "../components/ElasticScroll.jsx";
import { DayIntakePill, DayIntakeSheet } from "../components/mealPlan/DayIntakeSheet.jsx";
import { SlotZone } from "../components/mealPlan/SlotZone.jsx";
import { BatchSessionView } from "../components/mealPlan/BatchSessionView.jsx";
import { MealItemMenu } from "../components/mealPlan/MealItemMenu.jsx";
import { RescheduleSheet, DuplicateSheet } from "../components/mealPlan/ReplanSheets.jsx";
import { GenerateSheet } from "../components/mealPlan/GenerateSheet.jsx";
import { useMealBatchSession } from "../hooks/useMealBatchSession.js";
import { DAYS_SHORT_FR, MONTHS_FR, mondayFirstIndex } from "../constants/calendar.js";

// Rôles proposés pour compléter un repas (le plat existe déjà).
const COMPLETE_ROLES = [
  { id: "entree", label: "Entrée" },
  { id: "accompagnement", label: "Accompagnement" },
  { id: "dessert", label: "Dessert" },
];

// ─── MEAL PLAN – module-level constants & pure helpers ────────────────────────

function mpGetWeekDays(ref) {
  const d = new Date(ref), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd.toISOString().slice(0, 10); });
}

// ─── MEAL PLAN TAB ────────────────────────────────────────────────────────────
// Jour d'où une recette a été ouverte : ouvrir une fiche démonte le planning, on
// mémorise donc au niveau module la date tapée pour y revenir (bonne semaine +
// défilement sur la carte du jour) plutôt qu'en haut de la semaine courante.
// Réinitialisé après usage et au rechargement complet.
let mealPlanReturnDate = null;

export function MealPlanPage({ mealPlan, recipes, setMealPlan, onSelectRecipe, ingredientDB, recipeDerived, preferences = {}, stock = [], loading = false, generate, undo, undoKey = null }) {
  const { notify, user, isPlus, logActivity } = useAppShell();
  // Routeur (distinct du `navigate` local de navigation entre semaines) : renvoie
  // vers l'offre Cardamome+ quand une fonctionnalité premium est verrouillée.
  const gotoRoute = useNavigate();
  const goPlus = () => gotoRoute("/plan");
  const { household } = useHousehold();
  const [viewMode] = useState("week");
  // Au retour d'une fiche ouverte depuis le planning, on rouvre directement la
  // semaine du jour concerné (le défilement vers la carte se fait dans un effet).
  const [currentDate, setCurrentDate] = useState(() => mealPlanReturnDate ? new Date(mealPlanReturnDate + "T12:00") : new Date());
  const [dragInfo, setDragInfo] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [addedId, setAddedId] = useState(null); // recette en cours de confirmation (+→✓)
  // Menu contextuel d'un repas planifié (clic droit / appui long) et sa feuille
  // de replanification. `itemMenu` / `moveFor` = { date, idx, slot, recipeId }.
  const [itemMenu, setItemMenu] = useState(null);
  const [moveFor, setMoveFor] = useState(null);
  const [moveWeekRef, setMoveWeekRef] = useState(new Date());
  const [moveTarget, setMoveTarget] = useState({ date: null, slot: null });
  const [dupFor, setDupFor] = useState(null); // item à dupliquer (menu contextuel)
  const [dupWeekRef, setDupWeekRef] = useState(new Date());
  const [dupDates, setDupDates] = useState(() => new Set()); // jours cibles (multi-sélection)
  const [dupSlot, setDupSlot] = useState(null);
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = useLongPress();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekDays = useMemo(() => mpGetWeekDays(currentDate), [currentDate]);
  const recipesById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);
  // Nutri-Score en direct SANS recalcul par ligne : on lit la lettre déjà mémoïsée
  // au niveau App (useRecipeDerived, un seul calcul par recette, stable tant que
  // recipes/ingredientDB ne bougent pas). Recomputer ici à chaque rendu/frappe dans
  // le picker rendait l'ouverture des feuilles lente. Repli sur l'instantané stocké.
  const nutriById = recipeDerived?.seasonVeganById;
  const liveNutri = useCallback(
    (r) => nutriById?.get(r.id)?.nutriLetter ?? r.nutriLetter,
    [nutriById]
  );

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
      notify(`${count} recettes proposées, à relire et ajuster`, "success");
      const { week, year } = isoWeek(weekDays[0]);
      logActivity?.({ type: "mealplan.generate", target: `Semaine S${week} - ${year}`, count });
      // Batch cooking demandé → on ouvre directement la session (tout à préparer).
      if (batch) openBatch();
    } else if (!recipes.length) {
      // Aucune recette en bibliothèque : rien à proposer (≠ semaine déjà remplie).
      notify("Ajoute d'abord des recettes pour générer une semaine", "info");
    } else notify(`Cette semaine est déjà remplie (${slotsLabel})`, "info");
  }, [generate, weekDays, notify, household, recipes, genSlots, logActivity]);
  const handleUndo = useCallback(() => { if (undo()) notify("Génération annulée", "info"); }, [undo, notify]);

  // Session batch : vue LIVE dérivée du planning de la semaine visible (plats, bases,
  // mise en place mutualisée, cuissons regroupées, découpe par ingrédient + compteurs).
  const { batch, miseEnPlace, cookingGroups, decoupeByName, hasWeekDishes, mealOccasions, cookCount, prepCount } =
    useMealBatchSession({ mealPlan, weekDays, recipes, recipesById, resolver, ingredientDB, stock });

  const getMeals = useCallback((date, slot) => (mealPlan[date] || []).filter(m => m.slot === slot), [mealPlan]);

  // Apport nutritionnel par jour de la semaine visible (sel + protéines + énergie).
  // Vue dérivée pure, recalculée quand le planning ou la base bougent.
  const dayIntakes = useMemo(() => {
    const map = new Map();
    for (const date of weekDays) map.set(date, computeDayIntake(mealPlan[date], recipesById, ingredientDB || []));
    return map;
  }, [weekDays, mealPlan, recipesById, ingredientDB]);
  const [intakeDate, setIntakeDate] = useState(null); // jour dont on ouvre le détail des apports

  const removeMeal = useCallback((date, idx) => setMealPlan(prev => { const arr = [...(prev[date] || [])]; arr.splice(idx, 1); return { ...prev, [date]: arr }; }), [setMealPlan]);
  // Déplacement d'un item (drag-and-drop ET replanification) : règle de
  // rattachement au repas cible factorisée dans `moveMealItem` (pur, testé).
  const moveMeal = useCallback((fromDate, fromIdx, toDate, toSlot) =>
    setMealPlan(prev => moveMealItem(prev, fromDate, fromIdx, toDate, toSlot)), [setMealPlan]);

  const openItemMenu = useCallback((info) => setItemMenu(info), []);
  // « Replanifier » : ouvre la feuille de choix (semaine visible → celle de l'item).
  const openReschedule = useCallback((info) => {
    setItemMenu(null);
    setMoveFor(info);
    setMoveWeekRef(new Date(info.date + "T12:00"));
    setMoveTarget({ date: info.date, slot: info.slot });
  }, []);
  const confirmReschedule = useCallback(() => {
    if (!moveFor || !moveTarget.date) return;
    moveMeal(moveFor.date, moveFor.idx, moveTarget.date, moveTarget.slot);
    setMoveFor(null);
    notify("Repas replanifié");
    logActivity?.({ type: "mealplan.reschedule", target: recipesById.get(moveFor.recipeId)?.name || "" });
  }, [moveFor, moveTarget, moveMeal, notify, logActivity, recipesById]);
  // « Dupliquer » : poser la même recette sur plusieurs jours (le jour d'origine
  // est présélectionné et verrouillé, on ne duplique que vers d'autres jours).
  const openDuplicate = useCallback((info) => {
    setItemMenu(null);
    setDupFor(info);
    setDupWeekRef(new Date(info.date + "T12:00"));
    setDupDates(new Set());
    setDupSlot(info.slot);
  }, []);
  const toggleDupDate = useCallback((dstr) => setDupDates(prev => {
    const s = new Set(prev); s.has(dstr) ? s.delete(dstr) : s.add(dstr); return s;
  }), []);
  const confirmDuplicate = useCallback(() => {
    if (!dupFor || !dupDates.size || !dupSlot) return;
    const src = (mealPlan[dupFor.date] || [])[dupFor.idx];
    if (!src) { setDupFor(null); return; }
    const targets = [...dupDates];
    setMealPlan(prev => copyMealToDays(prev, src, targets, dupSlot));
    setDupFor(null);
    notify(targets.length > 1 ? `Recette dupliquée sur ${targets.length} jours` : "Recette dupliquée");
  }, [dupFor, dupDates, dupSlot, mealPlan, setMealPlan, notify]);
  const navigate = useCallback(dir => setCurrentDate(prev => {
    const d = new Date(prev);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    return d;
  }), [viewMode]);

  // `lockSlot` : ouvert depuis le créneau lui-même (le slot est déjà choisi), on
  // masque alors le sélecteur matin/midi/soir. Depuis l'en-tête du jour, il reste.
  const openAdd = useCallback((date, slots, lockSlot = false) => { setAddModal({ date, slots, lockSlot }); setSearchQ(""); }, []);

  const filteredRecipes = useMemo(() =>
    recipes.filter(r => !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase())),
    [recipes, searchQ]
  );

  // Export ICS : la construction du calendrier (pure, testée) vit dans lib/planning ;
  // ici on ne fait que déclencher le téléchargement du fichier généré.
  const exportICS = () => {
    const ics = buildMealPlanIcs(mealPlan, recipes, {
      organizerName: user?.displayName,
      organizerEmail: user?.email,
      memberEmails: household?.memberEmails,
    });
    if (!ics) { notify?.("Aucun repas dans le planning à exporter", "error"); return; }
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Cardamome - Planning repas.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    notify?.("Planning exporté dans ton calendrier");
  };

  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll({ disabled: isDesktop });

  // Ouverture d'une recette depuis le planning : on note le jour d'origine avant de
  // déléguer la navigation, pour y revenir au recul (cf. mealPlanReturnDate).
  const selectRecipe = useCallback((id, date) => {
    mealPlanReturnDate = date || null;
    onSelectRecipe(id);
  }, [onSelectRecipe]);

  // Retour depuis une fiche : la semaine du jour est déjà ouverte (état initial),
  // on défile jusqu'à sa carte (sans animation, pour un retour instantané) puis on
  // purge la mémoire. Double rAF : on attend que la semaine soit peinte avant de mesurer.
  useEffect(() => {
    const date = mealPlanReturnDate;
    if (!date) return;
    mealPlanReturnDate = null;
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(() => {
      const container = scrollRef.current;
      const el = container?.querySelector(`[data-date="${date}"]`);
      if (!container || !el) return;
      const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + delta - 12, behavior: "auto" });
    }));
    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // « Auj. » : revient sur la semaine courante ET défile jusqu'à la carte du jour.
  // Double rAF : on attend que la bonne semaine soit rendue avant de mesurer/scroller,
  // et on borne le défilement au conteneur (pas la fenêtre).
  const goToday = useCallback(() => {
    setCurrentDate(new Date());
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const container = scrollRef.current;
      const el = container?.querySelector(`[data-date="${todayStr}"]`);
      if (!container || !el) return;
      const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + delta - 12, behavior: "smooth" });
    }));
  }, [scrollRef, todayStr]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 16px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Planning</h1></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {undoKey === weekDays[0]
              ? <button onClick={handleUndo} className="btn btn-ghost btn-pill" style={{ padding: "8px 14px", fontSize: 13, background: "var(--surface)" }}><Icon name="undo" size={15} /> Annuler</button>
              : <button onClick={() => isPlus ? setGenOpen(true) : goPlus()} className="btn btn-primary btn-pill"><Icon name={isPlus ? "calendar" : "sparkle"} size={15} /> Générer</button>}
            <UserAvatar />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(-1)} className="pressable ripple hov-surface" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="back" size={16} /></button>
          <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
            {`${new Date(weekDays[0] + "T12:00").getDate()} – ${new Date(weekDays[6] + "T12:00").getDate()} ${MONTHS_FR[new Date(weekDays[6] + "T12:00").getMonth()]} ${new Date(weekDays[6] + "T12:00").getFullYear()}`}
          </span>
          <button onClick={() => navigate(1)} className="pressable ripple hov-surface" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="forward" size={16} /></button>
          <button onClick={goToday} className="pressable ripple" style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.3)", flexShrink: 0 }}>Auj.</button>
          <button onClick={exportICS} className="pressable ripple hov-surface" title="Ajouter le planning à ton agenda (Google Agenda, Apple Calendrier…)" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)", flexShrink: 0 }}>
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
              <button onClick={() => isPlus ? openBatch() : goPlus()} className="pressable hov-surface"
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
                <div key={date} data-date={date} className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 10, border: `1px solid ${isToday ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, animationDelay: `${di * 0.04}s` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--text)" }}>
                        {DAYS_SHORT_FR[mondayFirstIndex(d.getDay())]} {d.getDate()}
                      </span>
                      {isToday && <span style={{ fontSize: 10, background: "rgba(var(--accent-rgb),0.2)", color: "var(--accent)", padding: "2px 7px", borderRadius: 10 }}>Aujourd'hui</span>}
                      <DayIntakePill intake={dayIntakes.get(date)} onClick={() => setIntakeDate(date)} />
                    </div>
                    <button onClick={() => openAdd(date, ["midi"])} className="mp-add-btn" title="Ajouter une recette au planning">
                      <span className="mp-add-label">Ajouter</span>
                      <Icon name="plus" size={15} color="currentColor" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {MEAL_SLOTS.filter(s => s.id !== "matin" || getMeals(date, s.id).length).map(s => (
                      <SlotZone key={s.id} date={date} slot={s.id} meals={getMeals(date, s.id)} dropTarget={dropTarget} dragInfo={dragInfo} mealPlan={mealPlan} recipesById={recipesById} onSelectRecipe={selectRecipe} onRemoveMeal={removeMeal} onMoveMeal={moveMeal} onSetDropTarget={setDropTarget} onSetDragInfo={setDragInfo} onComplete={openComplete} onOpenItemMenu={openItemMenu} onAdd={openAdd} startLongPress={startLongPress} cancelLongPress={cancelLongPress} moveLongPress={moveLongPress} wasLongPress={wasLongPress} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Détail des apports d'un jour (ouvert depuis la pastille de sel) */}
      {intakeDate && dayIntakes.get(intakeDate) && (
        <DayIntakeSheet
          intake={dayIntakes.get(intakeDate)}
          dateLabel={new Date(intakeDate + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          onClose={() => setIntakeDate(null)}
        />
      )}

      {/* Add recipe modal */}
      {addModal && (
        <SwipeableSheet onClose={() => { setAddModal(null); setSearchQ(""); setAddedId(null); }} style={{ maxHeight: "86dvh" }}>
          {(close) => {
          // Créneau UNIQUE (sélecteur simple) : moins ambigu qu'une multi-sélection.
          const activeSlot = addModal.slots[0];
          const activeIdx = Math.max(0, MEAL_SLOTS.findIndex(s => s.id === activeSlot));
          // Ouvert depuis un créneau précis → le slot est figé, pas de sélecteur.
          const lockSlot = !!addModal.lockSlot;
          const activeMeta = SLOT_BY_ID[activeSlot];
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
              <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Ajouter une recette</h3>
              <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lockSlot && activeMeta ? `${activeMeta.meal} · ` : ""}{new Date(addModal.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
          </div>

          {/* Créneau : contrôle segmenté avec pastille glissante (transition douce).
              Masqué quand la feuille est ouverte depuis un créneau précis (slot figé). */}
          {!lockSlot && (
          <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 14 }}>
            {/* Pastille active : glisse d'un créneau à l'autre (translateX) */}
            <div aria-hidden="true" style={{
              position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${MEAL_SLOTS.length})`,
              background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              transform: `translateX(calc(${activeIdx} * 100%))`,
              transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
            }} />
            {MEAL_SLOTS.map(s => {
              const active = activeSlot === s.id;
              return (
                <button key={s.id} onClick={() => pickSlot(s.id)}
                  style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
                    background: "transparent", color: active ? s.text : "var(--text3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "color 0.3s ease" }}>
                  <Icon name={s.icon} size={15} weight="duotone" color={active ? s.text : "var(--text3)"} />{s.label}
                </button>
              );
            })}
          </div>
          )}

          {/* Recherche standard (loupe clavier mobile, effacement) */}
          <SearchField value={searchQ} onChange={setSearchQ} placeholder="Rechercher une recette…" style={{ marginBottom: 16 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Icon name={searchQ.trim() ? "search" : "book"} size={13} color="var(--accent)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{searchQ.trim() ? "Résultats" : "Ta bibliothèque"}</span>
            {filteredRecipes.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{filteredRecipes.length}</span>}
          </div>

          <ElasticScroll max={64} style={{ maxHeight: "46vh", margin: "0 -2px", padding: "2px 2px 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {filteredRecipes.map(r => {
              const total = (r.prepTime || 0) + (r.cookTime || 0);
              const nIng = r.ingredients?.length || 0;
              const nutri = liveNutri(r);
              const added = addedId === r.id;
              return (
                <button key={r.id} onClick={() => confirmAdd(r)} disabled={!!addedId} className="complete-row ripple"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: `1px solid ${added ? "rgba(var(--ok-rgb),0.5)" : "var(--border)"}`, textAlign: "left", cursor: addedId ? "default" : "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "border-color 0.25s ease, box-shadow 0.2s ease", opacity: addedId && !added ? 0.55 : 1 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{r.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {r.cuisine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{r.cuisine}</span>}
                      {total > 0 && <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>}
                      {nIng > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{nIng} ingr.</span>}
                      {nutri && <NutriScoreBadge letter={nutri} compact />}
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

      {/* Menu contextuel d'un repas planifié (clic droit / appui long) */}
      {itemMenu && (
        <MealItemMenu
          item={itemMenu}
          recipe={recipesById.get(itemMenu.recipeId)}
          onOpen={() => { selectRecipe(itemMenu.recipeId, itemMenu.date); setItemMenu(null); }}
          onReschedule={() => openReschedule(itemMenu)}
          onDuplicate={() => openDuplicate(itemMenu)}
          onRemove={() => { const nm = recipesById.get(itemMenu.recipeId)?.name || ""; removeMeal(itemMenu.date, itemMenu.idx); setItemMenu(null); notify("Repas retiré du planning"); logActivity?.({ type: "mealplan.remove", target: nm }); }}
          onClose={() => setItemMenu(null)}
        />
      )}

      {/* Replanifier : choisir un autre jour (navigable de semaine en semaine) + créneau */}
      {moveFor && (
        <RescheduleSheet
          recipe={recipesById.get(moveFor.recipeId)}
          days={mpGetWeekDays(moveWeekRef)}
          target={moveTarget}
          onShift={(dir) => setMoveWeekRef(prev => { const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d; })}
          onPickDay={(dstr) => setMoveTarget(t => ({ ...t, date: dstr }))}
          onPickSlot={(id) => setMoveTarget(t => ({ ...t, slot: id }))}
          onConfirm={confirmReschedule}
          onClose={() => setMoveFor(null)}
        />
      )}

      {/* Dupliquer : poser la même recette sur plusieurs jours (multi-sélection) + créneau */}
      {dupFor && (
        <DuplicateSheet
          recipe={recipesById.get(dupFor.recipeId)}
          days={mpGetWeekDays(dupWeekRef)}
          sourceDate={dupFor.date}
          selected={dupDates}
          slot={dupSlot}
          onShift={(dir) => setDupWeekRef(prev => { const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d; })}
          onToggleDay={toggleDupDate}
          onPickSlot={setDupSlot}
          onConfirm={confirmDuplicate}
          onClose={() => setDupFor(null)}
        />
      )}

      {/* Sous-menu de génération : choix du style de repas */}
      {genOpen && (
        <GenerateSheet
          genSlots={genSlots}
          onToggleSlot={toggleGenSlot}
          genStyle={genStyle}
          onPickStyle={setGenStyle}
          genBatch={genBatch}
          onToggleBatch={() => setGenBatch(v => !v)}
          onGenerate={() => runGenerate(genStyle, genBatch)}
          onClose={() => setGenOpen(false)}
        />
      )}

      {/* Session batch : PAGE dédiée (route /meal-plan/batch), portée en plein écran.
          Keyée par la semaine → la checklist interne repart vierge à chaque semaine. */}
      {batchOpen && createPortal(
        <BatchSessionView
          key={weekDays[0]}
          weekLabel={`Semaine du ${new Date(weekDays[0] + "T12:00").getDate()} ${MONTHS_FR[new Date(weekDays[0] + "T12:00").getMonth()]}`}
          batch={batch} miseEnPlace={miseEnPlace} cookingGroups={cookingGroups} decoupeByName={decoupeByName}
          prepCount={prepCount} cookCount={cookCount} mealOccasions={mealOccasions}
          onClose={closeBatch} onSelectRecipe={selectRecipe}
        />,
        document.body,
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
                <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Compléter le repas</h3>
                {base && <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Autour de <strong style={{ color: "var(--text2)" }}>{base.name}</strong></div>}
              </div>
            </div>

            {/* Contrôle segmenté (rôle) : pastille active blanche qui GLISSE d'un
                onglet à l'autre (translateX), comme les autres sélecteurs de l'app. */}
            <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 14 }}>
              <div aria-hidden="true" style={{
                position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${COMPLETE_ROLES.length})`,
                background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                transform: `translateX(calc(${Math.max(0, COMPLETE_ROLES.findIndex(x => x.id === completeRole))} * 100%))`,
                transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
              {COMPLETE_ROLES.map(r => {
                const active = completeRole === r.id;
                return (
                  <button key={r.id} onClick={() => setCompleteRole(r.id)}
                    style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none",
                      background: "transparent", color: active ? "var(--accent)" : "var(--text3)",
                      transition: "color 0.3s ease" }}>
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Recherche standard (loupe clavier mobile, effacement) */}
            <SearchField value={completeSearch} onChange={setCompleteSearch} placeholder={`Rechercher ${roleLabel(completeRole).toLowerCase()}…`} style={{ marginBottom: 16 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Icon name={q ? "search" : "sun"} size={13} color="var(--accent)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{q ? "Résultats" : "Suggestions de saison"}</span>
              {list.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{list.length}</span>}
            </div>

            <ElasticScroll max={64} style={{ maxHeight: "46vh", margin: "0 -2px", padding: "2px 2px 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {list.map(r => {
                const total = (r.prepTime || 0) + (r.cookTime || 0);
                const nIng = r.ingredients?.length || 0;
                const nutri = liveNutri(r);
                return (
                  <button key={r.id} onClick={() => attachToMeal(r.id, completeRole)} className="complete-row ripple"
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{r.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {r.cuisine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{r.cuisine}</span>}
                        {total > 0 && <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>}
                        {nIng > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{nIng} ingr.</span>}
                        {nutri && <NutriScoreBadge letter={nutri} compact />}
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
