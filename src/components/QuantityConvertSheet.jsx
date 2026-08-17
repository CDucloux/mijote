import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { fmtQty, pluralizeUnit, capitalize } from "../lib/format.js";

// ─── FEUILLE DE CONVERSION EN CUILLÈRES ───────────────────────────────────────
// Ouverte au tap sur la quantité d'un ingrédient (fiche recette). Aide qui ne pèse
// pas : « 100 g → ≈ 6 ¾ c. à soupe · 20 c. à café ». Les équivalents sont calculés
// en amont (lib `spoonConversions`) ; ici on ne fait qu'afficher.

/**
 * @param {{ name?: string, image?: string, amount: number, unit?: string, spoons: {unit: string, value: number}[] }} ing
 *        Ingrédient et ses équivalents cuillères pré-calculés.
 * @param {() => void} onClose
 */
export function QuantityConvertSheet({ ing, onClose }) {
  return (
    <SwipeableSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        {ing.image
          ? <IngImage src={ing.image} alt={ing.name} size={46} />
          : <span style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: "rgba(232,112,58,0.12)", display: "grid", placeItems: "center" }}><Icon name="swap" size={20} color="var(--accent)" /></span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(ing.name || "Ingrédient")}</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>
            {fmtQty(ing.amount, ing.unit)} {pluralizeUnit(ing.amount, ing.unit)} en cuillères
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ing.spoons.map(s => (
          <div key={s.unit} style={{ display: "flex", alignItems: "baseline", gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
            <span style={{ fontSize: 14, color: "var(--text3)", fontWeight: 600 }}>≈</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--ff-display)" }}>{fmtQty(s.value, s.unit)}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>{pluralizeUnit(s.value, s.unit)}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "var(--text3)", margin: "16px 2px 0", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ marginTop: 1, flexShrink: 0, display: "flex" }}><Icon name="bulb" size={13} color="var(--text3)" /></span>
        <span>Équivalences indicatives (cuillères rases). Une cuillère à soupe = 15 ml, une cuillère à café = 5 ml ; pour les poudres, la conversion dépend de la densité et reste approximative.</span>
      </p>
    </SwipeableSheet>
  );
}
