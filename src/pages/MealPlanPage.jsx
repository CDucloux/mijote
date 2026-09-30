import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { LoadingSpinner } from "../components/ui/LoadingSpinner.jsx";
import { PlusBadge } from "../components/badges/PlusBadge.jsx";
import { UserAvatar } from "../components/user/UserAvatar.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount } from "@/lib/household/household.js";
import { MEAL_SLOTS, SLOT_BY_ID } from "../constants/mealSlots.js";
import { useLS } from "../hooks/useLS.js";
import { itemRole, newGroupId, moveMealItem, copyMealToDays, addRecipeToSlot } from "@/lib/planning/composedMeal.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { buildMealPlanIcs } from "@/lib/planning/mealPlanIcs.js";
import { computeDayIntake } from "@/lib/planning/dayIntake.js";
import { isoWeek } from "@/lib/format.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { currentMonth } from "@/lib/food/seasonality.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { DayIntakePill, DayIntakeSheet } from "../components/mealPlan/DayIntakeSheet.jsx";
import { SlotZone } from "../components/mealPlan/SlotZone.jsx";
import { BatchSessionView } from "../components/mealPlan/BatchSessionView.jsx";
import { MealItemMenu } from "../components/mealPlan/MealItemMenu.jsx";
import { RescheduleSheet, DuplicateSheet } from "../components/mealPlan/ReplanSheets.jsx";
import { GenerateSheet } from "../components/mealPlan/GenerateSheet.jsx";
import { AddRecipeSheet } from "../components/mealPlan/AddRecipeSheet.jsx";
import { CompleteMealSheet } from "../components/mealPlan/CompleteMealSheet.jsx";
import { useMealBatchSession } from "../hooks/useMealBatchSession.js";
import { DAYS_SHORT_FR, MONTHS_FR, mondayFirstIndex } from "../constants/calendar.js";


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

  const openComplete = useCallback((date, slot, group) => {
    const platEntry = group.items.find(x => itemRole(x.item, recipesById.get(x.item.recipeId)) === "plat") || group.items[0];
    setComposeFor({ date, slot, groupId: group.groupId || null, baseIdx: (mealPlan[date] || []).indexOf(platEntry.item), baseRecipeId: platEntry.item.recipeId });
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
  const openAdd = useCallback((date, slots, lockSlot = false) => { setAddModal({ date, slots, lockSlot }); }, []);


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
        <AddRecipeSheet
          date={addModal.date}
          initialSlot={addModal.slots[0]}
          lockSlot={!!addModal.lockSlot}
          recipes={recipes}
          liveNutri={liveNutri}
          onConfirm={(r, slot) => { setMealPlan(prev => ({ ...prev, [addModal.date]: addRecipeToSlot(prev[addModal.date] || [], r, slot, recipesById) })); setAddModal(null); }}
          onClose={() => setAddModal(null)}
        />
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
      {composeFor && (
        <CompleteMealSheet
          base={recipesById.get(composeFor.baseRecipeId)}
          eligiblePool={eligiblePool}
          suggestCtx={suggestCtx}
          liveNutri={liveNutri}
          onAttach={attachToMeal}
          onClose={() => setComposeFor(null)}
        />
      )}
    </div>
  );
}
