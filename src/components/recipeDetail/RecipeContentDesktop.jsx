import { Icon } from "../Icon.jsx";
import { Img, IngImage } from "../Img.jsx";
import { UtImage } from "../StepPills.jsx";
import { BaseIcon } from "../BaseIcon.jsx";
import { StepTip } from "../StepTip.jsx";
import { GroupHeader } from "./GroupHeader.jsx";
import { groupBy, sectionRuns, hasGroups, looseRunLabel } from "@/lib/recipes/recipeGroups.js";
import { capitalize, fmtQty, fmtQtyUnit, pluralizeUnit, pluralizeName } from "../../lib/format.js";

/**
 * Contenu de la fiche en desktop : deux colonnes (ingrédients + ustensiles à gauche,
 * étapes en timeline à droite). Masqué en mobile via CSS. Reçoit les helpers d'affichage
 * via `view` (contexte de rendu partagé avec la version mobile).
 */
export function RecipeContentDesktop({ recipe, view, baseSteps, setCookMode }) {
  const { mult, recipesById, getIngImage, getUtImage, resolveComp, navigate } = view;
  return (
    <div className="detail-desktop-content" style={{ display: "none", flex: 1, overflow: "hidden", background: "var(--bg)", padding: "12px 16px 16px", gap: 16 }}>
      {/* Left col: ingrédients + ustensiles (card) */}
      <div style={{ width: 300, minWidth: 300, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", minHeight: 34, marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)" }}>Ingrédients</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groupBy(recipe.ingredients).map(section => (
            <div key={section.group ?? "__main"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {section.group ? <GroupHeader label={section.group} showIcon /> : (hasGroups(recipe.ingredients) && <GroupHeader label="Autres" />)}
            {section.items.map(ing => {
              const rc = resolveComp(ing);
              if (rc) return (
                <div key={ing.id} onClick={() => rc.comp && navigate(`/recipes/${rc.comp.id}`, { state: { from: recipe.id } })} style={{ display: "flex", alignItems: "center", gap: 12, cursor: rc.comp ? "pointer" : "default", borderRadius: 10, padding: "4px 6px", margin: "-4px -6px", transition: "background 0.15s" }} onMouseEnter={e => { if (rc.comp) e.currentTarget.style.background = "var(--surface2)"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                  {rc.comp?.image
                    ? <IngImage src={rc.comp.image} alt={rc.comp.name} size={48} cover />
                    : <span style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><BaseIcon size={22} /></span>}
                  <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>{fmtQty(ing.amount * mult, ing.unit)}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 2 }}>{pluralizeUnit(ing.amount * mult, ing.unit)}</span>
                  </div>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>
                    {capitalize(rc.comp ? rc.comp.name : (ing.name || "Base"))}
                    <span style={{ fontSize: 10, fontWeight: 600, color: rc.missing ? "var(--red)" : "var(--accent)", marginLeft: 6 }}>{rc.missing ? "⚠ SUPPRIMÉE" : "BASE"}</span>
                  </div>
                </div>
              );
              return (
              <div key={ing.id} onClick={() => ing.dbId && navigate(`/admin/ingredients/${encodeURIComponent(ing.dbId)}`)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: ing.dbId ? "pointer" : "default", borderRadius: 10, padding: "4px 6px", margin: "-4px -6px", transition: "background 0.15s" }} onMouseEnter={e => { if (ing.dbId) e.currentTarget.style.background = "var(--surface2)"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
                  <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={48} />
                </span>
                <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>{fmtQty(ing.amount * mult, ing.unit)}</span>
                  <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 2 }}>{pluralizeUnit(ing.amount * mult, ing.unit)}</span>
                </div>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{capitalize(ing.unit ? ing.name : pluralizeName(ing.amount * mult, ing.name))}</div>
              </div>
              );
            })}
            </div>
            ))}
          </div>
        </div>
        {recipe.utensils && recipe.utensils.length > 0 && (
          <div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)", marginBottom: 12 }}>Ustensiles</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recipe.utensils.map(u => (
                <div key={u.id} className="ut-pill-desktop" style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", borderRadius: 12, padding: "7px 14px 7px 8px", border: "1px solid var(--border)" }}>
                  <UtImage src={getUtImage(u.dbId, u.name)} alt={u.name} size={28} radius={7} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      {/* Right col: étapes (card) */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 34, marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)" }}>Étapes</span>
          {recipe.steps && recipe.steps.length > 0 && (
            <button className="btn btn-primary btn-sm" style={{ gap: 7, borderRadius: 999, padding: "8px 18px" }} onClick={() => setCookMode(true)}>
              <Icon name="fire" size={13} /> Mode pas à pas
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {baseSteps.map(comp => (
            <div key={comp.id} style={{ background: "rgba(var(--accent-rgb),0.05)", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <BaseIcon size={18} />
                <span style={{ fontFamily: "var(--ff-display)", fontSize: 16, fontWeight: 600 }}>Préparer la {comp.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.04em" }}>BASE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {comp.steps.map((cstep, ci) => {
                  const cIngs = (comp.ingredients || []).filter(ing => cstep.ingredients?.includes(ing.id));
                  const cUts = (comp.utensils || []).filter(u => cstep.utensils?.includes(u.id));
                  return (
                  <div key={cstep.id}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>Étape {ci + 1}</div>
                    {cstep.text && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 8px", wordBreak: "break-word", overflowWrap: "break-word" }}>{cstep.text}</p>}
                    {(cIngs.length > 0 || cUts.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {cIngs.map(ing => {
                          const displayName = ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name;
                          return (
                          <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <IngImage src={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)} alt={displayName} size={24} cover={!!ing.recipeId} />
                            {displayName}
                            <span style={{ color: "var(--text3)", fontWeight: 500 }}>{fmtQtyUnit(ing.amount, ing.unit)}</span>
                          </span>
                          );
                        })}
                        {cUts.map(u => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <UtImage src={getUtImage(u.dbId, u.name)} alt={u.name} size={24} />
                            {u.name}
                          </span>
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
          <div key={run.start}>
          {hdr && <GroupHeader label={hdr} showIcon={!!run.group} style={{ marginBottom: 18 }} />}
          {run.items.map((step, j) => {
            const num = run.start + j + 1;
            const lastInRun = j === run.items.length - 1;
            const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
            const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
            const hasPills = linkedIngs.length > 0 || linkedUts.length > 0;
            return (
              // Timeline : nœud numéroté (dégradé) relié par un rail vertical, contenu à droite.
              <div key={step.id} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-strong))", color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, boxShadow: "0 3px 8px -2px rgba(var(--accent-rgb),0.5)", flexShrink: 0 }}>{num}</span>
                  {!lastInRun && <span style={{ flex: 1, width: 2, background: "var(--border)", borderRadius: 1, marginTop: 6, minHeight: 10 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 5, paddingBottom: lastInRun ? 2 : 28 }}>
                  {step.text && <p style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.7, margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>}
                  {step.tip && <StepTip tip={step.tip} style={{ marginTop: 12 }} />}
                  {hasPills && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {linkedIngs.map(ing => {
                        const displayName = ing.recipeId ? (recipesById.get(ing.recipeId)?.name || ing.name) : ing.name;
                        return (
                        <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                          <IngImage src={ing.recipeId ? (recipesById.get(ing.recipeId)?.image || "") : getIngImage(ing.dbId, ing.name)} alt={displayName} size={24} cover={!!ing.recipeId} />
                          {displayName}
                          <span style={{ color: "var(--text3)", fontWeight: 500 }}>{fmtQtyUnit(ing.amount * mult, ing.unit)}</span>
                        </span>
                        );
                      })}
                      {linkedUts.map(u => (
                        <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                          <UtImage src={getUtImage(u.dbId, u.name)} alt={u.name} size={24} />
                          {u.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.image && <Img src={step.image} alt={`Étape ${num}`} style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 12, marginTop: 12 }} />}
                </div>
              </div>
            );
          })}
          </div>
          );
          });
          })()}
        </div>
      </div>
    </div>
  );
}
