import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { Donut } from "./Donut.jsx";
import { computeNutriInfo } from "@/lib/recipes/nutriscore.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { ingredientMonths, isIngredientInSeason } from "@/lib/food/seasonality.js";
import { SeasonBar } from "./SeasonBar.jsx";
import { NUTRI_RI, MACRO_COLORS } from "../constants/nutritionDisplay.js";
import { TIP_TYPES, TIP_ORDER } from "../constants/tipTypes.js";

// ─── INGREDIENT DETAIL (fiche aliment) ────────────────────────────────────────
// Page publique /admin/ingredients/{id} : tout utilisateur peut consulter la
// fiche ; seul l'admin dispose des actions Modifier / Supprimer.
export function IngredientDetail({ ingredient, ingredientDB, categories = DEFAULT_CATEGORIES, isAdmin, onBack, onEdit, onDelete }) {
  const [detailOpen, setDetailOpen] = useState(false);
  if (!ingredient) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🥕</div>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>Cet ingrédient n'existe pas (ou plus) dans la base.</p>
        <button className="btn btn-primary" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="back" size={15} color="#fff" /> Retour aux ingrédients</button>
      </div>
    );
  }
  const cat = categories[ingredient.category] || DEFAULT_CATEGORIES.other;
  const n = ingredient.nutrition || {};
  const hasNutrition = !!ingredient.nutrition;
  const { letter } = computeNutriInfo([{ dbId: ingredient.id, amount: 100, unit: "g" }], ingredientDB);
  const kcal = Math.round(n.calories || 0);
  const kj = Math.round((n.calories || 0) * 4.184);
  const aliases = Array.isArray(ingredient.aliases) ? ingredient.aliases : [];

  const macroSegs = [
    { key: "protein", label: "Protéines", color: MACRO_COLORS.protein, value: (n.protein || 0) * 4, grams: n.protein || 0 },
    { key: "carbs", label: "Glucides", color: MACRO_COLORS.carbs, value: (n.carbs || 0) * 4, grams: n.carbs || 0 },
    { key: "fat", label: "Lipides", color: MACRO_COLORS.fat, value: (n.fat || 0) * 9, grams: n.fat || 0 },
  ];
  const macroTot = macroSegs.reduce((s, x) => s + x.value, 0) || 1;
  const fmt = v => v == null ? "–" : `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} g`;
  const riPct = (key, v) => NUTRI_RI[key] ? Math.round((v || 0) / NUTRI_RI[key] * 100) : null;
  const rows = [
    { key: "fat", label: "Lipides", value: n.fat, color: MACRO_COLORS.fat },
    { key: "saturatedFat", label: "dont acides gras saturés", value: n.saturatedFat, sub: true, color: "#c8581f" },
    { key: "omega3", label: "dont oméga-3", value: n.omega3, sub: true, color: "#2f9e6f" },
    { key: "carbs", label: "Glucides", value: n.carbs, color: MACRO_COLORS.carbs },
    { key: "sugar", label: "dont sucres", value: n.sugar, sub: true, color: "#d99a10" },
    { key: "fiber", label: "Fibres", value: n.fiber, color: "#7bb661" },
    { key: "protein", label: "Protéines", value: n.protein, color: MACRO_COLORS.protein },
    { key: "salt", label: "Sel", value: n.salt, color: "#9aa0a6" },
  ];

  const CARD = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };

  return (
    <div key={ingredient.id} className="editor-enter" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px 20px 48px" }}>
        {/* Barre haute : retour (rond) + actions admin — épurée, style 2026 */}
        <div className="slide-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, animationDelay: "0.04s" }}>
          <button onClick={onBack} className="pressable" aria-label="Retour" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", color: "var(--text2)" }}>
            <Icon name="back" size={18} color="currentColor" />
          </button>
          {isAdmin ? (
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={onEdit} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 17px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--text2)" }}>
                <Icon name="edit" size={15} color="currentColor" /> Modifier
              </button>
              <button onClick={onDelete} className="pressable" aria-label="Supprimer" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.3)", cursor: "pointer", color: "var(--red)" }}>
                <Icon name="trash" size={16} color="var(--red)" />
              </button>
            </div>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", height: 40, fontSize: 10.5, color: "rgba(155,135,245,1)", fontWeight: 700, padding: "0 13px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 999 }}>Lecture seule</span>
          )}
        </div>

        {/* En-tête : carte identité (image + nom + catégorie + Nutri-Score) */}
        <div className="slide-up" style={{ ...CARD, padding: 18, marginBottom: 14, animationDelay: "0.1s" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flexShrink: 0, borderRadius: "50%", boxShadow: "0 4px 14px -6px rgba(0,0,0,0.25)" }}><IngImage src={ingredient.image} alt={ingredient.name} size={82} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 25, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 8 }}>{ingredient.name}</h1>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
                <span>{cat.icon}</span> {cat.label}
              </div>
              {aliases.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>Aussi : {aliases.join(", ")}</div>
              )}
            </div>
            <div style={{ flexShrink: 0 }}><NutriScoreBadge letter={letter} /></div>
          </div>
          {ingredient.gramsPerPiece != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text2)", background: "var(--surface2)", borderRadius: 999, padding: "6px 13px", marginTop: 14, width: "fit-content" }}>
              <Icon name="portions" size={14} color="var(--accent)" /> 1 pièce ≈ <strong>{ingredient.gramsPerPiece} g</strong>
            </div>
          )}
        </div>

        {/* Saisonnalité : bandeau des 12 mois + statut du mois courant */}
        {(() => {
          const months = ingredientMonths(ingredient);
          if (!months) return null;
          const inSeason = isIngredientInSeason(ingredient);
          return (
            <div className="slide-up" style={{ ...CARD, padding: "14px 16px", marginBottom: 14, animationDelay: "0.16s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(76,175,125,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="calendar" size={15} color="var(--green)" /></span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Saisonnalité</span>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 999,
                  background: inSeason ? "rgba(76,175,125,0.14)" : "var(--surface2)", color: inSeason ? "var(--green)" : "var(--text3)",
                  border: `1px solid ${inSeason ? "rgba(76,175,125,0.4)" : "var(--border)"}` }}>
                  {inSeason ? "● De saison" : "○ Hors saison"}
                </span>
              </div>
              <SeasonBar months={months} from="var(--green)" to="#7ccf9f" node="#1a8a3c" />
            </div>
          );
        })()}

        {/* Nutrition pour 100 g */}
        <div className="slide-up" style={{ animationDelay: "0.2s" }}>
        <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, margin: "18px 0 12px" }}>Valeurs nutritionnelles <span style={{ fontSize: 12, fontFamily: "var(--ff-body)", color: "var(--text3)", fontWeight: 400 }}>· pour 100 g</span></div>

        {hasNutrition ? (
          <>
            <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 18, padding: "18px 18px", marginBottom: 12 }}>
              <Donut size={128} stroke={17} segments={macroSegs} centerLabel={kcal} centerSub="kcal" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{kj.toLocaleString("fr-FR")} kJ pour 100 g</div>
                {macroSegs.map(seg => (
                  <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, flex: 1 }}>{seg.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(seg.grams)}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)", width: 34, textAlign: "right" }}>{Math.round(seg.value / macroTot * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setDetailOpen(o => !o)} aria-expanded={detailOpen} className="ing-hover"
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, cursor: "pointer", color: "var(--text2)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface2)", display: "grid", placeItems: "center" }}><Icon name="fileText" size={14} color="var(--text3)" /></span> Détail par nutriment
              </span>
              <span style={{ display: "inline-flex", transition: "transform 0.2s ease", transform: detailOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                <Icon name="forward" size={16} color="var(--text3)" />
              </span>
            </button>
            {detailOpen && (
              <div style={{ ...CARD, padding: "16px 16px 14px", marginTop: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {rows.map(row => {
                    const pct = riPct(row.key, row.value);
                    return (
                      <div key={row.key} style={{ paddingLeft: row.sub ? 14 : 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: row.sub ? 12 : 13, fontWeight: row.sub ? 400 : 600, color: row.sub ? "var(--text2)" : "var(--text)" }}>{row.label}</span>
                          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: row.sub ? 12 : 13, fontWeight: 600 }}>{fmt(row.value)}</span>
                            {pct != null && <span style={{ fontSize: 10, color: "var(--text3)", minWidth: 46, flexShrink: 0, whiteSpace: "nowrap", textAlign: "right" }}>{pct}% AJR</span>}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, pct || 0)}%`, height: "100%", borderRadius: 3, background: row.color, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 14 }}>% AJR = apports journaliers recommandés (régime de référence 2000 kcal)</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...CARD, fontSize: 13, color: "var(--text3)", fontStyle: "italic", padding: "18px 16px", textAlign: "center" }}>Aucune donnée nutritionnelle renseignée pour cet ingrédient.</div>
        )}
        </div>

        {/* Tips utiles */}
        {Array.isArray(ingredient.tips) && ingredient.tips.length > 0 && (
          <div className="slide-up" style={{ animationDelay: "0.26s" }}>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, margin: "28px 0 12px" }}>Tips utiles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...ingredient.tips]
                .sort((a, b) => TIP_ORDER.indexOf(a.type) - TIP_ORDER.indexOf(b.type))
                .map((tip, i) => {
                  const t = TIP_TYPES[tip.type] || TIP_TYPES.prep;
                  return (
                    <div key={i} style={{ ...CARD, display: "flex", gap: 13, padding: "13px 15px", alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 3, letterSpacing: "0.01em" }}>{t.label}</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{tip.text}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Source des données nutritionnelles – attribution Ciqual (obligatoire) */}
        <a className="slide-up ing-hover" href="https://ciqual.anses.fr/" target="_blank" rel="noopener noreferrer"
          style={{ ...CARD, display: "flex", alignItems: "center", gap: 12, marginTop: 28, padding: "12px 14px", textDecoration: "none", animationDelay: "0.32s" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1a8a3c,#4caf7d)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(26,138,60,0.35)" }}>
            <Icon name="leaf" size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", letterSpacing: "0.01em" }}>Ciqual 2025</div>
            <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.4, marginTop: 1 }}>Table de composition nutritionnelle · Anses</div>
          </div>
          <Icon name="externalLink" size={13} color="var(--text3)" />
        </a>
      </div>
    </div>
  );
}
