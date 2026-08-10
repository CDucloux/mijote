import { useState, useMemo } from "react";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { Donut } from "./Donut.jsx";
import { computeNutritionDetail, computeNutriInfo, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { NUTRI_RI, MACRO_COLORS } from "../constants/nutritionDisplay.js";

// ─── NUTRITION ANALYSIS MODAL ─────────────────────────────────────────────────
const NUTRI_LETTER_DESC = {
  A: "Excellente qualité nutritionnelle",
  B: "Bonne qualité nutritionnelle",
  C: "Qualité nutritionnelle moyenne",
  D: "Qualité nutritionnelle faible",
  E: "Qualité nutritionnelle très faible",
};

export function NutritionModal({ recipe, recipes = [], ingredientDB, servings, onClose }) {
  const [basis, setBasis] = useState("portion"); // "portion" | "100g"
  const recipesById = useMemo(() => buildRecipeIndex(recipes), [recipes]);
  const detail = useMemo(() => computeNutritionDetail(recipe.ingredients, ingredientDB, servings, recipesById), [recipe.ingredients, ingredientDB, servings, recipesById]);
  // Lettre recalculée EN DIRECT (comme le badge d'en-tête), pas la valeur figée à
  // l'enregistrement : les ingrédients complétés après coup (nutrition, drapeau
  // « légume ») doivent se refléter, sinon le badge diverge des chiffres affichés.
  const liveLetter = useMemo(() => computeNutriInfo(recipe.ingredients, ingredientDB, recipesById).letter, [recipe.ingredients, ingredientDB, recipesById]);
  // En dessous de ce seuil de couverture, la quasi-totalité du plat n'a pas de
  // données : normaliser sur cette petite fraction produit des valeurs absurdes
  // (ex. « 3 kcal / portion », « 15 g de sel pour 100 g » quand seul le sel est
  // renseigné). On refuse alors d'afficher des chiffres — et la lettre — trompeurs.
  const reliable = detail.coverage >= 0.5;
  const letter = reliable ? (liveLetter ?? recipe.nutriLetter) : null;
  const data = basis === "portion" ? detail.perServing : detail.per100;
  const kcal = Math.round(data.calories);
  const kj = Math.round(data.calories * 4.184);

  // Répartition énergétique des macros (4/4/9 kcal/g)
  const macroKcal = { protein: data.protein * 4, carbs: data.carbs * 4, fat: data.fat * 9 };
  const macroSegs = [
    { key: "protein", label: "Protéines", color: MACRO_COLORS.protein, value: macroKcal.protein, grams: data.protein },
    { key: "carbs", label: "Glucides", color: MACRO_COLORS.carbs, value: macroKcal.carbs, grams: data.carbs },
    { key: "fat", label: "Lipides", color: MACRO_COLORS.fat, value: macroKcal.fat, grams: data.fat },
  ];
  const macroTot = macroSegs.reduce((s, x) => s + x.value, 0) || 1;

  const fmt = (v, unit = "g") => {
    if (v == null) return "–";
    const r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return `${r} ${unit}`;
  };
  const riPct = (key, v) => NUTRI_RI[key] ? Math.round(v / NUTRI_RI[key] * 100) : null;

  // Barres détaillées (les "dont" indentés sous leur macro parent)
  const rows = [
    { key: "fat", label: "Lipides", value: data.fat, color: MACRO_COLORS.fat },
    { key: "saturatedFat", label: "dont acides gras saturés", value: data.saturatedFat, sub: true, color: "#c8581f" },
    { key: "omega3", label: "dont oméga-3", value: data.omega3, sub: true, color: "#2f9e6f" },
    { key: "carbs", label: "Glucides", value: data.carbs, color: MACRO_COLORS.carbs },
    { key: "sugar", label: "dont sucres", value: data.sugar, sub: true, color: "#d99a10" },
    { key: "fiber", label: "Fibres", value: data.fiber, color: "#7bb661" },
    { key: "protein", label: "Protéines", value: data.protein, color: MACRO_COLORS.protein },
    { key: "salt", label: "Sel", value: data.salt, color: "#9aa0a6" },
  ];

  return (
    <SwipeableSheet onClose={onClose} style={{ maxWidth: 460 }}>
      {/* En-tête : Nutri-Score */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <NutriScoreBadge letter={letter} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500 }}>Analyse nutritionnelle</div>
          {letter && <div style={{ fontSize: 12, color: "var(--text3)" }}>{NUTRI_LETTER_DESC[letter]}</div>}
        </div>
      </div>

      {/* Couverture trop faible → l'estimation n'aurait aucun sens : on l'explique. */}
      {!reliable ? (
        <div style={{ marginTop: 16, padding: "18px 16px", background: "var(--surface2)", borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🥑</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>Analyse indisponible</div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55 }}>
            {detail.coverage > 0
              ? <>Seulement <strong style={{ color: "var(--text)" }}>{Math.round(detail.coverage * 100)}%</strong> de la masse du plat a des données nutritionnelles. Les valeurs seraient trompeuses tant que la plupart des ingrédients n'ont pas de fiche renseignée.</>
              : <>Aucun ingrédient de cette recette n'a encore de données nutritionnelles.</>}
          </div>
        </div>
      ) : (
        <>
      {/* Bascule portion / 100 g */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 10, padding: 3, margin: "14px 0 18px" }}>
        {[["portion", `Par portion`], ["100g", "Pour 100 g"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setBasis(id)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: basis === id ? "var(--surface)" : "transparent", color: basis === id ? "var(--text)" : "var(--text3)", boxShadow: basis === id ? "0 1px 3px rgba(0,0,0,0.12)" : "none", transition: "all 0.15s" }}>{lbl}</button>
        ))}
      </div>

      {/* Énergie + donut macros */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", background: "var(--surface2)", borderRadius: 16, marginBottom: 16 }}>
        <Donut size={128} stroke={17} segments={macroSegs} centerLabel={kcal} centerSub="kcal" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>{kj.toLocaleString("fr-FR")} kJ · {basis === "portion" ? "par portion" : "pour 100 g"}</div>
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

      {/* Détail avec barres % AJR */}
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 8 }}>
        {rows.map(row => {
          const pct = riPct(row.key, row.value);
          return (
            <div key={row.key} style={{ paddingLeft: row.sub ? 14 : 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: row.sub ? 12 : 13, fontWeight: row.sub ? 400 : 600, color: row.sub ? "var(--text2)" : "var(--text)" }}>{row.label}</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: row.sub ? 12 : 13, fontWeight: 600 }}>{fmt(row.value, row.key === "salt" ? "g" : "g")}</span>
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

      {/* Note de fiabilité (couverture partielle mais exploitable). */}
      {detail.coverage < 0.95 && (
        <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5, marginTop: 12, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
          Estimation sur {Math.round(detail.coverage * 100)}% de la masse du plat – certains ingrédients n'ont pas encore de données nutritionnelles.
        </div>
      )}
        </>
      )}
      {reliable && (
        <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 12 }}>
          % AJR = apports journaliers recommandés (régime de référence 2000 kcal)
        </div>
      )}
    </SwipeableSheet>
  );
}
