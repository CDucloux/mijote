import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon.jsx";
import { parseDurations, fmtCountdown } from "../lib/stepTimers.js";
import { StepTip } from "../components/StepTip.jsx";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { TechniqueText } from "../components/TechniqueText.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildTechniqueIndex } from "../lib/techniques.js";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { normalizeStr } from "../lib/parseIngredient.js";
import { consumptionFraction } from "../lib/recipeComponents.js";
import { capitalize, fmtQtyUnit } from "../lib/format.js";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea.jsx";
import { RatingPicker } from "../components/RatingPicker.jsx";
import { addVersion, nextVersionLabel } from "../lib/history.js";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";

// ─── COOK MODE ────────────────────────────────────────────────────────────────
// `recipes` + `stockSet` permettent de gérer les composants (préparations de base) :
// - étape 0 : liste des composants épuisés à réaliser avant de commencer ;
// - dans chaque step : les lignes composant s'affichent avec 🧈 (pas d'image dbId).
// - bouton « Réaliser » → CookMode imbriqué sur le composant mis à l'échelle.

function CookModeInner({ recipe, mult, ingredientDB, utensilDB, onClose, recipesById, stockSet, onUpdateRecipe, isNested = false }) {
  const { techniques, notify } = useAppShell();
  const techIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [subCook, setSubCook] = useState(null); // { recipe, mult }
  const [doneComponents, setDoneComponents] = useState(new Set());
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
    onClose();
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

  // Étapes effectives : étape 0 virtuelle (composants à préparer) + étapes réelles
  const STEP_ZERO = pendingComponents.length > 0;
  const realStepCount = (recipe.steps || []).length;
  const totalSteps = (STEP_ZERO ? 1 : 0) + realStepCount;
  const isStepZero = STEP_ZERO && stepIdx === 0;
  const realIdx = STEP_ZERO ? stepIdx - 1 : stepIdx;
  const step = isStepZero ? null : (recipe.steps || [])[realIdx];

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
        notify?.(`Minuteur terminé — ${t.label}`);
      }
    }
  }, [timers, notify]);

  // Navigation au clavier (desktop) : ← précédent, → suivant (ou terminer).
  useEffect(() => {
    if (subCook || done || iterOpen) return;
    const onKey = (e) => {
      if (e.defaultPrevented || e.target?.closest?.("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowRight") {
        if (stepIdx < totalSteps - 1) { if (!(isStepZero && !allComponentsDone)) setStepIdx(i => i + 1); }
        else setDone(true);
      } else if (e.key === "ArrowLeft") {
        setStepIdx(i => Math.max(0, i - 1));
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subCook, done, iterOpen, stepIdx, totalSteps, isStepZero, allComponentsDone]);

  const stepDurations = useMemo(() => (step ? parseDurations(step.text) : []), [step]);

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

  return createPortal(
    <>
      {/* CookMode imbriqué pour un composant */}
      {subCook && (
        <CookModeInner
          recipe={subCook.recipe}
          mult={subCook.mult}
          ingredientDB={ingredientDB}
          utensilDB={utensilDB}
          recipesById={recipesById}
          stockSet={stockSet}
          isNested
          onClose={() => { setDoneComponents(prev => new Set([...prev, subCook.recipe.id])); setSubCook(null); }}
        />
      )}

      {done && !subCook && (
        <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 601 : 501, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "cookModeIn 0.4s ease", padding: 32, textAlign: "center" }}>
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
              ? <>Votre <strong style={{ color: "var(--text)" }}>{recipe.name}</strong> est prêt·e. Revenez à la recette principale.</>
              : <>Votre <strong style={{ color: "var(--text)" }}>{recipe.name}</strong> est prêt·e !</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320, animation: "popIn 0.5s 0.5s both ease" }}>
            {canIterate && (
              <button className="btn btn-ghost" style={{ padding: "13px 24px", fontSize: 15, borderRadius: 16 }} onClick={() => { setIterRating(null); setIterNotes(""); setIterOpen(true); }}>
                <Icon name="sparkle" size={17} /> Noter une itération
              </button>
            )}
            <button className="btn btn-primary" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 16 }} onClick={onClose}>
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

      <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 600 : 500, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "cookModeIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={isNested ? "back" : "close"} size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {isNested && <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><BaseIcon size={14} /></span>}
              {recipe.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              {isStepZero ? "Bases" : `Étape ${stepIdx + (STEP_ZERO ? 0 : 1)} / ${realStepCount}`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--surface2)", flexShrink: 0 }}>
          <div style={{ height: "100%", background: isNested ? "var(--accent)" : "var(--accent)", width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Desktop sidebar */}
          <div className="cook-mode-sidebar" style={{ display: "none", width: 260, minWidth: 260, overflowY: "auto", borderRight: "1px solid var(--border)", padding: "12px 0" }}>
            {STEP_ZERO && (
              <button onClick={() => setStepIdx(0)}
                style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", background: stepIdx === 0 ? "rgba(232,112,58,0.1)" : "none", borderLeft: `3px solid ${stepIdx === 0 ? "var(--accent)" : "transparent"}`, textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: stepIdx === 0 ? "var(--accent)" : stepIdx > 0 ? "var(--green)" : "var(--surface2)", color: stepIdx >= 0 ? "#fff" : "var(--text3)" }}>
                  {stepIdx > 0 ? <Icon name="check" size={11} color="#fff" /> : <BaseIcon size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: stepIdx === 0 ? "var(--accent)" : "var(--text3)", fontWeight: stepIdx === 0 ? 600 : 400, lineHeight: 1.4 }}>Bases</span>
              </button>
            )}
            {(recipe.steps || []).map((s, i) => {
              const sIdx = i + (STEP_ZERO ? 1 : 0);
              return (
                <button key={s.id} onClick={() => setStepIdx(sIdx)}
                  style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", background: sIdx === stepIdx ? "rgba(232,112,58,0.1)" : "none", borderLeft: `3px solid ${sIdx === stepIdx ? "var(--accent)" : "transparent"}`, textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: sIdx < stepIdx ? "var(--green)" : sIdx === stepIdx ? "var(--accent)" : "var(--surface2)", color: sIdx <= stepIdx ? "#fff" : "var(--text3)" }}>
                    {sIdx < stepIdx ? <Icon name="check" size={11} color="#fff" /> : i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: sIdx === stepIdx ? "var(--accent)" : sIdx < stepIdx ? "var(--text3)" : "var(--text2)", fontWeight: sIdx === stepIdx ? 600 : 400, lineHeight: 1.4 }}>{`Étape ${i + 1}`}</span>
                </button>
              );
            })}
          </div>

          {/* Step content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              {isStepZero ? (
                /* ── Étape 0 : préparations de base à réaliser ── */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={20} color="#fff" /></div>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{realIdx + 1}</div>
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
                        {linkedUts.map(u => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" }} /></div>
                            {u.name}
                          </span>
                        ))}
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

        {/* Minuteurs actifs — pile flottante au-dessus de la barre de navigation */}
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
                  <div style={{ display: "flex", gap: 6 }}>
                    {t.done
                      ? <button className="btn btn-sm" style={{ flex: 1, padding: "5px 0", fontSize: 12, background: "rgba(232,112,58,0.12)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.3)" }} onClick={() => resetTimer(t.id)}><Icon name="history" size={12} color="var(--accent)" /> Relancer</button>
                      : <button className="btn btn-sm" style={{ flex: 1, padding: "5px 0", fontSize: 12, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }} onClick={() => toggleTimer(t.id)}>{t.running ? "Pause" : "Reprendre"}</button>}
                    <button aria-label="Fermer le minuteur" style={{ flexShrink: 0, width: 30, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => removeTimer(t.id)}><Icon name="close" size={13} color="var(--text3)" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0} title="Précédent (flèche ←)">
            <Icon name="back" size={16} /> Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--text3)", minWidth: 60, textAlign: "center" }}>
            {isStepZero ? "Bases" : `${realIdx + 1} / ${realStepCount}`}
          </span>
          {stepIdx < totalSteps - 1
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStepIdx(i => i + 1)} disabled={isStepZero && !allComponentsDone} title="Suivant (flèche →)">Suivant <Icon name="forward" size={16} /></button>
            : <button className="btn btn-primary" style={{ flex: 1, background: "var(--green)" }} onClick={() => setDone(true)}><Icon name="check" size={16} /> Terminé !</button>
          }
        </div>
      </div>
    </>,
    document.body
  );
}

export function CookMode({ recipe, mult, ingredientDB, utensilDB, onClose, recipes = [], stockSet, onUpdateRecipe }) {
  const recipesById = useMemo(() => new Map((recipes || []).map(r => [r.id, r])), [recipes]);
  return (
    <CookModeInner
      recipe={recipe}
      mult={mult}
      ingredientDB={ingredientDB}
      utensilDB={utensilDB}
      onClose={onClose}
      recipesById={recipesById}
      stockSet={stockSet}
      onUpdateRecipe={onUpdateRecipe}
    />
  );
}
