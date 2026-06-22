import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { Donut } from "./Donut.jsx";
import { computeNutriInfo } from "../lib/nutriscore.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { ingredientMonths, isIngredientInSeason, MONTHS_SHORT_FR, MONTHS_FR, currentMonth } from "../lib/seasonality.js";
import { NUTRI_RI, MACRO_COLORS } from "../constants/nutritionDisplay.js";
import { TIP_TYPES, TIP_ORDER } from "../constants/tipTypes.js";

// ─── INGREDIENT DETAIL (fiche aliment) ────────────────────────────────────────
// Page publique /config/ingredients/{id} : tout utilisateur peut consulter la
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
  const fmt = v => v == null ? "—" : `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} g`;
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

  return (
    <div key={ingredient.id} className="editor-enter" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px 20px 48px" }}>
        {/* Barre haute : retour + actions admin */}
        <div className="slide-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, animationDelay: "0.04s" }}>
          <button onClick={onBack} className="btn-back-ing" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 14px", cursor: "pointer", transition: "background 0.15s, color 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}>
            <Icon name="back" size={14} color="currentColor" /> Retour
          </button>
          {isAdmin ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={onEdit}><Icon name="edit" size={14} /> Modifier</button>
              <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--red)" }} onClick={onDelete}><Icon name="trash" size={14} color="var(--red)" /></button>
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "3px 10px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 8 }}>Lecture seule</span>
          )}
        </div>

        {/* En-tête : image + nom + catégorie + Nutri-Score */}
        <div className="slide-up" style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 22, animationDelay: "0.1s" }}>
          <IngImage src={ingredient.image} alt={ingredient.name} size={88} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 27, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 8 }}>{ingredient.name}</h1>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 12px", fontSize: 12, color: "var(--text2)" }}>
              <span>{cat.icon}</span> {cat.label}
            </div>
            {aliases.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>Aussi : {aliases.join(", ")}</div>
            )}
          </div>
          <div style={{ flexShrink: 0 }}><NutriScoreBadge letter={letter} /></div>
        </div>

        {ingredient.gramsPerPiece != null && (
          <div className="slide-up" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text2)", background: "var(--surface2)", borderRadius: 10, padding: "8px 12px", marginBottom: 18, animationDelay: "0.16s" }}>
            <Icon name="portions" size={14} color="var(--text3)" /> 1 pièce ≈ <strong>{ingredient.gramsPerPiece} g</strong>
          </div>
        )}

        {/* Saisonnalité : bandeau des 12 mois + statut du mois courant */}
        {(() => {
          const months = ingredientMonths(ingredient);
          if (!months) return null;
          const set = new Set(months);
          const inSeason = isIngredientInSeason(ingredient);
          const cm = currentMonth();
          return (
            <div className="slide-up" style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 14px", marginBottom: 18, animationDelay: "0.18s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                  <span style={{ fontSize: 15 }}>🗓️</span> Saisonnalité
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: inSeason ? "rgba(76,175,125,0.14)" : "var(--surface)", color: inSeason ? "var(--green)" : "var(--text3)",
                  border: `1px solid ${inSeason ? "rgba(76,175,125,0.4)" : "var(--border)"}` }}>
                  {inSeason ? "● De saison" : "○ Hors saison"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 3 }}>
                {MONTHS_SHORT_FR.map((lbl, i) => {
                  const m = i + 1, on = set.has(m), now = m === cm;
                  return (
                    <div key={m} title={MONTHS_FR[i]} style={{ textAlign: "center", padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: now ? 800 : 600,
                      background: on ? "var(--green)" : "var(--surface)", color: on ? "#fff" : "var(--text3)",
                      border: now ? "1.5px solid var(--accent)" : "1px solid var(--border)" }}>{lbl}</div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Nutrition pour 100 g */}
        <div className="slide-up" style={{ animationDelay: "0.2s" }}>
        <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, marginBottom: 12 }}>Valeurs nutritionnelles <span style={{ fontSize: 12, fontFamily: "var(--ff-body)", color: "var(--text3)", fontWeight: 400 }}>· pour 100 g</span></div>

        {hasNutrition ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", background: "var(--surface2)", borderRadius: 16, marginBottom: 16 }}>
              <Donut size={128} stroke={17} segments={macroSegs} centerLabel={kcal} centerSub="kcal" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{kj.toLocaleString("fr-FR")} kJ pour 100 g</div>
                {macroSegs.map(seg => (
                  <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1 }}>{seg.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(seg.grams)}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)", width: 34, textAlign: "right" }}>{Math.round(seg.value / macroTot * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setDetailOpen(o => !o)} aria-expanded={detailOpen}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", color: "var(--text2)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                <Icon name="fileText" size={14} color="var(--text3)" /> Détail par nutriment
              </span>
              <span style={{ display: "inline-flex", transition: "transform 0.2s ease", transform: detailOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                <Icon name="forward" size={16} color="var(--text3)" />
              </span>
            </button>
            {detailOpen && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 11, margin: "14px 0 8px" }}>
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
                        <div style={{ height: 6, borderRadius: 3, background: "var(--surface)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, pct || 0)}%`, height: "100%", borderRadius: 3, background: row.color, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 12 }}>% AJR = apports journaliers recommandés (régime de référence 2000 kcal)</div>
              </>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic", padding: "16px 0" }}>Aucune donnée nutritionnelle renseignée pour cet ingrédient.</div>
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
                    <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "var(--surface2)", borderRadius: 14, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 3 }}>{t.label}</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{tip.text}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Source des données nutritionnelles — attribution Ciqual (obligatoire) */}
        <a className="slide-up" href="https://ciqual.anses.fr/" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, padding: "12px 14px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", textDecoration: "none", animationDelay: "0.32s" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#1a8a3c,#4caf7d)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(26,138,60,0.35)" }}>
            <Icon name="leaf" size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", letterSpacing: "0.01em" }}>Ciqual 2025</div>
            <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.4, marginTop: 1 }}>Table de composition nutritionnelle · Anses</div>
          </div>
          <Icon name="externalLink" size={13} color="var(--text3)" />
        </a>
      </div>
    </div>
  );
}
