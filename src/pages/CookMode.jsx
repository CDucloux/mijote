import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon.jsx";
import { parseDurations } from "@/lib/planning/stepTimers.js";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { buildPostesDecoupe, findDecoupeStepIndex } from "@/lib/recipes/decoupe.js";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { resolveUsagePrecaution } from "@/lib/ustensils/usagePrecaution.js";
import { UtensilPrecautionSheet } from "../components/QualityHints.jsx";
import { fmtQtyUnit, fmtElapsed } from "../lib/format.js";
import { groupIngredientsByCategory, buildPendingComponents } from "@/lib/cookSession/misEnPlace.ts";
import { spoonConversions } from "@/lib/food/calculators.js";
import { QuantityConvertSheet } from "../components/QuantityConvertSheet.jsx";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea.jsx";
import { RatingPicker } from "../components/RatingPicker.jsx";
import { addVersion, nextVersionLabel } from "@/lib/recipes/history.js";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { useLS } from "../hooks/useLS.js";
import { useCookSession } from "../hooks/useCookSession.js";
import { useCookTimers } from "../hooks/useCookTimers.js";
import { useStepGestures } from "../hooks/useStepGestures.js";
import { CookTimersStack } from "../components/cookMode/CookTimersStack.jsx";
import { CookDoneScreen } from "../components/cookMode/CookDoneScreen.jsx";
import { CookContent } from "../components/cookMode/CookContent.jsx";
import { CookSidebar } from "../components/cookMode/CookSidebar.jsx";
import { buildCookSnapshot, pickPilotTimerId } from "@/lib/cookSession/snapshot.ts";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";

// ─── COOK MODE ────────────────────────────────────────────────────────────────
// `recipes` + `stockSet` permettent de gérer les composants (préparations de base) :
// - étape 0 : liste des composants épuisés à réaliser avant de commencer ;
// - dans chaque step : les lignes composant s'affichent avec 🧈 (pas d'image dbId).
// - bouton « Réaliser » → CookMode imbriqué sur le composant mis à l'échelle.

function CookModeInner({ recipe, mult, ingredientDB, utensilDB, categories = DEFAULT_CATEGORIES, onClose, onCooked, recipesById, stockSet, onUpdateRecipe, isNested = false }) {
  const { techniques, notify } = useAppShell();
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  // Chrono global : « depuis quand la recette est lancée » (recette principale
  // uniquement). Gelé une fois la recette terminée.
  const startedAtRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isNested || done) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [isNested, done]);
  // Consigne le plat au journal de cuisine, une seule fois, à l'arrivée sur l'écran
  // de fin de la recette PRINCIPALE (les bases imbriquées ne comptent pas).
  const cookedLoggedRef = useRef(false);
  useEffect(() => {
    if (done && !isNested && !cookedLoggedRef.current) { cookedLoggedRef.current = true; onCooked?.(recipe.id); }
  }, [done, isNested, onCooked, recipe.id]);
  const [closing, setClosing] = useState(false);
  // Fermeture animée : joue la sortie (fondu + glissé) avant de démonter réellement.
  const requestClose = () => { if (closing) return; setClosing(true); setTimeout(() => onClose(), 280); };
  const [subCook, setSubCook] = useState(null); // { recipe, mult }
  const [precSheet, setPrecSheet] = useState(null); // { name, prec } précaution ustensile ouverte
  const [doneComponents, setDoneComponents] = useState(new Set());
  // Checklist de « mise en place » (ingrédients/ustensiles rassemblés) : propre à
  // CETTE session de cuisine, jamais persistée (elle n'a plus de sens à la prochaine).
  const [checkedIngIds, setCheckedIngIds] = useState(() => new Set());
  const [checkedUtIds, setCheckedUtIds] = useState(() => new Set());
  const [checkedCutKeys, setCheckedCutKeys] = useState(() => new Set());
  const toggleIngChecked = (id) => setCheckedIngIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleUtChecked = (id) => setCheckedUtIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleCutChecked = (key) => setCheckedCutKeys(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  // Conversion d'une quantité en cuillères (feuille), depuis la mise en place.
  const [convIng, setConvIng] = useState(null);
  // Unité d'affichage choisie par ingrédient (cuillère à soupe / à café), pour qui
  // préfère mesurer que peser. Propre à la session, appliquée partout dans le cook mode.
  const [spoonUnitByIng, setSpoonUnitByIng] = useState(() => new Map());
  const setSpoonUnit = (ingId, unit) => setSpoonUnitByIng(prev => { const m = new Map(prev); unit ? m.set(ingId, unit) : m.delete(ingId); return m; });
  // Préférence d'affichage (liste / par catégorie) : persistée, elle reste valable
  // d'une recette à l'autre.
  const [groupByCategory, setGroupByCategory] = useLS("rf_cookModeGroupByCategory", false);
  // Itération de fin de cuisson : alimente le carnet d'itérations depuis l'écran final.
  const [iterOpen, setIterOpen] = useState(false);
  const [iterRating, setIterRating] = useState(null);
  const [iterNotes, setIterNotes] = useState("");
  // Minuteurs déclenchés depuis les mentions de temps de l'étape. Base horodatée
  // (cf. `cookTimers`) : le restant se dérive de l'horloge, donc reste juste après
  // un passage en arrière-plan. En natif, une notification OS est planifiée à
  // l'échéance pour sonner même écran verrouillé (cf. `localNotifications`).
  const [navDir, setNavDir] = useState(1); // sens de navigation (animation d'étape)
  const { timers, timersOpen, setTimersOpen, now, addTimer, toggleTimer, restartTimer, removeTimer } = useCookTimers(notify);
  const canIterate = !isNested && !!onUpdateRecipe;
  const saveIteration = () => {
    onUpdateRecipe(addVersion(recipe, { label: nextVersionLabel(recipe.history), rating: iterRating, notes: iterNotes }));
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
  // Postes de découpe de la mise en place : regroupés/ordonnés depuis les
  // ingrédients porteurs d'une découpe, aux quantités mises à l'échelle (mult).
  const postesDecoupe = useMemo(() => {
    const scaled = (recipe.ingredients || []).map(i => {
      const a = i.amount != null && i.amount !== "" ? Number(i.amount) * (mult || 1) : i.amount;
      return { ...i, amount: a };
    });
    return buildPostesDecoupe(scaled, techIndex);
  }, [recipe.ingredients, mult, techIndex]);
  // Étape réelle où chaque découpe a été détectée (clé du poste → index d'étape, -1 si
  // aucune) : permet d'y naviguer pour vérifier la classification d'une taille douteuse.
  const posteStepByKey = useMemo(() => {
    const m = new Map();
    for (const poste of postesDecoupe) {
      m.set(poste.key, findDecoupeStepIndex(poste, recipe.ingredients, recipe.steps));
    }
    return m;
  }, [postesDecoupe, recipe.ingredients, recipe.steps]);

  const realStepCount = (recipe.steps || []).length;
  const pages = useMemo(() => {
    const arr = [];
    if (hasOverview) arr.push({ kind: "overview" });
    if (pendingComponents.length > 0) arr.push({ kind: "bases" });
    (recipe.steps || []).forEach((s, i) => arr.push({ kind: "step", step: s, realIdx: i }));
    return arr;
  }, [hasOverview, pendingComponents.length, recipe.steps]);
  const totalSteps = pages.length || 1;
  const cur = pages[Math.min(stepIdx, pages.length - 1)] || { kind: "overview" };
  const isOverview = cur.kind === "overview";
  const isBases = cur.kind === "bases";
  const step = cur.kind === "step" ? cur.step : null;
  const realIdx = cur.kind === "step" ? cur.realIdx : -1;

  // Toutes les bases avec étapes doivent être réalisées avant de passer à la suite.
  const allComponentsDone = pendingComponents
    .filter(({ comp }) => comp.steps?.length > 0)
    .every(({ comp }) => doneComponents.has(comp.id));

  // Navigation entre pages, en mémorisant le sens pour l'animation d'expansion :
  // en avant le contenu monte depuis le bas, en arrière il descend depuis le haut.
  const goTo = (idx) => {
    const next = Math.max(0, Math.min(totalSteps - 1, idx));
    if (next === stepIdx) return;
    if (isBases && next > stepIdx && !allComponentsDone) return; // bases à finir avant d'avancer
    setNavDir(next >= stepIdx ? 1 : -1);
    setStepIdx(next);
  };
  const goNext = () => { if (stepIdx < totalSteps - 1) goTo(stepIdx + 1); };
  const goPrev = () => goTo(stepIdx - 1);
  // Saute à une étape réelle (index dans recipe.steps) en la retrouvant dans les pages.
  const goToStep = (realStepIdx) => {
    if (realStepIdx < 0) return;
    const pageIdx = pages.findIndex(p => p.kind === "step" && p.realIdx === realStepIdx);
    if (pageIdx >= 0) goTo(pageIdx);
  };

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => (utensilDB || []).find(d => d.id === dbId)?.image || (name ? (utensilDB || []).find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");
  // Précaution d'utilisation d'un ustensile (résolu à la base par dbId, sinon nom).
  const getUtPrecaution = (u) => resolveUsagePrecaution((utensilDB || []).find(d => d.id === u.dbId) || (u.name ? (utensilDB || []).find(d => normalizeStr(d.name) === normalizeStr(u.name)) : null));
  // Équivalent cuillères d'un ingrédient (null si non convertible : sert de garde
  // d'affichage du badge ET de payload d'ouverture de la feuille).
  const convOf = (ing, amount) => spoonConversions(amount, ing.unit, ing.name);
  const openConvert = (ing, amount) => setConvIng({ id: ing.id, name: ing.name, image: getIngImage(ing.dbId, ing.name), amount, unit: ing.unit, spoons: convOf(ing, amount) });
  // Quantité affichée d'un ingrédient : en cuillères si l'utilisateur a choisi une
  // unité pour lui (et qu'elle reste convertible à cette quantité), sinon l'unité d'origine.
  const displayQty = (ing, amount) => {
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
    const onKey = (e) => {
      if (e.defaultPrevented || e.target?.closest?.("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowRight") {
        if (stepIdx < totalSteps - 1) goNext();
        else setDone(true);
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subCook, done, iterOpen, closing, stepIdx, totalSteps, isBases, allComponentsDone]);

  const stepDurations = useMemo(() => (step ? parseDurations(step.text) : []), [step]);

  // Gestes tactiles sur le contenu d'une étape (swipe + élastique vertical).
  const { stepScrollRef, stepElasticRef } = useStepGestures(
    !subCook && !done && !iterOpen, goNext, goPrev,
    [subCook, done, iterOpen, stepIdx, totalSteps, isBases, allComponentsDone],
  );

  // Ingrédients liés à l'étape courante (bruts + composants)
  const linkedIngs = step
    ? (recipe.ingredients || []).filter(i => step.ingredients?.includes(i.id))
    : [];
  const linkedUts = step
    ? (recipe.utensils || []).filter(u => step.utensils?.includes(u.id))
    : [];

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
          onIterate={() => { setIterRating(null); setIterNotes(""); setIterOpen(true); }} onClose={onClose} />
      )}

      {/* Ajout d'une itération au carnet depuis l'écran de fin */}
      {iterOpen && (
        <SwipeableSheet onClose={() => setIterOpen(false)} zIndex={isNested ? 720 : 620} style={{ maxHeight: "88dvh" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Noter cette fois</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Fige l'état actuel de la recette dans le carnet d'itérations, avec ton ressenti.</p>
          <div className="field-label">Note du résultat (optionnel)</div>
          <div style={{ marginBottom: 16 }}><RatingPicker value={iterRating} onChange={setIterRating} /></div>
          <div className="field-label">Notes de dégustation</div>
          <AutoResizeTextarea className="field-input" value={iterNotes} onChange={e => setIterNotes(e.target.value)} placeholder="ex : -10 g de sucre, +zeste de citron vert, cuit 4 min de moins → meilleur" style={{ marginBottom: 18 }} />
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={saveIteration}>
            <Icon name="save" size={15} /> Enregistrer l'itération
          </button>
        </SwipeableSheet>
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 600 : 500, background: "var(--bg)", display: "flex", flexDirection: "column", animation: closing ? "cookModeOut 0.28s cubic-bezier(0.4,0,0.9,0.4) forwards" : "cookModeIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(16px + max(env(safe-area-inset-top) - 8px, 0px)) 20px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="cook-close-btn" onClick={requestClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={isNested ? "back" : "close"} size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isNested && <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><BaseIcon size={14} /></span>}
              {recipe.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              {isOverview ? "Mise en place" : isBases ? "Bases" : `Étape ${realIdx + 1} / ${realStepCount}`}
            </div>
          </div>
          {/* Chrono global : temps écoulé depuis le lancement de la recette. */}
          {!isNested && (
            <div title="Temps écoulé depuis le lancement" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 11px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>
              <Icon name="clock" size={14} color="var(--accent)" />
              <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", color: "var(--text)" }}>{fmtElapsed(elapsed)}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--surface2)", flexShrink: 0 }}>
          <div style={{ height: "100%", background: isNested ? "var(--accent)" : "var(--accent)", width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Desktop sidebar */}
          <CookSidebar pages={pages} stepIdx={stepIdx} onGoTo={goTo} />

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
        <CookTimersStack timers={timers} timersOpen={timersOpen} setTimersOpen={setTimersOpen} now={now}
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
            : <button className="btn btn-primary btn-pill btn-flat" style={{ flex: 1, background: "var(--ok)" }} onClick={() => setDone(true)}><Icon name="check" size={16} /> Terminé !</button>
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
      {precSheet && <UtensilPrecautionSheet utensilName={precSheet.name} precaution={precSheet.prec} zIndex={isNested ? 720 : 620} onClose={() => setPrecSheet(null)} />}
    </>,
    document.body
  );
}

export function CookMode({ recipe, mult, ingredientDB, utensilDB, categories, onClose, onCooked, recipes = [], stockSet, onUpdateRecipe }) {
  const recipesById = useMemo(() => new Map((recipes || []).map(r => [r.id, r])), [recipes]);
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
