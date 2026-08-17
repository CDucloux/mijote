import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon.jsx";
import { parseDurations, fmtCountdown } from "@/lib/planning/stepTimers.js";
import { StepTip } from "../components/StepTip.jsx";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { TechniqueText } from "../components/TechniqueText.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildTechniqueIndex } from "@/lib/recipes/techniques.js";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { consumptionFraction } from "@/lib/recipes/recipeComponents.js";
import { formatParamSummary } from "@/lib/utensils/appliances.js";
import { capitalize, fmtQtyUnit } from "../lib/format.js";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea.jsx";
import { RatingPicker } from "../components/RatingPicker.jsx";
import { addVersion, nextVersionLabel } from "@/lib/recipes/history.js";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { useLS } from "../hooks/useLS.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries } from "../constants/categories.js";

// Formate un temps écoulé en `m:ss` (ou `h:mm:ss` au-delà d'une heure).
function fmtElapsed(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

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
  const [doneComponents, setDoneComponents] = useState(new Set());
  // Checklist de « mise en place » (ingrédients/ustensiles rassemblés) : propre à
  // CETTE session de cuisine, jamais persistée (elle n'a plus de sens à la prochaine).
  const [checkedIngIds, setCheckedIngIds] = useState(() => new Set());
  const [checkedUtIds, setCheckedUtIds] = useState(() => new Set());
  const toggleIngChecked = (id) => setCheckedIngIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleUtChecked = (id) => setCheckedUtIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  // Préférence d'affichage (liste / par catégorie) : persistée, elle reste valable
  // d'une recette à l'autre.
  const [groupByCategory, setGroupByCategory] = useLS("rf_cookModeGroupByCategory", false);
  // Itération de fin de cuisson : alimente le carnet d'itérations depuis l'écran final.
  const [iterOpen, setIterOpen] = useState(false);
  const [iterRating, setIterRating] = useState(null);
  const [iterNotes, setIterNotes] = useState("");
  // Minuteurs déclenchés depuis les mentions de temps de l'étape.
  const [timers, setTimers] = useState([]); // { id, label, total, remaining, running, done }
  const notifiedRef = useRef(new Set());
  const addTimer = (d) => setTimers(prev => prev.some(t => t.id.startsWith(`${d.minutes}-`) && !t.done && t.running)
    ? prev
    : [...prev, { id: `${d.minutes}-${Date.now()}`, label: d.label, total: d.minutes * 60, remaining: d.minutes * 60, running: true, done: false }]);
  const toggleTimer = (id) => setTimers(prev => prev.map(t => t.id === id && !t.done ? { ...t, running: !t.running } : t));
  const resetTimer = (id) => { notifiedRef.current.delete(id); setTimers(prev => prev.map(t => t.id === id ? { ...t, remaining: t.total, running: true, done: false } : t)); };
  const removeTimer = (id) => { notifiedRef.current.delete(id); setTimers(prev => prev.filter(t => t.id !== id)); };
  const canIterate = !isNested && !!onUpdateRecipe;
  const saveIteration = () => {
    onUpdateRecipe(addVersion(recipe, { label: nextVersionLabel(recipe.history), rating: iterRating, notes: iterNotes }));
    setIterOpen(false);
    notify?.("Itération ajoutée au carnet");
    requestClose();
  };

  // Composants épuisés référencés par cette recette (étape 0)
  const pendingComponents = useMemo(() => {
    if (!recipesById) return [];
    return (recipe.ingredients || [])
      .filter(ing => ing.recipeId && !stockSet?.has(ing.recipeId))
      .map(ing => {
        const comp = recipesById.get(ing.recipeId);
        if (!comp) return null;
        const f = consumptionFraction(ing, comp);
        return { line: ing, comp, nestedMult: (mult || 1) * f };
      })
      .filter(Boolean);
  }, [recipe, recipesById, stockSet, mult]);

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
  const overviewIngGroups = useMemo(() => {
    const buckets = {};
    for (const ing of recipe.ingredients || []) {
      const info = ingredientDB.find(d => d.id === ing.dbId) || (ing.name ? findIngredientMatch(ing.name, ingredientDB) : undefined);
      const cat = info?.category || "other";
      (buckets[cat] = buckets[cat] || []).push(ing);
    }
    return sortedCategoryEntries(categories)
      .filter(([k]) => buckets[k]?.length)
      .map(([k, c]) => ({ key: k, label: c.label, icon: c.icon, items: buckets[k] }));
  }, [recipe.ingredients, ingredientDB, categories]);
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

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => (utensilDB || []).find(d => d.id === dbId)?.image || (name ? (utensilDB || []).find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");
  const progress = ((stepIdx + 1) / totalSteps) * 100;

  // Décompte : 1 tick/s tant qu'un minuteur tourne. Passe à done à 0.
  useEffect(() => {
    if (!timers.some(t => t.running && t.remaining > 0)) return;
    const iv = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (!t.running || t.remaining <= 0) return t;
        const rem = t.remaining - 1;
        return rem <= 0 ? { ...t, remaining: 0, running: false, done: true } : { ...t, remaining: rem };
      }));
    }, 1000);
    return () => clearInterval(iv);
  }, [timers]);

  // Alarme quand un minuteur se termine (une seule fois, compatible StrictMode).
  useEffect(() => {
    for (const t of timers) {
      if (t.done && !notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id);
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            const ctx = new AC();
            [0, 0.28, 0.56].forEach(off => {
              const o = ctx.createOscillator(), g = ctx.createGain();
              o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.value = 880;
              const s = ctx.currentTime + off;
              g.gain.setValueAtTime(0.0001, s);
              g.gain.exponentialRampToValueAtTime(0.3, s + 0.02);
              g.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
              o.start(s); o.stop(s + 0.22);
            });
            setTimeout(() => ctx.close?.(), 1200);
          }
        } catch { /* audio indisponible */ }
        notify?.(`Minuteur terminé, ${t.label}`);
      }
    }
  }, [timers, notify]);

  // Navigation au clavier (desktop) : ← précédent, → suivant (ou terminer).
  useEffect(() => {
    if (subCook || done || iterOpen || closing) return;
    const onKey = (e) => {
      if (e.defaultPrevented || e.target?.closest?.("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowRight") {
        if (stepIdx < totalSteps - 1) { if (!(isBases && !allComponentsDone)) setStepIdx(i => i + 1); }
        else setDone(true);
      } else if (e.key === "ArrowLeft") {
        setStepIdx(i => Math.max(0, i - 1));
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subCook, done, iterOpen, closing, stepIdx, totalSteps, isBases, allComponentsDone]);

  const stepDurations = useMemo(() => (step ? parseDurations(step.text) : []), [step]);

  // Gestes tactiles sur le contenu d'une étape :
  //   • swipe horizontal → ← étape suivante, → étape précédente ;
  //   • rubber band vertical en haut ET en bas (le contenu se soulève/descend
  //     élastiquement puis revient en ressort).
  // Listeners natifs (touchmove non passif) : indispensable pour preventDefault()
  // pendant l'élastique.
  const stepScrollRef = useRef(null);
  const stepElasticRef = useRef(null);
  useEffect(() => {
    const el = stepScrollRef.current;
    if (!el || subCook || done || iterOpen) return;
    // Amplitude plus contenue (max 56 px) et ressort plus posé.
    const MAX_PULL = 56;
    const damp = (d, max) => max * (1 - Math.exp(-d / max));
    const atTop = () => el.scrollTop <= 0;
    const atBottom = () => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
    let dragging = false, x0 = 0, y0 = 0, axis = null, edge = null, pull = 0, raf = 0;
    // Écriture du transform batchée à la frame (évite les écritures multiples par
    // frame pendant le drag → moins de « lag »).
    const flush = () => { raf = 0; const p = stepElasticRef.current; if (p) p.style.transform = pull ? `translateY(${pull.toFixed(2)}px)` : ""; };
    const scheduleFlush = () => { if (!raf) raf = requestAnimationFrame(flush); };
    const setPull = (v) => { pull = v; scheduleFlush(); };
    const springBack = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pull = 0;
      const p = stepElasticRef.current; if (!p) return;
      p.style.transition = "transform 0.8s cubic-bezier(0.22,1,0.3,1)";
      p.style.transform = "translateY(0px)";
      // Retire la couche GPU une fois le ressort terminé (rendu texte net au repos).
      const clear = () => { p.style.willChange = ""; p.removeEventListener("transitionend", clear); };
      p.addEventListener("transitionend", clear);
    };
    const onDown = (e) => {
      dragging = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; axis = null; edge = null; pull = 0;
      // `will-change` posé UNIQUEMENT le temps du drag : une couche GPU permanente
      // sur ce conteneur dégradait le rendu du texte (chiffres « qui bavent »).
      const p = stepElasticRef.current; if (p) { p.style.transition = "none"; p.style.willChange = "transform"; }
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (!axis) { if (Math.abs(dx) > 8 || Math.abs(dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "y") return;
      if (!edge) edge = atTop() && dy > 0 ? "top" : atBottom() && dy < 0 ? "bottom" : "scroll";
      if (edge === "top") { setPull(damp(dy, MAX_PULL)); if (e.cancelable) e.preventDefault(); }
      else if (edge === "bottom") { setPull(-damp(-dy, MAX_PULL)); if (e.cancelable) e.preventDefault(); }
    };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      if (axis === "x") {
        const dx = e.changedTouches[0].clientX - x0;
        if (dx < -50) { if (stepIdx < totalSteps - 1 && !(isBases && !allComponentsDone)) setStepIdx(i => i + 1); }
        else if (dx > 50) setStepIdx(i => Math.max(0, i - 1));
      }
      if (edge === "top" || edge === "bottom") springBack();
      else { const p = stepElasticRef.current; if (p) p.style.willChange = ""; } // pas de ressort → on retire la couche GPU tout de suite
      axis = null; edge = null;
    };
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("touchcancel", onUp);
    };
  }, [subCook, done, iterOpen, stepIdx, totalSteps, isBases, allComponentsDone]);

  // Ingrédients liés à l'étape courante (bruts + composants)
  const linkedIngs = step
    ? (recipe.ingredients || []).filter(i => step.ingredients?.includes(i.id))
    : [];
  const linkedUts = step
    ? (recipe.utensils || []).filter(u => step.utensils?.includes(u.id))
    : [];

  // Rendu d'une ligne ingrédient : brute ou composant
  const renderIngLine = (ing) => {
    const isComp = !!ing.recipeId && !ing.dbId;
    const comp = isComp && recipesById ? recipesById.get(ing.recipeId) : null;
    const displayName = isComp ? (comp?.name || ing.name || "Préparation introuvable") : ing.name;
    const imgSrc = isComp ? (comp?.image || "") : getIngImage(ing.dbId, ing.name);
    return (
      <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isComp
          ? <span style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(232,112,58,0.1)", border: "1.5px solid rgba(232,112,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={22} /></span>
          : <IngImage src={imgSrc} alt={displayName} size={42} />
        }
        <span style={{ flex: 1, fontSize: 14, color: isComp ? "var(--accent)" : "var(--text)", fontWeight: isComp ? 600 : 400 }}>{capitalize(displayName)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: isComp ? "var(--accent)" : "var(--accent)" }}>
          {fmtQtyUnit(ing.amount * (mult || 1), ing.unit)}
        </span>
      </div>
    );
  };

  // Rendu d'une ligne ingrédient COCHABLE (mise en place) : même contenu que
  // `renderIngLine`, dans une rangée cliquable qui bascule son état « rassemblé ».
  const renderOverviewIngRow = (ing) => {
    const isComp = !!ing.recipeId && !ing.dbId;
    const comp = isComp && recipesById ? recipesById.get(ing.recipeId) : null;
    const displayName = isComp ? (comp?.name || ing.name || "Préparation introuvable") : ing.name;
    const imgSrc = isComp ? (comp?.image || "") : getIngImage(ing.dbId, ing.name);
    const gathered = checkedIngIds.has(ing.id);
    return (
      <button key={ing.id} type="button" onClick={() => toggleIngChecked(ing.id)} className="pressable"
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: 10 }}>
        <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center", border: `2px solid ${gathered ? "var(--green)" : "var(--border)"}`, background: gathered ? "var(--green)" : "transparent", transition: "background 0.15s, border-color 0.15s" }}>
          {gathered && <Icon name="check" size={13} color="#fff" />}
        </span>
        <span style={{ flexShrink: 0, opacity: gathered ? 0.5 : 1, transition: "opacity 0.15s" }}>
          {isComp
            ? <span style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(232,112,58,0.1)", border: "1.5px solid rgba(232,112,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><BaseIcon size={22} /></span>
            : <IngImage src={imgSrc} alt={displayName} size={42} />
          }
        </span>
        <span style={{ flex: 1, fontSize: 14, color: isComp ? "var(--accent)" : "var(--text)", fontWeight: isComp ? 600 : 400, textDecoration: gathered ? "line-through" : "none", opacity: gathered ? 0.55 : 1, transition: "opacity 0.15s" }}>{capitalize(displayName)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", opacity: gathered ? 0.55 : 1, transition: "opacity 0.15s" }}>
          {fmtQtyUnit(ing.amount * (mult || 1), ing.unit)}
        </span>
      </button>
    );
  };

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
        <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 601 : 501, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "cookModeIn 0.4s ease", opacity: closing ? 0 : 1, transition: "opacity 0.28s ease", padding: 32, textAlign: "center" }}>
          {["🍽️", "✨", "🎉", "👨‍🍳", "⭐", "🥳"].map((e, i) => (
            <span key={i} style={{ position: "absolute", fontSize: 28 + i * 4, animation: `floatUp ${1.2 + i * 0.3}s ease forwards`, animationDelay: `${i * 0.15}s`, left: `${10 + i * 14}%`, top: `${60 + Math.sin(i) * 15}%`, pointerEvents: "none" }}>{e}</span>
          ))}
          <div style={{ animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1)", marginBottom: 24 }}>
            <div style={{ fontSize: 72, lineHeight: 1 }}>🍳</div>
          </div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 12, animation: "popIn 0.6s 0.2s both cubic-bezier(0.34,1.56,0.64,1)" }}>
            {isNested ? "Base terminée !" : "Félicitations !"}
          </h1>
          <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.6, marginBottom: 32, maxWidth: 300, animation: "popIn 0.5s 0.35s both ease" }}>
            {isNested
              ? <><strong style={{ color: "var(--text)" }}>{recipe.name}</strong> est prêt·e. Reviens à la recette principale.</>
              : <><strong style={{ color: "var(--text)" }}>{recipe.name}</strong> est prêt·e !</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320, animation: "popIn 0.5s 0.5s both ease" }}>
            {canIterate && (
              <button className="btn btn-ghost" style={{ padding: "13px 24px", fontSize: 15, borderRadius: 999 }} onClick={() => { setIterRating(null); setIterNotes(""); setIterOpen(true); }}>
                <Icon name="star" size={17} /> Noter une itération
              </button>
            )}
            {/* Retour DIRECT depuis l'écran de fin (onClose sans `requestClose`) :
                le fondu de sortie depuis cet écran paraissait étrange. */}
            <button className="btn btn-primary" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 999 }} onClick={onClose}>
              <Icon name="check" size={18} /> {isNested ? "Retour" : "Retour à la recette"}
            </button>
          </div>
        </div>
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
            <Icon name="check" size={15} /> Enregistrer l'itération
          </button>
        </SwipeableSheet>
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 600 : 500, background: "var(--bg)", display: "flex", flexDirection: "column", animation: closing ? "cookModeOut 0.28s cubic-bezier(0.4,0,0.9,0.4) forwards" : "cookModeIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
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
              <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.02em", color: "var(--text)" }}>{fmtElapsed(elapsed)}</span>
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
          <div className="cook-mode-sidebar" style={{ display: "none", width: 260, minWidth: 260, overflowY: "auto", borderRight: "1px solid var(--border)", padding: "12px 0" }}>
            {pages.map((pg, idx) => {
              const active = idx === stepIdx, passed = idx < stepIdx;
              const label = pg.kind === "overview" ? "Mise en place" : pg.kind === "bases" ? "Bases" : `Étape ${pg.realIdx + 1}`;
              const dotBg = active ? "var(--accent)" : passed ? "var(--green)" : "var(--surface2)";
              const dotFg = active || passed ? "#fff" : "var(--text3)";
              return (
                <button key={pg.kind === "step" ? pg.step.id : pg.kind} onClick={() => setStepIdx(idx)}
                  style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", background: active ? "rgba(232,112,58,0.1)" : "none", borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`, textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: dotBg, color: dotFg }}>
                    {passed ? <Icon name="check" size={11} color="#fff" />
                      : pg.kind === "step" ? pg.realIdx + 1
                      : pg.kind === "bases" ? <BaseIcon size={12} color={active ? "#fff" : "var(--text3)"} />
                      : <Icon name="fileText" size={11} color={dotFg} />}
                  </div>
                  <span style={{ fontSize: 13, color: active ? "var(--accent)" : passed ? "var(--text3)" : "var(--text2)", fontWeight: active ? 600 : 400, lineHeight: 1.4 }}>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Step content */}
          <div ref={stepScrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
            <div ref={stepElasticRef} style={{ maxWidth: 640, margin: "0 auto" }}>
              {isOverview ? (
                /* ── Aperçu (mise en place) : tous les ingrédients + ustensiles ── */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div key="head-overview" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="fileText" size={19} color="#fff" /></div>
                    <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 500 }}>Mise en place</h2>
                  </div>
                  <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>
                    Rassemble tous les ingrédients aux bonnes quantités et sors les ustensiles nécessaires avant de te lancer.
                  </p>
                  {overviewIngs.length > 0 && (
                    <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ingrédients</span>
                        {checkedIngIds.size > 0 && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--green)", background: "rgba(76,175,125,0.12)", borderRadius: 999, padding: "1px 8px" }}>
                            {checkedIngIds.size}/{overviewIngs.length}
                          </span>
                        )}
                        <button type="button" onClick={() => setGroupByCategory(v => !v)} className="pressable"
                          title={groupByCategory ? "Afficher en liste" : "Regrouper par catégorie"}
                          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: groupByCategory ? "var(--accent)" : "var(--text3)", background: groupByCategory ? "rgba(232,112,58,0.1)" : "var(--surface2)", border: `1px solid ${groupByCategory ? "rgba(232,112,58,0.3)" : "var(--border)"}`, borderRadius: 999, padding: "5px 11px", cursor: "pointer", flexShrink: 0 }}>
                          <Icon name="grid" size={12} color={groupByCategory ? "var(--accent)" : "var(--text3)"} /> Catégories
                        </button>
                      </div>
                      {groupByCategory ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {overviewIngGroups.map(g => (
                            <div key={g.key}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                <span style={{ fontSize: 13 }}>{g.icon}</span>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{g.label}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {g.items.map(renderOverviewIngRow)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {overviewIngs.map(renderOverviewIngRow)}
                        </div>
                      )}
                    </div>
                  )}
                  {overviewUts.length > 0 && (
                    <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ustensiles</span>
                        {checkedUtIds.size > 0 && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--green)", background: "rgba(76,175,125,0.12)", borderRadius: 999, padding: "1px 8px" }}>
                            {checkedUtIds.size}/{overviewUts.length}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {overviewUts.map(u => {
                          const gathered = checkedUtIds.has(u.id);
                          return (
                            <button key={u.id} type="button" onClick={() => toggleUtChecked(u.id)} className="pressable"
                              style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: gathered ? "rgba(76,175,125,0.12)" : "var(--surface2)", border: `1px solid ${gathered ? "rgba(76,175,125,0.35)" : "transparent"}`, borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: gathered ? "var(--green)" : "var(--text)", cursor: "pointer", textDecoration: gathered ? "line-through" : "none" }}>
                              <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0, opacity: gathered ? 0.6 : 1 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" }} /></div>
                              {gathered && <Icon name="check" size={11} color="var(--green)" />}
                              {u.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : isBases ? (
                /* ── Bases : préparations de base à réaliser ── */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div key="head-bases" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={20} color="#fff" /></div>
                    <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 500 }}>Bases</h2>
                  </div>
                  <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>
                    Réalise ces préparations de base avant de commencer la recette principale.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {pendingComponents.map(({ line, comp, nestedMult }) => (
                      <div key={comp.id} style={{ background: "var(--surface)", border: `1.5px solid ${doneComponents.has(comp.id) ? "rgba(76,175,125,0.45)" : "rgba(232,112,58,0.3)"}`, borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 14, transition: "border-color 0.25s" }}>
                        {comp.image
                          ? <Img src={comp.image} alt={comp.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                          : <span style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(232,112,58,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={28} /></span>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{comp.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text3)" }}>
                            {fmtQtyUnit(line.amount * (mult || 1), line.unit)}
                            {comp.steps?.length ? ` · ${comp.steps.length} étape${comp.steps.length > 1 ? "s" : ""}` : ""}
                          </div>
                        </div>
                        {comp.steps?.length > 0 && (
                          doneComponents.has(comp.id)
                            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(52,199,89,0.12)", border: "1px solid rgba(52,199,89,0.35)", color: "var(--green)", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                                <Icon name="check" size={13} color="var(--green)" /> Terminé
                              </span>
                            : <button
                                className="btn btn-primary btn-sm"
                                style={{ gap: 6, flexShrink: 0, borderRadius: 10 }}
                                onClick={() => setSubCook({ recipe: comp, mult: nestedMult })}
                              >
                                <Icon name="fire" size={13} /> Réaliser
                              </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* ── Étape normale ── */
                <>
                  {step.group && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontFamily: "var(--ff-display)", fontSize: 14.5, fontWeight: 500, color: "var(--accent)" }}>
                      <Icon name="layers" size={14} color="var(--accent)" /> {step.group}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div key="head-step" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{realIdx + 1}</div>
                    <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 500 }}>Étape {realIdx + 1}</h2>
                  </div>
                  <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.8, marginBottom: stepDurations.length ? 14 : 24 }}><TechniqueText key={realIdx} text={step.text} index={techIndex} /></p>

                  {stepDurations.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                      {stepDurations.map(d => (
                        <button key={d.minutes} onClick={() => addTimer(d)} className="pressable"
                          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 22, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(232,112,58,0.1)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.35)" }}>
                          <Icon name="clock" size={14} color="var(--accent)" /> Minuteur {d.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {step.tip && <StepTip tip={step.tip} size="lg" style={{ marginBottom: 20 }} />}

                  {linkedIngs.length > 0 && (
                    <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Pour cette étape</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {linkedIngs.map(renderIngLine)}
                      </div>
                    </div>
                  )}

                  {linkedUts.length > 0 && (
                    <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Ustensiles</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {linkedUts.map(u => {
                          const detail = formatParamSummary((utensilDB || []).find(d => d.id === u.dbId)?.appliance, step.utensilParams?.[u.id]);
                          return (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" }} /></div>
                            {u.name}
                            {detail && <span style={{ color: "var(--text3)", fontWeight: 400 }}>{detail}</span>}
                          </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {step.image && (
                    <Img src={step.image} alt={`Étape ${realIdx + 1}`} style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 16, marginBottom: 20 }} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Minuteurs actifs, pile flottante au-dessus de la barre de navigation */}
        {timers.length > 0 && (
          <div style={{ position: "absolute", right: 14, bottom: 78, display: "flex", flexDirection: "column", gap: 8, zIndex: 5, width: 218, maxWidth: "calc(100% - 28px)" }}>
            {timers.map(t => {
              const pct = t.total ? (1 - t.remaining / t.total) * 100 : 0;
              return (
                <div key={t.id} className="slide-up" style={{ background: "var(--surface)", border: `1px solid ${t.done ? "var(--green)" : "var(--border)"}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 8px 22px -10px rgba(0,0,0,0.4)", animation: t.done ? "timerPulse 1s ease-in-out infinite" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="clock" size={15} color={t.done ? "var(--green)" : "var(--accent)"} />
                    <span style={{ flex: 1, fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 700, letterSpacing: "0.02em", color: t.done ? "var(--green)" : "var(--text)" }}>
                      {t.done ? "Terminé !" : fmtCountdown(t.remaining)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>{t.label}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "var(--surface2)", margin: "8px 0", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: t.done ? "var(--green)" : "var(--accent)", transition: "width 0.9s linear" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {t.done
                      ? <button className="timer-btn timer-btn-accent" onClick={() => resetTimer(t.id)}>
                          <Icon name="history" size={14} color="var(--accent)" /> Relancer
                        </button>
                      : <button className="timer-btn" onClick={() => toggleTimer(t.id)}>
                          <Icon name={t.running ? "pause" : "play"} size={14} color="var(--text)" /> {t.running ? "Pause" : "Reprendre"}
                        </button>}
                    <button className="timer-btn timer-btn-stop" onClick={() => removeTimer(t.id)}>
                      <Icon name="stop" size={13} color="var(--red)" /> Stop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-ghost btn-pill" style={{ flex: 1 }} onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0} title="Précédent (flèche ←)">
            <Icon name="back" size={16} /> Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--text3)", minWidth: 60, textAlign: "center" }}>
            {isOverview ? "Aperçu" : isBases ? "Bases" : `${realIdx + 1} / ${realStepCount}`}
          </span>
          {stepIdx < totalSteps - 1
            ? <button className="btn btn-primary btn-pill" style={{ flex: 1 }} onClick={() => setStepIdx(i => i + 1)} disabled={isBases && !allComponentsDone} title="Suivant (flèche →)">Suivant <Icon name="forward" size={16} /></button>
            : <button className="btn btn-primary btn-pill" style={{ flex: 1, background: "var(--green)" }} onClick={() => setDone(true)}><Icon name="check" size={16} /> Terminé !</button>
          }
        </div>
      </div>
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
