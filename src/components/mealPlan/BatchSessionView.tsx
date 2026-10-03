import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";
import type { IconName } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { fmtQtyUnit } from "@/lib/format.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { DEFAULT_CATEGORIES } from "../../constants/categories.js";
import type { useMealBatchSession } from "../../hooks/useMealBatchSession.js";

// Formes dérivées du hook de session batch (frontière hook -> vue).
type BatchSession = ReturnType<typeof useMealBatchSession>;

// En-tête de section : pastille icône + titre (+ sous-titre optionnel).
function SecHead({ icon, title, sub }: { icon: IconName; title: string; sub?: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={icon} size={15} color="var(--text2)" /></span>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</span>
      </div>
      {sub && <p style={{ fontSize: 11.5, color: "var(--text3)", margin: "7px 0 0", lineHeight: 1.45, paddingLeft: 37 }}>{sub}</p>}
    </div>
  );
}

/**
 * Panneau plein écran de la session batch (route /meal-plan/batch) : récapitulatif,
 * mise en place mutualisée (avec checklist locale), cuissons regroupées, bases à
 * préparer d'avance et plats à cuisiner. Toutes les données sont dérivées en amont
 * (useMealBatchSession) ; ce composant ne fait que présenter et cocher.
 *
 * La checklist est un état LOCAL : monté à l'ouverture (réinitialisé), et remonté au
 * changement de semaine via une `key` posée par le parent → repart toujours vierge.
 */
interface BatchSessionViewProps {
  weekLabel: string;
  batch: BatchSession["batch"];
  miseEnPlace: BatchSession["miseEnPlace"];
  cookingGroups: BatchSession["cookingGroups"];
  decoupeByName: BatchSession["decoupeByName"];
  prepCount: number;
  cookCount: number;
  mealOccasions: number;
  onClose: () => void;
  onSelectRecipe: (recipeId: string) => void;
}

export function BatchSessionView({ weekLabel, batch, miseEnPlace, cookingGroups, decoupeByName, prepCount, cookCount, mealOccasions, onClose, onSelectRecipe }: BatchSessionViewProps) {
  const [checkedPrep, setCheckedPrep] = useState<Set<string>>(() => new Set());
  const togglePrep = useCallback((key: string) => setCheckedPrep(prev => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s; }), []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 450, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "cookModeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
      {/* En-tête de page */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        <button onClick={onClose} className="cook-close-btn" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="back" size={16} /></button>
        <span style={{ width: 34, height: 34, borderRadius: 11, background: "rgba(var(--ok-rgb),0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="fire" size={18} color="var(--ok)" /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15 }}>Session batch</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>{weekLabel}</div>
        </div>
      </div>
      {/* Contenu défilant */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "18px 20px 48px" }}>
          <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 18px" }}>Tout préparer d'un coup pour la semaine : on mutualise la découpe des ingrédients et les cuissons.</p>

      {batch.dishes.length === 0
        ? (
          <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--surface2)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Icon name="dish" size={24} color="var(--text3)" /></div>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Planifie des repas cette semaine<br />pour préparer ta session batch.</p>
          </div>
        )
        : <>
          {/* Récap de session : tuiles blanches */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 22 }}>
            {[
              { n: prepCount, l: prepCount > 1 ? "ingrédients" : "ingrédient", icon: "knife" },
              { n: cookCount, l: cookCount > 1 ? "cuissons" : "cuisson", icon: "fire" },
              { n: mealOccasions, l: mealOccasions > 1 ? "repas" : "repas", icon: "dish" },
            ].map((c, i) => (
              <div key={i} style={{ padding: "13px 8px", background: "var(--surface)", borderRadius: 15, border: "1px solid var(--border)", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "grid", placeItems: "center", marginBottom: 4 }}><Icon name={c.icon as IconName} size={16} color="var(--text3)" /></div>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 23, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{c.n}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>{c.l}</div>
              </div>
            ))}
          </div>

          {/* ── 1. Mise en place mutualisée (par ingrédient) ── */}
          {miseEnPlace.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SecHead icon="knife" title="Mise en place" sub="Prépare tous ces ingrédients d'un coup, toutes recettes confondues." />
              {miseEnPlace.map(group => {
                const cat = (DEFAULT_CATEGORIES as Record<string, { label: string; icon: string }>)[group.category] || { label: "Autres", icon: "📦" };
                return (
                  <div key={group.category} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 13 }}>{cat.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.label}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {group.items.map(it => {
                        const done = checkedPrep.has(it.key);
                        const qty = it.unit ? fmtQtyUnit(it.amount, it.unit) : `${it.amount}`;
                        // Geste(s) de découpe tirés des recettes de la semaine ; repli sur le
                        // conseil générique de l'ingrédient si aucune découpe n'est notée.
                        const cuts = decoupeByName.get(normalizeStr(it.name));
                        const geste = cuts && cuts.size ? [...cuts].join(" · ") : null;
                        const nbRecettes = it.usedBy.length > 1 ? `pour ${it.usedBy.length} recettes` : "";
                        return (
                          <button key={it.key} onClick={() => togglePrep(it.key)} className="pressable" style={{
                            display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer",
                            padding: "10px 12px", borderRadius: 13, background: done ? "rgba(var(--ok-rgb),0.07)" : "var(--surface)",
                            border: `1px solid ${done ? "rgba(var(--ok-rgb),0.35)" : "var(--border)"}`, boxShadow: done ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                          }}>
                            <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center", border: `2px solid ${done ? "var(--ok)" : "var(--border)"}`, background: done ? "var(--ok)" : "transparent", transition: "background 0.15s, border-color 0.15s" }}>
                              {done && <Icon name="check" size={13} color="#fff" />}
                            </span>
                            {it.image && <span style={{ width: 30, height: 30, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: "#fff", border: "1px solid var(--border)" }}><Img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} /></span>}
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>{it.name}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{qty}{it.pieces ? ` · ~${it.pieces}` : ""}</span>
                              </span>
                              {geste ? (
                                <span style={{ display: "block", fontSize: 11, marginTop: 3 }}>
                                  <span style={{ fontWeight: 600, color: "var(--text2)" }}>{geste}</span>
                                  {nbRecettes && <span style={{ color: "var(--text3)" }}> · {nbRecettes}</span>}
                                </span>
                              ) : (it.prepTip || nbRecettes) ? (
                                <span style={{ display: "block", fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
                                  {it.prepTip ? it.prepTip : ""}{it.prepTip && nbRecettes ? " · " : ""}{nbRecettes}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 2. Cuissons regroupées (mutualiser le four / les feux) ── */}
          {cookingGroups.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SecHead icon="fire" title="Cuissons à mutualiser" sub="Ces plats partagent le même appareil, lance-les ensemble." />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cookingGroups.map(g => (
                  <div key={g.method} style={{ padding: "12px 14px", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(var(--accent-rgb),0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="fire" size={14} color="var(--accent)" /></span>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.label}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "var(--text3)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 999 }}>{g.dishes.length} plats</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text2)", paddingLeft: 34, lineHeight: 1.45 }}>{g.dishes.map(d => d.recipe.name).join(" · ")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Préparations de base à faire d'avance ── */}
          {batch.bases.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SecHead icon="layers" title="À préparer d'avance" sub="Les bases partagées entre plusieurs plats." />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {batch.bases.map(b => (
                  <button key={b.recipe.id} onClick={() => { onSelectRecipe(b.recipe.id); }} className="complete-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: b.shared ? "rgba(var(--ok-rgb),0.07)" : "var(--surface)", borderRadius: 14, border: `1px solid ${b.shared ? "rgba(var(--ok-rgb),0.35)" : "var(--border)"}`, cursor: "pointer", textAlign: "left", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.recipe.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Pour {b.usedBy.join(", ")}</div>
                    </div>
                    {b.shared && <span style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ok)", background: "rgba(var(--ok-rgb),0.16)", padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>Partagé</span>}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>{b.amount} {b.unit}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Plats à cuisiner ── */}
          <SecHead icon="dish" title="À cuisiner" sub={null} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {batch.dishes.map(d => (
              <button key={d.recipe.id} onClick={() => { onSelectRecipe(d.recipe.id); }} className="complete-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={(d.recipe as { image?: string }).image} alt={d.recipe.name} style={{ width: "100%", height: "100%" }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{d.recipe.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{d.meals} repas</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.1)", borderRadius: 6, padding: "2px 7px" }}>{d.cookings} cuisson{d.cookings > 1 ? "s" : ""}</span>
                    <span style={{ fontSize: 10.5, color: "var(--text3)", padding: "2px 0" }}>{d.servings} portions</span>
                  </div>
                </div>
                <span className="complete-add" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface2)", color: "var(--text3)" }}><Icon name="forward" size={15} color="currentColor" /></span>
              </button>
            ))}
          </div>
        </>}
        </div>
      </div>
    </div>
  );
}
