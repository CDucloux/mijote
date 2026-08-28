import { Fragment } from "react";
import { Icon } from "../Icon.jsx";
import { Img, IngImage } from "../Img.jsx";
import { IngredientPill, UtensilPill, UtImage } from "../StepPills.jsx";
import { BaseIcon } from "../BaseIcon.jsx";
import { StepTip } from "../StepTip.jsx";
import { GroupHeader } from "./GroupHeader.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { isIngredientInSeason } from "@/lib/food/seasonality.js";
import { groupBy, sectionRuns, hasGroups, looseRunLabel } from "@/lib/recipes/recipeGroups.js";
import { capitalize, fmtQty, pluralizeUnit, pluralizeName } from "../../lib/format.js";

/**
 * Contenu des onglets de la fiche en mobile (Ingrédients / Ustensiles / Étapes). Reçoit
 * les helpers d'affichage via `view` (contexte de rendu), la recette et les contrôles de
 * portions/pas-à-pas. Le rendu suit strictement l'onglet actif.
 */
export function RecipeContentMobile({ recipe, activeTab, view, servings, setServings, bump, setBump, panFactor, setShowCalc, baseSteps, setCookMode }) {
  const { mult, recipesById, getIngImage, getUtImage, getUtDetail, resolveComp, isInStock, seasonResolver, ingredientDB, navigate } = view;
  return (
    <>
      {activeTab === "Ingrédients" && (
        <div style={{ padding: "16px 16px 32px" }}>
          {/* Portions – pilote les quantités de la liste */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Portions</span>
              <button onClick={() => setShowCalc(true)} className="tap" title="Calculatrices (moule, conversions)" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 999, border: "1px solid var(--border)", background: panFactor !== 1 ? "rgba(var(--accent-rgb),0.14)" : "var(--surface2)", color: panFactor !== 1 ? "var(--accent)" : "var(--text2)", cursor: "pointer" }}>
                <Icon name="sparkle" size={13} /> {panFactor !== 1 ? `Moule ×${(Math.round(panFactor * 100) / 100)}` : "Adapter"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setServings(s => Math.max(1, s - 1)); setBump(b => b + 1); }} className="tap tap-stepper" style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", border: "none", cursor: "pointer" }}>
                <svg width="11" height="2" viewBox="0 0 11 2"><rect x="0" y="0" width="11" height="2" rx="1" fill="currentColor"/></svg>
              </button>
              <span key={bump} className="tap-bump" style={{ fontSize: 18, fontWeight: 600, minWidth: 24, textAlign: "center", display: "inline-block" }}>{servings}</span>
              <button onClick={() => { setServings(s => Math.min(24, s + 1)); setBump(b => b + 1); }} className="tap tap-stepper" style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", border: "none", cursor: "pointer" }}>
                <svg width="11" height="11" viewBox="0 0 11 11"><rect x="4.5" y="0" width="2" height="11" rx="1" fill="currentColor"/><rect x="0" y="4.5" width="11" height="2" rx="1" fill="currentColor"/></svg>
              </button>
            </div>
          </div>
          {/* Liste ingrédients – une carte par section (« Pour la pâte »…), lignes
              séparées par un filet. Sans groupe : une seule carte, aucun en-tête. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupBy(recipe.ingredients).map(section => (
          <div key={section.group ?? "__main"}>
            {section.group ? <GroupHeader label={section.group} showIcon style={{ marginBottom: 10 }} /> : (hasGroups(recipe.ingredients) && <GroupHeader label="Autres" style={{ marginBottom: 10 }} />)}
            <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
            {section.items.map((ing, idx) => {
              const rc = resolveComp(ing);
              const isComp = !!rc;
              const last = idx === section.items.length - 1;
              // Sous-titre statut : stock prioritaire, sinon saison.
              const inStock = isInStock(ing);
              const inSeason = !isComp && (() => { const it = seasonResolver(ing.name); return it ? isIngredientInSeason(it) === true : false; })();
              // Statut : « en stock » (BRUN, garde-manger, inclut le bientôt vide,
              // qui reste théoriquement en stock) ou, à défaut, « de saison » (vert).
              let badge = null;
              if (inStock) badge = { text: "en stock", color: "var(--stock)", icon: "box" };
              else if (inSeason) badge = { text: "de saison", color: "var(--green)", icon: "sun" };

              const name = isComp ? (rc.comp ? rc.comp.name : (ing.name || "Base")) : ing.name;
              // `dbId` figé à l'enregistrement peut être vide pour un ingrédient
              // reconnu après coup → on le résout par nom pour rendre la ligne
              // cliquable (accès au détail sans passer par « Modifier »).
              const effDbId = isComp ? "" : (ing.dbId || findIngredientMatch(ing.name, ingredientDB)?.id || "");
              const clickable = isComp ? !!rc.comp : !!effDbId;
              const onClick = () => {
                if (isComp && rc.comp) navigate(`/recipes/${rc.comp.id}`, { state: { from: recipe.id } });
                else if (!isComp && effDbId) navigate(`/admin/ingredients/${encodeURIComponent(effDbId)}`);
              };
              return (
                <div key={ing.id} onClick={onClick} onPointerDown={clickable ? spawnRipple : undefined} className={clickable ? "tap-row" : undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: idx === 0 ? "none" : "1px solid var(--border)", cursor: clickable ? "pointer" : "default", borderBottomLeftRadius: last ? 16 : 0, borderBottomRightRadius: last ? 16 : 0 }}>
                  <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
                    {isComp && !rc.comp?.image
                      ? <span style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><BaseIcon size={22} /></span>
                      : <IngImage src={isComp ? rc.comp.image : getIngImage(ing.dbId, ing.name)} alt={name} size={46} cover={isComp} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(!isComp && !ing.unit ? pluralizeName(ing.amount * mult, name) : name)}</span>
                      {isComp && <span style={{ fontSize: 9.5, fontWeight: 600, color: rc.missing ? "var(--red)" : "var(--accent)", letterSpacing: "0.04em", flexShrink: 0 }}>{rc.missing ? "⚠ SUPPRIMÉE" : "BASE"}</span>}
                    </div>
                    {badge && <div style={{ fontSize: 12, fontWeight: 600, color: badge.color, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Icon name={badge.icon} size={12} color={badge.color} />{badge.text}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>{fmtQty(ing.amount * mult, ing.unit)}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>{pluralizeUnit(ing.amount * mult, ing.unit)}</span>
                  </div>
                  {clickable && <span className="tap-chevron" style={{ display: "flex", flexShrink: 0 }}><Icon name="forward" size={14} color="var(--text3)" /></span>}
                </div>
              );
            })}
            </div>
          </div>
          ))}
          </div>
        </div>
      )}
      {activeTab === "Ustensiles" && (
        <div style={{ padding: "16px 16px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(recipe.utensils || []).map(u => (
              <div key={u.id} className="tap tap-soft" style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 8 }}>
                <UtImage src={getUtImage(u.dbId, u.name)} alt={u.name} size={56} radius={12} />
                <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{u.name}</span>
              </div>
            ))}
            {(!recipe.utensils || recipe.utensils.length === 0) && <p style={{ color: "var(--text3)", fontSize: 14, gridColumn: "1/-1" }}>Aucun ustensile.</p>}
          </div>
        </div>
      )}
      {activeTab === "Étapes" && (
        <div style={{ padding: "16px 16px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {recipe.steps && recipe.steps.length > 0 && (
              <button className="btn btn-primary" style={{ width: "100%", borderRadius: 14, padding: "13px 18px", fontSize: 15, fontWeight: 600, gap: 10 }} onClick={() => setCookMode(true)}>
                <Icon name="fire" size={17} /> Mode pas à pas
              </button>
            )}
            {baseSteps.map(comp => (
              <div key={comp.id} style={{ background: "rgba(var(--accent-rgb),0.05)", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <BaseIcon size={18} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Préparer la {comp.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.04em" }}>BASE</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {comp.steps.map((cstep, ci) => {
                    const cIngs = (comp.ingredients || []).filter(ing => cstep.ingredients?.includes(ing.id));
                    const cUts = (comp.utensils || []).filter(u => cstep.utensils?.includes(u.id));
                    return (
                    <div key={cstep.id}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Étape {ci + 1}</span>
                      {cstep.text && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, margin: "4px 0 0", wordBreak: "break-word", overflowWrap: "break-word" }}>{cstep.text}</p>}
                      {(cIngs.length > 0 || cUts.length > 0) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                          {cIngs.map(ing => (
                            <IngredientPill key={ing.id}
                              image={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)}
                              name={ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name}
                              amount={ing.amount} unit={ing.unit} cover={!!ing.recipeId} />
                          ))}
                          {cUts.map(u => (
                            <UtensilPill key={u.id} image={getUtImage(u.dbId, u.name)} name={u.name} detail={getUtDetail(u, cstep)} />
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {baseSteps.length > 0 && recipe.steps?.length > 0 && (
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)", marginTop: 4 }}>Montage de la recette</div>
            )}
            {(() => { const runs = sectionRuns(recipe.steps || []); const hs = hasGroups(recipe.steps); return runs.map((run, ri) => {
            const hdr = looseRunLabel(run, ri === runs.length - 1, hs);
            return (
            <Fragment key={run.start}>
            {hdr && <GroupHeader label={hdr} showIcon={!!run.group} />}
            {run.items.map((step, j) => {
              const num = run.start + j + 1;
              const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
              const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
              const hasPills = linkedIngs.length > 0 || linkedUts.length > 0;
              return (
                <div key={step.id} className="tap tap-soft" style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (step.text || step.image || step.tip || hasPills) ? 8 : 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{num}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>Étape {num}</span>
                  </div>
                  {step.text && (
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: (step.tip || hasPills || step.image) ? 10 : 0, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>
                  )}
                  {step.tip && <StepTip tip={step.tip} style={{ marginBottom: (hasPills || step.image) ? 10 : 0 }} />}
                  {hasPills && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: step.image ? 10 : 0 }}>
                      {linkedIngs.map(ing => (
                        <IngredientPill key={ing.id}
                          image={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)}
                          name={ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name}
                          amount={ing.amount * mult} unit={ing.unit} cover={!!ing.recipeId} />
                      ))}
                      {linkedUts.map(u => (
                        <UtensilPill key={u.id} image={getUtImage(u.dbId, u.name)} name={u.name} detail={getUtDetail(u, step)} />
                      ))}
                    </div>
                  )}
                  {step.image && (
                    <Img src={step.image} alt={`Étape ${num}`} style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />
                  )}
                </div>
              );
            })}
            </Fragment>
            );
            });
            })()}
          </div>
        </div>
      )}
    </>
  );
}
