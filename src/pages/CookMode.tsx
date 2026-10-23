import { useState, useMemo, useEffect, useRef, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { parseDurations } from "@/lib/planning/stepTimers.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { buildPostesDecoupe, findDecoupeStepIndex, posteLabel, sortPostesByStep } from "@/lib/recipes/decoupe.js";
import { createIngredientResolver, resolveLineEntry } from "@/lib/food/nameMatcher.js";
import { resolveUsagePrecaution } from "@/lib/utensils/usagePrecaution.js";
import { findUtensilEntry } from "@/lib/utensils/utensilLookup.js";
import { UtensilPrecautionSheet } from "../components/recipe/QualityHints.jsx";
import { fmtQtyUnit } from "../lib/format.js";
import { groupIngredientsByCategory, buildPendingComponents } from "@/lib/cookSession/misEnPlace.js";
import { spoonConversions } from "@/lib/food/calculators.js";
import { QuantityConvertSheet } from "../components/ingredient/QuantityConvertSheet.jsx";
import { addVersion, nextVersionLabel } from "@/lib/recipes/history.js";
import { stepLinked } from "@/lib/recipes/stepLinks.js";
import { useLS } from "../hooks/useLS.js";
import { useCookSession } from "../hooks/useCookSession.js";
import { useCookTimers } from "../hooks/useCookTimers.js";
import { useCookChecklist } from "../hooks/useCookChecklist.js";
import { useStepGestures } from "../hooks/useStepGestures.js";
import { CookTimersStack } from "../components/cookMode/CookTimersStack.jsx";
import { CookDoneScreen } from "../components/cookMode/CookDoneScreen.jsx";
import { CookContent } from "../components/cookMode/CookContent.jsx";
import { CookSidebar } from "../components/cookMode/CookSidebar.jsx";
import { CookModeHeader } from "../components/cookMode/CookModeHeader.jsx";
import { CookIterationSheet } from "../components/cookMode/CookIterationSheet.jsx";
import { VoiceCommandsSheet } from "../components/cookMode/VoiceCommandsSheet.jsx";
import { buildCookSnapshot, pickPilotTimerId } from "@/lib/cookSession/snapshot.js";
import { companionText, cookPageLabel, pageKeyOf, partnerPositions } from "@/lib/cookSession/together.js";
import { useCookTogether } from "../hooks/useCookTogether.js";
import { useCookVoice } from "../hooks/useCookVoice.js";
import { cookPageSpeech, stepTechniques, voiceTimerTarget } from "@/lib/cookSession/voiceCommands.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import type { IngredientLine, Recipe, Utensil, UtensilDbItem } from "@/lib/types.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { IngredientCategories } from "@/lib/data/referenceData.js";
import type { CookPage } from "../components/cookMode/CookSidebar.js";
import type { PrecautionSheetTarget } from "../components/recipeDetail/recipeView.js";

interface CookModeSharedProps {
  recipe: Recipe;
  /** Facteur appliqué aux quantités (portions × moule). */
  mult: number;
  ingredientDB: DbEntry[];
  utensilDB: UtensilDbItem[] | undefined;
  categories?: IngredientCategories;
  onClose: () => void;
  /** Consigne le plat au journal de cuisine (recette principale uniquement). */
  onCooked?: (recipeId: string) => void;
  /** IDs des préparations de base en stock (les autres sont à réaliser d'abord). */
  stockSet: Set<string> | undefined;
  onUpdateRecipe?: (recipe: Recipe) => void;
}

interface CookModeInnerProps extends CookModeSharedProps {
  recipesById: Map<string, Recipe>;
  /** CookMode ouvert depuis un autre pour réaliser une préparation de base. */
  isNested?: boolean;
}

interface CookModeProps extends CookModeSharedProps {
  recipes?: Recipe[];
}

/** Préparation de base ouverte dans un CookMode imbriqué, à son échelle. */
interface SubCook {
  recipe: Recipe;
  mult: number;
}

type ConvertTarget = ComponentProps<typeof QuantityConvertSheet>["ing"];

// ─── COOK MODE ────────────────────────────────────────────────────────────────
// `recipes` + `stockSet` permettent de gérer les composants (préparations de base) :
// - étape 0 : liste des composants épuisés à réaliser avant de commencer ;
// - dans chaque step : les lignes composant s'affichent avec 🧈 (pas d'image dbId).
// - bouton « Réaliser » → CookMode imbriqué sur le composant mis à l'échelle.

function CookModeInner({ recipe, mult, ingredientDB, utensilDB, categories = DEFAULT_CATEGORIES, onClose, onCooked, recipesById, stockSet, onUpdateRecipe, isNested = false }: CookModeInnerProps) {
  const { techniques, notify, user, householdId } = useAppShell();
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const ingResolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const [stepIdx, setStepIdx] = useState(0);
  const [doneHere, setDone] = useState(false);
  // Chrono global : « depuis quand la recette est lancée » (recette principale
  // uniquement). Gelé une fois la recette terminée ; à deux, aligné sur la session.
  const startedAtRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const cookedLoggedRef = useRef(false);
  const [closing, setClosing] = useState(false);
  // Fermeture animée : joue la sortie (fondu + glissé) avant de démonter réellement.
  const requestClose = () => { if (closing) return; setClosing(true); setTimeout(() => onClose(), 280); };
  const [subCook, setSubCook] = useState<SubCook | null>(null);
  const [precSheet, setPrecSheet] = useState<PrecautionSheetTarget | null>(null);
  const [doneComponents, setDoneComponents] = useState<ReadonlySet<string | undefined>>(() => new Set());
  const {
    checkedIngIds, checkedUtIds, checkedCutKeys, toggleIngChecked, toggleUtChecked, toggleCutChecked,
    spoonUnitByIng, setSpoonUnit,
  } = useCookChecklist();
  // Conversion d'une quantité en cuillères (feuille), depuis la mise en place.
  const [convIng, setConvIng] = useState<ConvertTarget | null>(null);
  // Préférence d'affichage (liste / par catégorie) : persistée, elle reste valable
  // d'une recette à l'autre.
  const [groupByCategory, setGroupByCategory] = useLS("rf_cookModeGroupByCategory", false);
  // Itération de fin de cuisson : alimente le carnet d'itérations depuis l'écran final.
  const [iterOpen, setIterOpen] = useState(false);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);
  const [navDir, setNavDir] = useState(1); // sens de navigation (animation d'étape)
  const canIterate = !isNested && !!onUpdateRecipe;
  const saveIteration = (rating: number | null, notes: string) => {
    if (!onUpdateRecipe) return;
    const versioned: Recipe = recipe;
    onUpdateRecipe(addVersion(versioned, { label: nextVersionLabel(versioned.history), rating, notes }));
    setIterOpen(false);
    notify?.("Itération ajoutée au carnet");
    requestClose();
  };

  // Composants épuisés référencés par cette recette (étape 0)
  const pendingComponents = useMemo(
    () => buildPendingComponents(recipe, recipesById, stockSet, mult),
    [recipe, recipesById, stockSet, mult],
  );

  // Pages virtuelles du mode pas à pas, dans l'ordre :
  //   • « aperçu » (mise en place) : TOUS les ingrédients + ustensiles, pour ne
  //     jamais avoir à revenir à la fiche ;
  //   • « bases » : préparations de base épuisées à réaliser d'abord (si besoin) ;
  //   • une page par étape réelle.
  const overviewIngs = recipe.ingredients || [];
  const overviewUts = recipe.utensils || [];
  const hasOverview = overviewIngs.length > 0 || overviewUts.length > 0;

  // Ingrédients de la mise en place, regroupés par catégorie (rayon) dans l'ordre
  // configuré ; option d'affichage alternative à la liste plate.
  const overviewIngGroups = useMemo(
    () => groupIngredientsByCategory(recipe.ingredients, ingredientDB, categories),
    [recipe.ingredients, ingredientDB, categories],
  );
  // Postes de découpe de la mise en place, aux quantités mises à l'échelle (mult).
  // Chaque poste est rattaché à l'étape réelle où sa découpe est décrite (clé du poste
  // → index d'étape, -1 si aucune) : on y navigue pour vérifier une taille douteuse, et
  // la liste suit l'ordre des étapes (on taille d'abord ce qui part en premier).
  const { postesDecoupe, posteStepByKey } = useMemo(() => {
    const scaled = (recipe.ingredients || []).map(i => {
      const a = i.amount != null && i.amount !== "" ? Number(i.amount) * (mult || 1) : i.amount;
      return { ...i, amount: a };
    });
    const postes = buildPostesDecoupe(scaled, techIndex);
    const stepByKey = new Map(postes.map(poste => [poste.key, findDecoupeStepIndex(poste, recipe.ingredients, recipe.steps)]));
    return { postesDecoupe: sortPostesByStep(postes, stepByKey), posteStepByKey: stepByKey };
  }, [recipe.ingredients, recipe.steps, mult, techIndex]);

  const realStepCount = (recipe.steps || []).length;
  const pages = useMemo(() => {
    const arr: CookPage[] = [];
    if (hasOverview) arr.push({ kind: "overview" });
    if (pendingComponents.length > 0) arr.push({ kind: "bases" });
    (recipe.steps || []).forEach((s, i) => arr.push({ kind: "step", step: s, realIdx: i }));
    return arr;
  }, [hasOverview, pendingComponents.length, recipe.steps]);
  const totalSteps = pages.length || 1;
  const cur: CookPage = pages[Math.min(stepIdx, pages.length - 1)] || { kind: "overview" };
  // Cuisiner à deux (foyer) : positions, étapes faites et fin communes.
  const pageKeys = useMemo(() => pages.map(pageKeyOf), [pages]);
  const together = useCookTogether({ householdId, recipe, user, pageKey: pageKeyOf(cur), pageKeys, enabled: !isNested });
  // Minuteurs déclenchés depuis les mentions de temps de l'étape. Base horodatée
  // (cf. `cookTimers`) : le restant se dérive de l'horloge, donc reste juste après
  // un passage en arrière-plan. En natif, une notification OS est planifiée à
  // l'échéance pour sonner même écran verrouillé (cf. `localNotifications`). À deux,
  // ils sont communs : lancer, mettre en pause ou arrêter vaut pour les deux.
  const { timers, timersOpen, setTimersOpen, now, addTimer, toggleTimer, restartTimer, removeTimer } =
    useCookTimers(notify, { timers: together.timers, save: together.saveTimer, drop: together.dropTimer });
  const timerStarters = useMemo(
    () => new Map((together.session?.participants ?? []).filter(p => p.uid !== user?.uid).map(p => [p.uid, p])),
    [together.session, user?.uid],
  );
  const done = doneHere || together.finished;
  useEffect(() => { if (together.startedAt) startedAtRef.current = together.startedAt; }, [together.startedAt]);
  useEffect(() => {
    if (isNested || done) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [isNested, done]);
  // Consigne le plat au journal de cuisine, une seule fois, à l'arrivée sur l'écran
  // de fin de la recette PRINCIPALE (les bases imbriquées ne comptent pas). À deux,
  // seul celui qui a terminé le consigne.
  const cookedByOther = together.finishedBy !== null && together.finishedBy !== user?.uid;
  useEffect(() => {
    if (done && !isNested && !cookedByOther && !cookedLoggedRef.current && recipe.id) { cookedLoggedRef.current = true; onCooked?.(recipe.id); }
  }, [done, isNested, cookedByOther, onCooked, recipe.id]);
  const companions = partnerPositions(pageKeys, together.others)
    .map(({ participant, index }) => ({ participant, progress: ((index + 1) / totalSteps) * 100, label: cookPageLabel(pages[index]) }));
  const isOverview = cur.kind === "overview";
  const isBases = cur.kind === "bases";
  const step = cur.kind === "step" ? cur.step : null;
  const realIdx = cur.kind === "step" ? cur.realIdx : -1;

  // Toutes les bases avec étapes doivent être réalisées avant de passer à la suite.
  const allComponentsDone = pendingComponents
    .filter(({ comp }) => (comp.steps?.length ?? 0) > 0)
    .every(({ comp }) => doneComponents.has(comp.id));

  // Navigation entre pages, en mémorisant le sens pour l'animation d'expansion :
  // en avant le contenu monte depuis le bas, en arrière il descend depuis le haut.
  const goTo = (idx: number) => {
    const next = Math.max(0, Math.min(totalSteps - 1, idx));
    if (next === stepIdx) return;
    if (isBases && next > stepIdx && !allComponentsDone) return; // bases à finir avant d'avancer
    setNavDir(next >= stepIdx ? 1 : -1);
    setStepIdx(next);
  };
  // À deux, quitter une étape vers l'avant la marque faite pour les deux.
  const goNext = () => {
    if (stepIdx >= totalSteps - 1) return;
    if (cur.kind === "step") together.markDone(cur.realIdx);
    goTo(stepIdx + 1);
  };
  const finishCooking = () => {
    if (cur.kind === "step") together.markDone(cur.realIdx);
    together.finish();
    setDone(true);
  };
  const goPrev = () => goTo(stepIdx - 1);
  // Saute à une étape réelle (index dans recipe.steps) en la retrouvant dans les pages.
  const goToStep = (realStepIdx: number) => {
    if (realStepIdx < 0) return;
    const pageIdx = pages.findIndex(p => p.kind === "step" && p.realIdx === realStepIdx);
    if (pageIdx >= 0) goTo(pageIdx);
  };

  const getIngImage = (dbId: string | undefined, name: string | undefined) => resolveLineEntry(dbId, name, ingredientDB, ingResolver)?.image || "";
  const getUtImage = (dbId: string | undefined, name: string | undefined) => findUtensilEntry(utensilDB, dbId, name)?.image || "";
  // Précaution d'utilisation d'un ustensile (résolu à la base par dbId, sinon nom).
  const getUtPrecaution = (u: Utensil) => resolveUsagePrecaution(findUtensilEntry(utensilDB, u.dbId, u.name));
  // Équivalent cuillères d'un ingrédient (null si non convertible : sert de garde
  // d'affichage du badge ET de payload d'ouverture de la feuille).
  const convOf = (ing: IngredientLine, amount: number) => spoonConversions(amount, ing.unit, ing.name);
  const openConvert = (ing: IngredientLine, amount: number) => setConvIng({ id: ing.id, name: ing.name, image: getIngImage(ing.dbId, ing.name), amount, unit: ing.unit, spoons: convOf(ing, amount) ?? [] });
  // Quantité affichée d'un ingrédient : en cuillères si l'utilisateur a choisi une
  // unité pour lui (et qu'elle reste convertible à cette quantité), sinon l'unité d'origine.
  const displayQty = (ing: IngredientLine, amount: number) => {
    const chosen = spoonUnitByIng.get(ing.id);
    if (chosen) {
      const match = convOf(ing, amount)?.find(s => s.unit === chosen);
      if (match) return fmtQtyUnit(match.value, match.unit);
    }
    return fmtQtyUnit(amount, ing.unit);
  };
  const progress = ((stepIdx + 1) / totalSteps) * 100;

  // Barre de notification native (Android) : reflète le pas à pas quand l'app
  // passe en arrière-plan. Active pour la recette principale en cours seulement ;
  // ses boutons réveillent l'app et rejouent l'action ici. No-op côté web.
  const cookSnapshot = buildCookSnapshot({
    recipeTitle: recipe.name || "",
    imageUrl: recipe.image || "",
    pageKind: cur.kind,
    stepIdx, totalSteps, realIdx,
    stepText: step?.text || "",
    timers,
    companion: companions.map(co => companionText(co.participant, co.label)).join(" · "),
  });
  useCookSession({
    active: !isNested && !done && !closing,
    snapshot: cookSnapshot,
    onNext: goNext,
    onPrev: goPrev,
    onToggleTimer: () => { const id = pickPilotTimerId(timers); if (id) toggleTimer(id); },
    onStop: requestClose,
  });

  // Navigation au clavier (desktop) : ← précédent, → suivant (ou terminer).
  useEffect(() => {
    if (subCook || done || iterOpen || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("input, textarea, [contenteditable=true]"))) return;
      if (e.key === "ArrowRight") {
        if (stepIdx < totalSteps - 1) goNext();
        else finishCooking();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subCook, done, iterOpen, closing, stepIdx, totalSteps, isBases, allComponentsDone]);

  const stepDurations = useMemo(() => (step ? parseDurations(step.text) : []), [step]);
  const currentTechniques = useMemo(() => stepTechniques(step?.text, techIndex), [step, techIndex]);
  const timerLabel = realIdx >= 0 ? `Étape ${realIdx + 1}` : isOverview ? "Mise en place" : "Bases";

  // Mains libres : la page est lue en arrivant dessus, la voix pilote la navigation
  // et lance le minuteur (durée dite, sinon la première de l'étape).
  const pageSpeech = cookPageSpeech(isOverview ? { kind: "overview", title: recipe.name, ingredients: overviewIngs.length, utensils: overviewUts.length, cuts: postesDecoupe.map(posteLabel) }
    : isBases ? { kind: "bases", count: pendingComponents.length }
    : { kind: "step", number: realIdx + 1, total: realStepCount, text: step?.text ?? "" });
  const voice = useCookVoice({
    speech: pageSpeech,
    pageKey: stepIdx,
    tip: step?.tip,
    techniques: currentTechniques,
    onFinish: finishCooking,
    elapsed,
    stepCount: realStepCount,
    onGotoStep: goToStep,
    onNext: () => (stepIdx < totalSteps - 1 ? goNext() : finishCooking()),
    onPrev: goPrev,
    onOverview: () => {
      if (!hasOverview) return false;
      if (stepIdx === 0) voice.speak(pageSpeech);
      else goTo(0);
      return true;
    },
    onTimer: said => {
      const duration = said ?? stepDurations[0];
      if (duration) addTimer(duration, stepIdx, timerLabel);
      return duration ?? null;
    },
    onTimerAction: action => {
      const target = voiceTimerTarget(timers, action);
      if (target) (action === "stop" ? removeTimer : toggleTimer)(target.id);
      return target;
    },
    onHelp: setVoiceHelpOpen,
    notify,
    paused: !!subCook || done || iterOpen || closing,
  });

  // Gestes tactiles sur le contenu d'une étape (swipe + élastique vertical).
  const { stepScrollRef, stepElasticRef } = useStepGestures(
    !subCook && !done && !iterOpen, goNext, goPrev,
    [subCook, done, iterOpen, stepIdx, totalSteps, isBases, allComponentsDone],
  );

  // Ingrédients liés à l'étape courante (bruts + composants)
  const linkedIngs = stepLinked(recipe.ingredients, step?.ingredients);
  const linkedUts = stepLinked(recipe.utensils, step?.utensils);

  return createPortal(
    <>
      {/* CookMode imbriqué pour un composant */}
      {subCook && (
        <CookModeInner
          recipe={subCook.recipe}
          mult={subCook.mult}
          ingredientDB={ingredientDB}
          utensilDB={utensilDB}
          categories={categories}
          recipesById={recipesById}
          stockSet={stockSet}
          isNested
          onClose={() => { setDoneComponents(prev => new Set([...prev, subCook.recipe.id])); setSubCook(null); }}
        />
      )}

      {done && !subCook && (
        <CookDoneScreen isNested={isNested} closing={closing} recipeName={recipe.name} canIterate={canIterate}
          onIterate={() => setIterOpen(true)} onClose={onClose} />
      )}

      {/* Ajout d'une itération au carnet depuis l'écran de fin */}
      {iterOpen && <CookIterationSheet zIndex={isNested ? 720 : 620} onClose={() => setIterOpen(false)} onSave={saveIteration} />}

      <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 600 : 500, background: "var(--bg)", display: "flex", flexDirection: "column", animation: closing ? "cookModeOut 0.28s cubic-bezier(0.4,0,0.9,0.4) forwards" : "cookModeIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        <CookModeHeader recipeName={recipe.name} isNested={isNested} elapsed={elapsed} progress={progress} companions={companions} offline={together.offline} onClose={requestClose}
          pageLabel={isOverview ? "Mise en place" : isBases ? "Bases" : `Étape ${realIdx + 1} / ${realStepCount}`} voice={voice} onVoiceHelp={() => setVoiceHelpOpen(true)} />

        {/* Main content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Desktop sidebar */}
          <CookSidebar pages={pages} stepIdx={stepIdx} onGoTo={goTo} others={together.others} />

          {/* Step content */}
          <div ref={stepScrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
            <div ref={stepElasticRef} style={{ maxWidth: 640, margin: "0 auto" }}>
              <div key={stepIdx} className={navDir >= 0 ? "cook-step-rise" : "cook-step-drop"}>
                <CookContent
                  isOverview={isOverview} isBases={isBases} step={step} realIdx={realIdx} stepIdx={stepIdx}
                  overviewIngs={overviewIngs} overviewUts={overviewUts} overviewIngGroups={overviewIngGroups} postesDecoupe={postesDecoupe}
                  groupByCategory={groupByCategory} setGroupByCategory={setGroupByCategory}
                  checkedIngIds={checkedIngIds} checkedUtIds={checkedUtIds} checkedCutKeys={checkedCutKeys}
                  toggleIngChecked={toggleIngChecked} toggleUtChecked={toggleUtChecked} toggleCutChecked={toggleCutChecked}
                  getIngImage={getIngImage} getUtImage={getUtImage} getUtPrecaution={getUtPrecaution} convOf={convOf} openConvert={openConvert} displayQty={displayQty}
                  recipesById={recipesById} recipe={recipe} mult={mult}
                  pendingComponents={pendingComponents} doneComponents={doneComponents} setSubCook={setSubCook}
                  stepDurations={stepDurations} addTimer={addTimer} techIndex={techIndex} linkedIngs={linkedIngs} linkedUts={linkedUts}
                  utensilDB={utensilDB} setPrecSheet={setPrecSheet} posteStepByKey={posteStepByKey} goToStep={goToStep}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Minuteurs actifs : pile repliable ancrée à droite, au-dessus de la nav. */}
        <CookTimersStack timers={timers} starters={timerStarters} timersOpen={timersOpen} setTimersOpen={setTimersOpen} now={now}
          onGoToStep={goTo} onToggle={toggleTimer} onRestart={restartTimer} onRemove={removeTimer} />

        {/* Bottom nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px calc(14px + max(env(safe-area-inset-bottom) - 8px, 0px))", background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-ghost btn-pill" style={{ flex: 1 }} onClick={goPrev} disabled={stepIdx === 0} title="Précédent (flèche ←)">
            <Icon name="back" size={16} /> Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--text3)", minWidth: 60, textAlign: "center" }}>
            {isOverview ? "Aperçu" : isBases ? "Bases" : `${realIdx + 1} / ${realStepCount}`}
          </span>
          {stepIdx < totalSteps - 1
            ? <button className="btn btn-primary btn-pill btn-flat" style={{ flex: 1 }} onClick={goNext} disabled={isBases && !allComponentsDone} title="Suivant (flèche →)">Suivant <Icon name="forward" size={16} /></button>
            : <button className="btn btn-primary btn-pill btn-flat" style={{ flex: 1, background: "var(--ok)" }} onClick={finishCooking}><Icon name="check" size={16} /> Terminé !</button>
          }
        </div>
      </div>

      {convIng && (
        <QuantityConvertSheet
          ing={convIng}
          selectedUnit={spoonUnitByIng.get(convIng.id) || null}
          onSelectUnit={(unit) => { setSpoonUnit(convIng.id, unit); setConvIng(null); }}
          onReset={() => { setSpoonUnit(convIng.id, null); setConvIng(null); }}
          zIndex={isNested ? 720 : 620}
          onClose={() => setConvIng(null)}
        />
      )}
      {voiceHelpOpen && <VoiceCommandsSheet zIndex={isNested ? 720 : 620} onClose={() => setVoiceHelpOpen(false)} />}
      {precSheet && <UtensilPrecautionSheet utensilName={precSheet.name} precaution={precSheet.prec} zIndex={isNested ? 720 : 620} onClose={() => setPrecSheet(null)} />}
    </>,
    document.body
  );
}

export function CookMode({ recipe, mult, ingredientDB, utensilDB, categories, onClose, onCooked, recipes = [], stockSet, onUpdateRecipe }: CookModeProps) {
  const recipesById = useMemo(() => new Map((recipes || []).flatMap(r => (r.id ? [[r.id, r] as const] : []))), [recipes]);
  return (
    <CookModeInner
      recipe={recipe}
      mult={mult}
      ingredientDB={ingredientDB}
      utensilDB={utensilDB}
      categories={categories}
      onClose={onClose}
      onCooked={onCooked}
      recipesById={recipesById}
      stockSet={stockSet}
      onUpdateRecipe={onUpdateRecipe}
    />
  );
}
