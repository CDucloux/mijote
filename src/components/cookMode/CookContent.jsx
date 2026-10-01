import { Icon } from "../ui/Icon.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { Img, IngImage } from "../ui/Img.jsx";
import { StepTip } from "../recipe/StepTip.jsx";
import { TechniqueText } from "../recipe/TechniqueText.jsx";
import { ConvertBadge } from "../ingredient/QuantityConvertSheet.jsx";
import { PrecautionInfoBadge } from "../recipe/QualityHints.jsx";
import { ToggleSwitch } from "./ToggleSwitch.jsx";
import { capitalize, fmtQtyUnit } from "@/lib/format.js";
import { posteLabel } from "@/lib/recipes/decoupe.js";
import { formatParamSummary } from "@/lib/utensils/appliances.js";

/**
 * Corps du pas à pas : rend la page courante du cook mode selon son type,
 * « mise en place » (ingrédients cochables regroupables par rayon, ustensiles,
 * découpe), « bases » (préparations à réaliser d'abord), ou une étape réelle
 * (consigne, minuteurs, ingrédients/ustensiles liés). Purement présentationnel :
 * tout l'état et les actions sont fournis par le parent.
 */
export function CookContent(props) {
  const {
    isOverview, isBases, step, realIdx, stepIdx,
    overviewIngs, overviewUts, overviewIngGroups, postesDecoupe,
    groupByCategory, setGroupByCategory,
    checkedIngIds, checkedUtIds, checkedCutKeys,
    toggleIngChecked, toggleUtChecked, toggleCutChecked,
    getIngImage, getUtImage, getUtPrecaution, convOf, openConvert, displayQty,
    recipesById, recipe, mult,
    pendingComponents, doneComponents, setSubCook,
    stepDurations, addTimer, techIndex, linkedIngs, linkedUts,
    utensilDB, setPrecSheet, posteStepByKey, goToStep,
  } = props;

  // Rendu d'une ligne ingrédient : brute ou composant
  const renderIngLine = (ing) => {
    const isComp = !!ing.recipeId && !ing.dbId;
    const comp = isComp && recipesById ? recipesById.get(ing.recipeId) : null;
    const displayName = isComp ? (comp?.name || ing.name || "Préparation introuvable") : ing.name;
    const imgSrc = isComp ? (comp?.image || "") : getIngImage(ing.dbId, ing.name);
    return (
      <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isComp
          ? <span style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(var(--accent-rgb),0.1)", border: "1.5px solid rgba(var(--accent-rgb),0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={22} /></span>
          : <IngImage src={imgSrc} alt={displayName} size={42} />
        }
        <span style={{ flex: 1, fontSize: 14, color: isComp ? "var(--accent)" : "var(--text)", fontWeight: isComp ? 600 : 400 }}>{capitalize(displayName)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: isComp ? "var(--accent)" : "var(--accent)" }}>
          {displayQty(ing, ing.amount * (mult || 1))}
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
    const amount = ing.amount * (mult || 1);
    // Rangée = <div role="button"> (et non <button>) car elle contient le badge de
    // conversion, lui-même bouton : deux boutons imbriqués seraient du HTML invalide.
    const toggle = () => toggleIngChecked(ing.id);
    return (
      <div key={ing.id} role="button" tabIndex={0} onClick={toggle}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className="pressable"
        // padding + margin qui s'annulent : la boîte de rognage (overflow:hidden posé
        // sur `.pressable` au tactile pour borner l'onde) s'élargit de 8px sans rien
        // déplacer, pour ne plus couper le ConvertBadge (débord + ombre) en bas à droite.
        style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", borderRadius: 10, padding: 8, margin: -8 }}>
        <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center", border: `2px solid ${gathered ? "var(--ok)" : "var(--border)"}`, background: gathered ? "var(--ok)" : "transparent", transition: "background 0.15s, border-color 0.15s" }}>
          {gathered && <Icon name="check" size={13} color="#fff" />}
        </span>
        <span style={{ position: "relative", flexShrink: 0, display: "inline-flex", opacity: gathered ? 0.5 : 1, transition: "opacity 0.15s" }}>
          {isComp
            ? <span style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(var(--accent-rgb),0.1)", border: "1.5px solid rgba(var(--accent-rgb),0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><BaseIcon size={22} /></span>
            : <IngImage src={imgSrc} alt={displayName} size={42} />
          }
          {!isComp && !gathered && convOf(ing, amount) && <ConvertBadge onClick={() => openConvert(ing, amount)} size={18} />}
        </span>
        {/* Barré PROGRESSIF (comme la page Courses) : un trait qui se trace de 0 à 100%
            sur le nom, plutôt qu'un line-through instantané non animable. */}
        <span style={{ flex: 1, minWidth: 0, display: "flex" }}>
          <span style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <span style={{ display: "block", fontSize: 14, color: isComp ? "var(--accent)" : "var(--text)", fontWeight: isComp ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: gathered ? 0.55 : 1, transition: "opacity 0.28s ease" }}>{capitalize(displayName)}</span>
            <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", height: 1.5, background: isComp ? "var(--accent)" : "var(--text3)", width: gathered ? "100%" : "0%", transition: "width 0.28s ease" }} />
          </span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", opacity: gathered ? 0.55 : 1, transition: "opacity 0.28s ease" }}>
          {displayQty(ing, amount)}
        </span>
      </div>
    );
  };

  // Rendu d'un poste de découpe COCHABLE : geste impératif + quantité (« Émincer :
  // 3 oignons »), même rangée cliquable que les ingrédients.
  const renderPosteRow = (poste) => {
    const done = checkedCutKeys.has(poste.key);
    const toggle = () => toggleCutChecked(poste.key);
    // Image de l'ingrédient concerné, comme dans la mise en place « Ingrédients » :
    // dbId résolu depuis la première ligne du groupe (repli sur le nom du poste).
    const firstId = poste.ingredientIds[0];
    const line = firstId ? (recipe.ingredients || []).find(i => i.id === firstId) : null;
    const imgSrc = getIngImage(line?.dbId, poste.name);
    // Étape où cette découpe a été détectée : chip de navigation pour lever un doute
    // de classification. `stopPropagation` : cliquer le chip ne coche pas le poste.
    const srcStepIdx = posteStepByKey.get(poste.key) ?? -1;
    return (
      <div key={poste.key} role="button" tabIndex={0} onClick={toggle}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className="pressable"
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer", borderRadius: 10 }}>
        <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center", border: `2px solid ${done ? "var(--ok)" : "var(--border)"}`, background: done ? "var(--ok)" : "transparent", transition: "background 0.15s, border-color 0.15s" }}>
          {done && <Icon name="check" size={13} color="#fff" />}
        </span>
        <span style={{ flexShrink: 0, display: "inline-flex", opacity: done ? 0.5 : 1, transition: "opacity 0.15s" }}>
          <IngImage src={imgSrc} alt={poste.name} size={42} />
        </span>
        {/* Barré progressif identique aux ingrédients (cohérence avec la page Courses). */}
        <span style={{ flex: 1, minWidth: 0, display: "flex" }}>
          <span style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <span style={{ display: "block", fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: done ? 0.55 : 1, transition: "opacity 0.28s ease" }}>{posteLabel(poste)}</span>
            <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", height: 1.5, background: "var(--text3)", width: done ? "100%" : "0%", transition: "width 0.28s ease" }} />
          </span>
        </span>
        {srcStepIdx >= 0 && (
          <button type="button" title="Voir l'étape d'origine de cette découpe"
            onClick={e => { e.stopPropagation(); goToStep(srcStepIdx); }}
            className="pressable cook-step-link"
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "var(--accent)", border: "none", borderRadius: 999, padding: "4px 9px 4px 10px", cursor: "pointer", opacity: done ? 0.55 : 1, transition: "opacity 0.15s, background-color 0.15s" }}>
            Étape {srcStepIdx + 1}
            <Icon name="forward" size={12} color="var(--accent)" />
          </button>
        )}
      </div>
    );
  };

  if (isOverview) {
    /* ── Aperçu (mise en place) : tous les ingrédients + ustensiles ── */
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div key="head-overview" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="fileText" size={19} color="#fff" /></div>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600 }}>Mise en place</h2>
        </div>
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>
          Rassemble tous les ingrédients aux bonnes quantités et sors les ustensiles nécessaires avant de te lancer.
        </p>
        {overviewIngs.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ingrédients</span>
              {checkedIngIds.size > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ok)", background: "rgba(var(--ok-rgb),0.12)", borderRadius: 999, padding: "1px 8px" }}>
                  {checkedIngIds.size}/{overviewIngs.length}
                </span>
              )}
              <ToggleSwitch checked={groupByCategory} onChange={() => setGroupByCategory(v => !v)} label="Catégories"
                title={groupByCategory ? "Afficher en liste" : "Regrouper par catégorie"} />
            </div>
            {groupByCategory ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {overviewIngGroups.map(g => (
                  <div key={g.key} style={{ paddingLeft: 8 }}>
                    {/* Décalage + ↳ : la catégorie se lit comme une sous-branche des « Ingrédients ». */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 1, flexShrink: 0 }}>
                        <polyline points="15 10 20 15 15 20" />
                        <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                      </svg>
                      <span style={{ fontSize: 13 }}>{g.icon}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{g.label}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 14 }}>
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
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ok)", background: "rgba(var(--ok-rgb),0.12)", borderRadius: 999, padding: "1px 8px" }}>
                  {checkedUtIds.size}/{overviewUts.length}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {overviewUts.map(u => {
                const gathered = checkedUtIds.has(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleUtChecked(u.id)} className="pressable"
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: gathered ? "rgba(var(--ok-rgb),0.12)" : "var(--surface2)", border: `1px solid ${gathered ? "rgba(var(--ok-rgb),0.35)" : "transparent"}`, borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: gathered ? "var(--ok)" : "var(--text)", cursor: "pointer", textDecoration: gathered ? "line-through" : "none" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0, opacity: gathered ? 0.6 : 1 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" }} /></div>
                    {gathered && <Icon name="check" size={11} color="var(--ok)" />}
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {postesDecoupe.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
            {/* Hauteur fixe : le badge (1/1) apparaît au cochage sans réhausser
                l'en-tête ; marge alignée sur la carte « Ingrédients ». */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 18, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Découpe</span>
              {checkedCutKeys.size > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ok)", background: "rgba(var(--ok-rgb),0.12)", borderRadius: 999, padding: "1px 8px" }}>
                  {checkedCutKeys.size}/{postesDecoupe.length}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {postesDecoupe.map(renderPosteRow)}
            </div>
          </div>
        )}
      </>
    );
  }

  if (isBases) {
    /* ── Bases : préparations de base à réaliser ── */
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div key="head-bases" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={20} color="#fff" /></div>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600 }}>Bases</h2>
        </div>
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.7, marginBottom: 24 }}>
          Réalise ces préparations de base avant de commencer la recette principale.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pendingComponents.map(({ line, comp, nestedMult }) => (
            <div key={comp.id} style={{ background: "var(--surface)", border: `1.5px solid ${doneComponents.has(comp.id) ? "rgba(var(--ok-rgb),0.45)" : "rgba(var(--accent-rgb),0.3)"}`, borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 14, transition: "border-color 0.25s" }}>
              {comp.image
                ? <Img src={comp.image} alt={comp.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                : <span style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(var(--accent-rgb),0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={28} /></span>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{comp.name}</div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>
                  {fmtQtyUnit(line.amount * (mult || 1), line.unit)}
                  {comp.steps?.length ? ` · ${comp.steps.length} étape${comp.steps.length > 1 ? "s" : ""}` : ""}
                </div>
              </div>
              {comp.steps?.length > 0 && (
                doneComponents.has(comp.id)
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "rgba(52,199,89,0.12)", border: "1px solid rgba(52,199,89,0.35)", color: "var(--ok)", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                      <Icon name="check" size={13} color="var(--ok)" /> Terminé
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
    );
  }

  /* ── Étape normale ── */
  return (
    <>
      {step.group && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontFamily: "var(--ff-display)", fontSize: 14.5, fontWeight: 700, color: "var(--accent)" }}>
          <Icon name="layers" size={14} color="var(--accent)" /> {step.group}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div key="head-step" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{realIdx + 1}</div>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600 }}>Étape {realIdx + 1}</h2>
      </div>
      <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.8, marginBottom: stepDurations.length ? 14 : 24 }}><TechniqueText key={realIdx} text={step.text} index={techIndex} /></p>

      {stepDurations.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {stepDurations.map(d => (
            <button key={d.minutes} onClick={() => addTimer(d, stepIdx, realIdx >= 0 ? `Étape ${realIdx + 1}` : isOverview ? "Mise en place" : "Bases")} className="pressable cook-timer-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 22, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--spice)" }}>
              <Icon name="clock" size={14} color="var(--spice)" /> Minuteur {d.label}
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
              const prec = getUtPrecaution(u);
              return (
              <span key={u.id} onClick={prec ? () => setPrecSheet({ name: u.name, prec }) : undefined} className={prec ? "pressable" : undefined} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: prec ? "5px 30px 5px 5px" : "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)", cursor: prec ? "pointer" : "default" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" }} /></div>
                {u.name}
                {detail && <span style={{ color: "var(--text3)", fontWeight: 400 }}>{detail}</span>}
                {prec && <PrecautionInfoBadge tone={prec.tone} style={{ top: "50%", right: 6, transform: "translateY(-50%)", width: 20, height: 20 }} />}
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
  );
}
