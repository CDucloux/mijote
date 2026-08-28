import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { Donut } from "./Donut.jsx";
import { Icon } from "./Icon.jsx";
import { PlusBadge } from "./PlusBadge.jsx";
import { computeNutritionDetail, computeNutriInfo, computeNutriBreakdown, buildRecipeIndex } from "@/lib/recipes/nutriscore.js";
import { NUTRI_RI, MACRO_COLORS } from "../constants/nutritionDisplay.js";
import { Row, Col } from "./ui/primitives.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── NUTRITION ANALYSIS MODAL ─────────────────────────────────────────────────
const NUTRI_LETTER_DESC = {
  A: "Excellente qualité nutritionnelle",
  B: "Bonne qualité nutritionnelle",
  C: "Qualité nutritionnelle moyenne",
  D: "Qualité nutritionnelle faible",
  E: "Qualité nutritionnelle très faible",
};

const N_COLOR = "#e0724e";  // pénalités (rouge-orangé)
const P_COLOR = "#4caf7d";  // apports positifs (vert)
const fmtVal = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

// Une ligne de composante du calcul : libellé + valeur/100 g, points, jauge.
function CalcRow({ c, color }) {
  const dim = c.counted === false;
  return (
    <div style={{ opacity: dim ? 0.5 : 1 }}>
      <Row justify="space-between" align="baseline" style={{ marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {c.label} <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text3)" }}>{fmtVal(c.value)} {c.unit}{c.key === "fruitveg" ? "" : "/100 g"}</span>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {dim ? "non compté" : `${c.pts} pt${c.pts > 1 ? "s" : ""}`}
        </span>
      </Row>
      <div style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (c.pts / c.max) * 100)}%`, height: "100%", borderRadius: 999, background: dim ? "var(--text3)" : color, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// Vue « Détail du calcul » (traçabilité Nutri-Score), abonnés Cardamome+.
function NutriCalcView({ breakdown }) {
  const { negatives, N, positives, P, ns, letter } = breakdown;
  const stat = (val, label, color) => (
    <Col align="center" gap={1} style={{ minWidth: 0 }}>
      <span style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{val}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
    </Col>
  );
  const op = (s) => <span style={{ fontSize: 16, fontWeight: 400, color: "var(--text3)" }}>{s}</span>;
  const sectionLabel = (txt, total, color) => (
    <Row justify="space-between" style={{ margin: "18px 2px 11px" }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{txt}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: color, borderRadius: 999, padding: "2px 9px", fontVariantNumeric: "tabular-nums" }}>{total} pt{total > 1 ? "s" : ""}</span>
    </Row>
  );
  return (
    <div>
      {/* Récap de l'équation : N − P = score → lettre */}
      <Row justify="space-around" style={{ padding: "16px 12px", background: "var(--surface2)", borderRadius: 16, marginBottom: 4 }}>
        {stat(N, "Négatifs", N_COLOR)}
        {op("−")}
        {stat(P, "Positifs", P_COLOR)}
        {op("=")}
        {stat(ns, "Score", "var(--text)")}
        {op("→")}
        <NutriScoreBadge letter={letter} compact />
      </Row>

      {sectionLabel("Ce qui pénalise", N, N_COLOR)}
      <Col gap={12}>
        {negatives.map(c => <CalcRow key={c.key} c={c} color={N_COLOR} />)}
      </Col>

      {sectionLabel("Ce qui valorise", P, P_COLOR)}
      <Col gap={12}>
        {positives.map(c => <CalcRow key={c.key} c={c} color={P_COLOR} />)}
      </Col>

      <div style={{ fontSize: 10.5, color: "var(--text3)", lineHeight: 1.5, marginTop: 16, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
        Calcul officiel Nutri-Score 2023, pour 100 g de plat fini. Score = points négatifs − points positifs, puis mappé sur la lettre (A ≤ −1 … E &gt; 18).
      </div>
    </div>
  );
}

// Aperçu verrouillé (non-abonnés) : pitch + CTA vers Cardamome+.
function CalcLocked({ onUpgrade }) {
  return (
    <div style={{ marginTop: 4, padding: "26px 20px", background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.08), rgba(240,192,96,0.05))", border: "1px solid rgba(var(--accent-rgb),0.22)", borderRadius: 18, textAlign: "center" }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, background: "var(--accent)", display: "inline-grid", placeItems: "center", boxShadow: "0 6px 16px -6px rgba(var(--accent-rgb),0.6)", marginBottom: 12 }}>
        <Icon name="shield" size={22} color="#fff" />
      </span>
      <div style={{ fontFamily: "var(--ff-display)", fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Le détail du calcul</div>
      <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55, maxWidth: 300, margin: "0 auto 16px" }}>
        Vois exactement d'où vient la note, points négatifs, points positifs et l'équation qui aboutit à la lettre. Réservé à <PlusBadge />.
      </div>
      <button onClick={onUpgrade} className="btn btn-primary btn-pill" style={{ padding: "10px 20px" }}>
        <Icon name="sparkle" size={15} color="#fff" /> Passer à Cardamome+
      </button>
    </div>
  );
}

export function NutritionModal({ recipe, recipes = [], ingredientDB, servings, onClose }) {
  const [basis, setBasis] = useState("portion"); // "portion" | "100g" | "calc"
  const navigate = useNavigate();
  const { isPlus } = useAppShell();
  const recipesById = useMemo(() => buildRecipeIndex(recipes), [recipes]);
  const detail = useMemo(() => computeNutritionDetail(recipe.ingredients, ingredientDB, servings, recipesById), [recipe.ingredients, ingredientDB, servings, recipesById]);
  const breakdown = useMemo(() => computeNutriBreakdown(recipe.ingredients, ingredientDB, recipesById), [recipe.ingredients, ingredientDB, recipesById]);
  // Lettre recalculée EN DIRECT (comme le badge d'en-tête), pas la valeur figée à
  // l'enregistrement : les ingrédients complétés après coup (nutrition, drapeau
  // « légume ») doivent se refléter, sinon le badge diverge des chiffres affichés.
  const liveLetter = useMemo(() => computeNutriInfo(recipe.ingredients, ingredientDB, recipesById).letter, [recipe.ingredients, ingredientDB, recipesById]);
  // En dessous de ce seuil de couverture, la quasi-totalité du plat n'a pas de
  // données : normaliser sur cette petite fraction produit des valeurs absurdes
  // (ex. « 3 kcal / portion », « 15 g de sel pour 100 g » quand seul le sel est
  // renseigné). On refuse alors d'afficher des chiffres, et la lettre, trompeurs.
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
      <Row gap={14} style={{ marginBottom: 4 }}>
        <NutriScoreBadge letter={letter} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700 }}>Analyse nutritionnelle</div>
          {letter && <div style={{ fontSize: 12, color: "var(--text3)" }}>{NUTRI_LETTER_DESC[letter]}</div>}
        </div>
      </Row>

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
      {/* Bascule portion / 100 g / Calcul, pastille glissante (Calcul = traçabilité, réservé à Cardamome+) */}
      {(() => {
        const opts = [["portion", "Par portion"], ["100g", "Pour 100 g"], ["calc", "Calcul"]];
        const activeIdx = Math.max(0, opts.findIndex(([id]) => id === basis));
        return (
          <Row style={{ position: "relative", background: "var(--surface2)", borderRadius: 10, padding: 3, margin: "14px 0 18px" }}>
            {/* Pastille active : glisse d'un onglet à l'autre (translateX), sans rebond */}
            <div aria-hidden="true" style={{
              position: "absolute", top: 3, bottom: 3, left: 3, width: `calc((100% - 6px) / ${opts.length})`,
              background: "var(--surface)", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              transform: `translateX(calc(${activeIdx} * 100%))`,
              transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
            }} />
            {opts.map(([id, lbl]) => (
              <button key={id} onClick={() => setBasis(id)} style={{ position: "relative", zIndex: 1, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: "transparent", color: basis === id ? "var(--text)" : "var(--text3)", transition: "color 0.3s ease" }}>
                {id === "calc" && !isPlus && <Icon name="lock" size={11} color="currentColor" />}{lbl}
              </button>
            ))}
          </Row>
        );
      })()}

      {basis === "calc" ? (
        isPlus && breakdown
          ? <NutriCalcView breakdown={breakdown} />
          : <CalcLocked onUpgrade={() => { onClose?.(); navigate("/plus"); }} />
      ) : (
      <>
      {/* Énergie + donut macros */}
      <Row gap={18} style={{ padding: "16px 18px", background: "var(--surface2)", borderRadius: 16, marginBottom: 16 }}>
        <Donut size={128} stroke={17} segments={macroSegs} centerLabel={kcal} centerSub="kcal" />
        <Col gap={10} style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>{kj.toLocaleString("fr-FR")} kJ · {basis === "portion" ? "par portion" : "pour 100 g"}</div>
          {macroSegs.map(seg => (
            <Row key={seg.key} gap={8}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, flex: 1 }}>{seg.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(seg.grams)}</span>
              <span style={{ fontSize: 11, color: "var(--text3)", width: 34, textAlign: "right" }}>{Math.round(seg.value / macroTot * 100)}%</span>
            </Row>
          ))}
        </Col>
      </Row>

      {/* Détail avec barres % AJR */}
      <Col gap={11} style={{ marginBottom: 8 }}>
        {rows.map(row => {
          const pct = riPct(row.key, row.value);
          return (
            <div key={row.key} style={{ paddingLeft: row.sub ? 14 : 0 }}>
              <Row align="baseline" justify="space-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: row.sub ? 12 : 13, fontWeight: row.sub ? 400 : 600, color: row.sub ? "var(--text2)" : "var(--text)" }}>{row.label}</span>
                <Row as="span" align="baseline" gap={8}>
                  <span style={{ fontSize: row.sub ? 12 : 13, fontWeight: 600 }}>{fmt(row.value, row.key === "salt" ? "g" : "g")}</span>
                  {pct != null && <span style={{ fontSize: 10, color: "var(--text3)", minWidth: 46, flexShrink: 0, whiteSpace: "nowrap", textAlign: "right" }}>{pct}% AJR</span>}
                </Row>
              </Row>
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct || 0)}%`, height: "100%", borderRadius: 3, background: row.color, transition: "width 0.4s ease" }} />
              </div>
            </div>
          );
        })}
      </Col>
      </>
      )}

      {/* Note de fiabilité (couverture partielle mais exploitable). */}
      {basis !== "calc" && detail.coverage < 0.95 && (
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
