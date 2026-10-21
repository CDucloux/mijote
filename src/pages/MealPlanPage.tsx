import { useState, useMemo, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { exportTextFile } from "@/lib/ui/fileExport.js";
import { reportError } from "@/lib/observability/observability.js";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { LoadingSpinner } from "../components/ui/LoadingSpinner.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { MEAL_SLOTS } from "../constants/mealSlots.js";
import { itemRole, newGroupId, moveMealItem, addRecipeToSlot } from "@/lib/planning/composedMeal.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { buildMealPlanIcs } from "@/lib/planning/mealPlanIcs.js";
import { computeDayIntake } from "@/lib/planning/dayIntake.js";
import { isEligible } from "@/lib/food/dietFilter.js";
import { createIngredientResolver } from "@/lib/food/nameMatcher.js";
import { currentMonth } from "@/lib/food/seasonality.js";
import { asNutriLetter, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { DayIntakePill, DayIntakeSheet } from "../components/mealPlan/DayIntakeSheet.jsx";
import { SlotZone } from "../components/mealPlan/SlotZone.jsx";
import { MealPlanHeader, BatchSessionBanner } from "../components/mealPlan/MealPlanHeader.jsx";
import { BatchSessionView } from "../components/mealPlan/BatchSessionView.jsx";
import { MealItemMenu } from "../components/mealPlan/MealItemMenu.jsx";
import { RescheduleSheet, DuplicateSheet } from "../components/mealPlan/ReplanSheets.jsx";
import { GenerateSheet } from "../components/mealPlan/GenerateSheet.jsx";
import { AddRecipeSheet } from "../components/mealPlan/AddRecipeSheet.jsx";
import { CompleteMealSheet } from "../components/mealPlan/CompleteMealSheet.jsx";
import { useMealBatchSession } from "../hooks/useMealBatchSession.js";
import { DAYS_SHORT_FR, MONTHS_FR, mondayFirstIndex } from "../constants/calendar.js";
import { mondayWeekDays, shiftWeeks } from "@/lib/planning/weekDays.js";
import { useMealReplan } from "../hooks/useMealReplan.js";
import { useWeekGeneration } from "../hooks/useWeekGeneration.js";
import type { useMealPlanner } from "../hooks/useMealPlanner.js";
import type { UseRecipeDerivedResult } from "../hooks/useRecipeDerived.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { SlotGroup } from "@/lib/planning/composedMeal.js";
import type { MealPlan, Recipe, SavedRecipe } from "@/lib/types.js";
import { DEFAULT_PREFERENCES, type Preferences } from "../constants/preferences.js";
import type { DragInfo } from "../components/mealPlan/SlotZone.jsx";

type MealPlanner = ReturnType<typeof useMealPlanner>;

interface MealPlanPageProps {
  mealPlan: MealPlan;
  recipes: SavedRecipe[];
  setMealPlan: Dispatch<SetStateAction<MealPlan>>;
  onSelectRecipe: (recipeId: string) => void;
  ingredientDB: DbEntry[];
  /** Dérivés mémoïsés au niveau App (Nutri-Score en direct par recette). */
  recipeDerived?: UseRecipeDerivedResult;
  preferences?: Preferences;
  stock?: string[];
  loading?: boolean;
  generate: MealPlanner["generate"];
  undo: MealPlanner["undo"];
  /** Premier jour de la semaine annulable (dernière génération), sinon `null`. */
  undoKey?: string | null;
}

/** Ajout d'une recette ouvert sur un jour (et un créneau verrouillé si ouvert depuis lui). */
interface AddTarget {
  date: string;
  slots: string[];
  lockSlot: boolean;
}

/** Repas à compléter : entrée / accompagnement / dessert autour d'un plat de base. */
interface ComposeTarget {
  date: string;
  slot: string;
  groupId: string | null;
  baseIdx: number;
  baseRecipeId: string | undefined;
}

// Défile le conteneur du planning jusqu'à la carte d'un jour (bornée au conteneur).
// Double rAF : on attend que la bonne semaine soit peinte avant de mesurer.
function scrollToDateCard(container: HTMLElement | null, date: string, behavior: ScrollBehavior): number {
  return requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = container?.querySelector(`[data-date="${date}"]`);
    if (!container || !el) return;
    const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + delta - 12, behavior });
  }));
}

// ─── MEAL PLAN TAB ────────────────────────────────────────────────────────────
// Jour d'où une recette a été ouverte : ouvrir une fiche démonte le planning, on
// mémorise donc au niveau module la date tapée pour y revenir (bonne semaine +
// défilement sur la carte du jour) plutôt qu'en haut de la semaine courante.
// Réinitialisé après usage et au rechargement complet.
let mealPlanReturnDate: string | null = null;

export function MealPlanPage({ mealPlan, recipes, setMealPlan, onSelectRecipe, ingredientDB, recipeDerived, preferences = DEFAULT_PREFERENCES, stock = [], loading = false, generate, undo, undoKey = null }: MealPlanPageProps) {
  const { notify, user, isPlus, logActivity } = useAppShell();
  // Routeur (distinct du `navigate` local de navigation entre semaines) : renvoie
  // vers l'offre Cardamome+ quand une fonctionnalité premium est verrouillée.
  const gotoRoute = useNavigate();
  const goPlus = () => gotoRoute("/plan");
  const { household } = useHousehold();
  // Au retour d'une fiche ouverte depuis le planning, on rouvre directement la
  // semaine du jour concerné (le défilement vers la carte se fait dans un effet).
  const [currentDate, setCurrentDate] = useState(() => mealPlanReturnDate ? new Date(mealPlanReturnDate + "T12:00") : new Date());
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<AddTarget | null>(null);
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = useLongPress();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekDays = useMemo(() => mondayWeekDays(currentDate), [currentDate]);
  const recipesById = useMemo(() => buildRecipeIndex(recipes), [recipes]);
  // Nutri-Score en direct SANS recalcul par ligne : on lit la lettre déjà mémoïsée
  // au niveau App (useRecipeDerived, un seul calcul par recette, stable tant que
  // recipes/ingredientDB ne bougent pas). Recomputer ici à chaque rendu/frappe dans
  // le picker rendait l'ouverture des feuilles lente. Repli sur l'instantané stocké.
  const nutriById = recipeDerived?.seasonVeganById;
  const liveNutri = useCallback(
    (r: Recipe) => asNutriLetter((r.id && nutriById?.get(r.id)?.nutriLetter) ?? r.nutriLetter),
    [nutriById]
  );

  // Composition manuelle : contexte pour suggérer des recettes par rôle.
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const suggestCtx = useMemo(() => ({ resolver, byId: recipesById, month: currentMonth(), stockSet: new Set(stock || []), preferences }), [resolver, recipesById, stock, preferences]);
  const eligiblePool = useMemo(() => recipes.filter(r => !r.isComponent && isEligible(r, preferences, { resolver, byId: recipesById })), [recipes, preferences, resolver, recipesById]);
  const [composeFor, setComposeFor] = useState<ComposeTarget | null>(null);

  const openComplete = useCallback((date: string, slot: string, group: SlotGroup) => {
    const platEntry = group.items.find(x => itemRole(x.item, x.item.recipeId ? recipesById.get(x.item.recipeId) : undefined) === "plat") || group.items[0];
    setComposeFor({ date, slot, groupId: group.groupId || null, baseIdx: (mealPlan[date] || []).indexOf(platEntry.item), baseRecipeId: platEntry.item.recipeId });
  }, [mealPlan, recipesById]);

  const attachToMeal = useCallback((recipeId: string, role: string) => {
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

  // Session batch = PAGE dédiée portée par l'URL (/meal-plan/batch), comme le mode
  // cuisine : accès direct, retour arrière propre, survit à un remontage.
  const location = useLocation();
  const batchOpen = location.pathname === "/meal-plan/batch";
  const openBatch = useCallback(() => gotoRoute("/meal-plan/batch"), [gotoRoute]);
  const closeBatch = useCallback(() => gotoRoute("/meal-plan"), [gotoRoute]);
  const gen = useWeekGeneration({ generate, undo, weekDays, household, hasRecipes: recipes.length > 0, notify, logActivity, openBatch });

  // Session batch : vue LIVE dérivée du planning de la semaine visible (plats, bases,
  // mise en place mutualisée, cuissons regroupées, découpe par ingrédient + compteurs).
  const { batch, miseEnPlace, cookingGroups, decoupeByName, hasWeekDishes, mealOccasions, cookCount, prepCount } =
    useMealBatchSession({ mealPlan, weekDays, recipes, recipesById, resolver, ingredientDB, stock });

  const getMeals = useCallback((date: string, slot: string) => (mealPlan[date] || []).filter(m => m.slot === slot), [mealPlan]);

  // Apport nutritionnel par jour de la semaine visible (sel + protéines + énergie).
  // Vue dérivée pure, recalculée quand le planning ou la base bougent.
  const dayIntakes = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeDayIntake>>();
    for (const date of weekDays) map.set(date, computeDayIntake(mealPlan[date], recipesById, ingredientDB || []));
    return map;
  }, [weekDays, mealPlan, recipesById, ingredientDB]);
  const [intakeDate, setIntakeDate] = useState<string | null>(null); // jour dont on ouvre le détail des apports

  const removeMeal = useCallback((date: string, idx: number) => setMealPlan(prev => { const arr = [...(prev[date] || [])]; arr.splice(idx, 1); return { ...prev, [date]: arr }; }), [setMealPlan]);
  // Déplacement d'un item (drag-and-drop ET replanification) : règle de
  // rattachement au repas cible factorisée dans `moveMealItem` (pur, testé).
  const moveMeal = useCallback((fromDate: string, fromIdx: number, toDate: string, toSlot: string) =>
    setMealPlan(prev => moveMealItem(prev, fromDate, fromIdx, toDate, toSlot)), [setMealPlan]);

  const replan = useMealReplan({ mealPlan, setMealPlan, moveMeal, recipesById, notify, logActivity });
  const { itemMenu, setItemMenu, moveFor, dupFor } = replan;
  const navigate = useCallback((dir: number) => setCurrentDate(prev => shiftWeeks(prev, dir)), []);

  // `lockSlot` : ouvert depuis le créneau lui-même (le slot est déjà choisi), on
  // masque alors le sélecteur matin/midi/soir. Depuis l'en-tête du jour, il reste.
  const openAdd = useCallback((date: string, slots: string[], lockSlot = false) => { setAddModal({ date, slots, lockSlot }); }, []);


  // Export ICS : la construction du calendrier (pure, testée) vit dans lib/planning ;
  // ici on ne fait que déclencher le téléchargement du fichier généré.
  const exportICS = () => {
    const ics = buildMealPlanIcs(mealPlan, recipes, {
      organizerName: user?.displayName ?? undefined,
      organizerEmail: user?.email ?? undefined,
      memberEmails: household?.memberEmails,
    });
    if (!ics) { notify?.("Aucun repas dans le planning à exporter", "error"); return; }
    exportTextFile("Cardamome - Planning repas.ics", ics, "text/calendar;charset=utf-8")
      .then(outcome => { if (outcome === "downloaded") notify?.("Planning exporté dans ton calendrier"); })
      .catch(e => { reportError(e, { action: "export", filename: "planning.ics" }); notify?.("Export du planning impossible", "error"); });
  };

  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });

  // Ouverture d'une recette depuis le planning : on note le jour d'origine avant de
  // déléguer la navigation, pour y revenir au recul (cf. mealPlanReturnDate).
  const selectRecipe = useCallback((id: string, date?: string) => {
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
    const raf = scrollToDateCard(scrollRef.current, date, "auto");
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // « Auj. » : revient sur la semaine courante ET défile jusqu'à la carte du jour.
  // Double rAF : on attend que la bonne semaine soit rendue avant de mesurer/scroller,
  // et on borne le défilement au conteneur (pas la fenêtre).
  const goToday = useCallback(() => {
    setCurrentDate(new Date());
    scrollToDateCard(scrollRef.current, todayStr, "smooth");
  }, [scrollRef, todayStr]);

  const openIntake = intakeDate ? dayIntakes.get(intakeDate) : undefined;
  const menuRecipe = itemMenu?.recipeId ? recipesById.get(itemMenu.recipeId) : undefined;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MealPlanHeader weekDays={weekDays} isPlus={isPlus} canUndo={undoKey === weekDays[0]} onUndo={gen.handleUndo}
        onGenerate={() => isPlus ? gen.setGenOpen(true) : goPlus()} onShiftWeek={navigate} onToday={goToday} onExport={exportICS} />

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 12px var(--page-pad-b)" }}>
        <div ref={contentRef} style={{ minHeight: "100%" }}>
        {loading ? <LoadingSpinner /> : (
          <div key={`week-${weekDays[0]}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Accès à la session batch : bannière contextuelle (ré-ouvrable), affichée
                seulement quand la semaine contient au moins un plat. Sortie du header
                pour ne plus reléguer le titre sur deux lignes. */}
            {hasWeekDishes && <BatchSessionBanner isPlus={isPlus} onOpen={() => isPlus ? openBatch() : goPlus()} />}
            {weekDays.map((date, di) => {
              const isToday = date === todayStr;
              const intake = dayIntakes.get(date);
              const d = new Date(date + "T12:00");
              return (
                <div key={date} data-date={date} className="slide-up" style={{ background: "var(--float-surface)", boxShadow: "var(--float-shadow)", borderRadius: 14, padding: 10, animationDelay: `${di * 0.04}s` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--text)" }}>
                        {DAYS_SHORT_FR[mondayFirstIndex(d.getDay())]} {d.getDate()}
                      </span>
                      {isToday && <span style={{ fontSize: 10, background: "rgba(var(--accent-rgb),0.2)", color: "var(--accent)", padding: "2px 7px", borderRadius: 10 }}>Aujourd'hui</span>}
                      {intake && <DayIntakePill intake={intake} onClick={() => setIntakeDate(date)} />}
                    </div>
                    <button onClick={() => openAdd(date, ["midi"])} className="mp-add-btn" title="Ajouter une recette au planning">
                      <span className="mp-add-label">Ajouter</span>
                      <Icon name="plus" size={15} color="currentColor" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {MEAL_SLOTS.filter(s => s.id !== "matin" || getMeals(date, s.id).length).map(s => (
                      <SlotZone key={s.id} date={date} slot={s.id} meals={getMeals(date, s.id)} dropTarget={dropTarget} dragInfo={dragInfo} mealPlan={mealPlan} recipesById={recipesById} onSelectRecipe={selectRecipe} onRemoveMeal={removeMeal} onMoveMeal={moveMeal} onSetDropTarget={setDropTarget} onSetDragInfo={setDragInfo} onComplete={openComplete} onOpenItemMenu={setItemMenu} onAdd={openAdd} startLongPress={startLongPress} cancelLongPress={cancelLongPress} moveLongPress={moveLongPress} wasLongPress={wasLongPress} />
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
      {intakeDate && openIntake && (
        <DayIntakeSheet
          intake={openIntake}
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
          onConfirm={(r, slot) => { const recipeId = r.id; if (recipeId) setMealPlan(prev => ({ ...prev, [addModal.date]: addRecipeToSlot(prev[addModal.date] || [], { ...r, id: recipeId }, slot, recipesById) })); setAddModal(null); }}
          onClose={() => setAddModal(null)}
        />
      )}

      {/* Menu contextuel d'un repas planifié (clic droit / appui long) */}
      {itemMenu && (
        <MealItemMenu
          item={itemMenu}
          recipe={menuRecipe}
          onOpen={() => { if (itemMenu.recipeId) selectRecipe(itemMenu.recipeId, itemMenu.date); setItemMenu(null); }}
          onReschedule={() => replan.openReschedule(itemMenu)}
          onDuplicate={() => replan.openDuplicate(itemMenu)}
          onRemove={() => { const nm = menuRecipe?.name || ""; removeMeal(itemMenu.date, itemMenu.idx); setItemMenu(null); notify("Repas retiré du planning"); logActivity?.({ type: "mealplan.remove", target: nm }); }}
          onClose={() => setItemMenu(null)}
        />
      )}

      {/* Replanifier : choisir un autre jour (navigable de semaine en semaine) + créneau */}
      {moveFor && (
        <RescheduleSheet
          recipe={moveFor.recipeId ? recipesById.get(moveFor.recipeId) : undefined}
          days={mondayWeekDays(replan.moveWeekRef)}
          target={replan.moveTarget}
          onShift={replan.shiftMoveWeek}
          onPickDay={(dstr) => replan.setMoveTarget(t => ({ ...t, date: dstr }))}
          onPickSlot={(id) => replan.setMoveTarget(t => ({ ...t, slot: id }))}
          onConfirm={replan.confirmReschedule}
          onClose={replan.closeReschedule}
        />
      )}

      {/* Dupliquer : poser la même recette sur plusieurs jours (multi-sélection) + créneau */}
      {dupFor && (
        <DuplicateSheet
          recipe={dupFor.recipeId ? recipesById.get(dupFor.recipeId) : undefined}
          days={mondayWeekDays(replan.dupWeekRef)}
          sourceDate={dupFor.date}
          selected={replan.dupDates}
          slot={replan.dupSlot}
          onShift={replan.shiftDupWeek}
          onToggleDay={replan.toggleDupDate}
          onPickSlot={replan.setDupSlot}
          onConfirm={replan.confirmDuplicate}
          onClose={replan.closeDuplicate}
        />
      )}

      {/* Sous-menu de génération : choix du style de repas */}
      {gen.genOpen && (
        <GenerateSheet genSlots={gen.genSlots} onToggleSlot={gen.toggleGenSlot} genStyle={gen.genStyle} onPickStyle={gen.setGenStyle}
          genBatch={gen.genBatch} onToggleBatch={gen.toggleGenBatch} onGenerate={gen.runGenerate} onClose={() => gen.setGenOpen(false)} />
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
          base={(composeFor.baseRecipeId && recipesById.get(composeFor.baseRecipeId)) || null}
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
