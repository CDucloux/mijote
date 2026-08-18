import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { fmtQty, pluralizeUnit, capitalize } from "../lib/format.js";

// ─── FEUILLE DE CONVERSION EN CUILLÈRES ───────────────────────────────────────
// Ouverte via un petit badge « flèches » posé en bas À DROITE de la vignette d'un
// ingrédient (fiche recette). Aide qui ne pèse pas : « 160 g → ≈ 12 ½ c. à soupe ».
// Les équivalents sont calculés en amont (lib `spoonConversions`) ; ici on affiche.

// Contenance de référence d'une cuillère (pour la ligne secondaire de chaque rangée).
const SPOON_ML = { "cuillère à soupe": 15, "cuillère à café": 5 };

// Badge d'action posé en bas-DROITE d'une vignette d'ingrédient : ouvre la
// conversion en cuillères. À placer dans un conteneur `position: relative`.
export function ConvertBadge({ onClick, size = 19 }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} className="tap"
      title="Convertir en cuillères" aria-label="Convertir en cuillères"
      style={{ position: "absolute", bottom: -2, right: -2,
        width: size, height: size, borderRadius: "50%", background: "var(--accent)",
        border: "2px solid var(--surface)", display: "grid", placeItems: "center",
        cursor: "pointer", padding: 0, boxShadow: "0 2px 7px -1px rgba(var(--accent-rgb),0.6)" }}>
      <Icon name="swap" size={size - 8} color="#fff" />
    </button>
  );
}

/**
 * @param {{ name?: string, image?: string, amount: number, unit?: string, spoons: {unit: string, value: number}[] }} ing
 *        Ingrédient et ses équivalents cuillères pré-calculés.
 * @param {() => void} onClose
 */
export function QuantityConvertSheet({ ing, onClose }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {/* En-tête : vignette + nom en display, source de conversion en pilule accent. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        {ing.image
          ? <IngImage src={ing.image} alt={ing.name} size={52} />
          : <span style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}><Icon name="swap" size={22} color="var(--accent)" /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, color: "var(--text)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(ing.name || "Ingrédient")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.12)", padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
              {fmtQty(ing.amount, ing.unit)} {pluralizeUnit(ing.amount, ing.unit)}
            </span>
            <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>en cuillères</span>
          </div>
        </div>
      </div>

      {/* Conversions : un seul bloc doux, deux rangées séparées d'un filet fin
          (registre « liste iOS/Linear » plutôt que gros pavés isolés). */}
      <div style={{ background: "var(--surface2)", borderRadius: 20, overflow: "hidden" }}>
        {ing.spoons.map((s, i) => (
          <div key={s.unit} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderTop: i ? "1px solid var(--border)" : "none" }}>
            <span style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.13)", display: "grid", placeItems: "center" }}>
              <Icon name="utensils" size={19} color="var(--accent)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 650, color: "var(--text)", lineHeight: 1.2 }}>{capitalize(pluralizeUnit(s.value, s.unit))}</div>
              {SPOON_ML[s.unit] && <div style={{ fontSize: 11.5, color: "var(--text3)", fontWeight: 500, marginTop: 2 }}>{SPOON_ML[s.unit]} ml chacune</div>}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>≈</span>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{fmtQty(s.value, s.unit)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Note : cuillères rases + réserve densité pour les poudres. */}
      <p style={{ fontSize: 12, color: "var(--text3)", margin: "16px 4px 2px", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 7 }}>
        <span style={{ marginTop: 1, flexShrink: 0, display: "flex" }}><Icon name="info" size={13} color="var(--text3)" /></span>
        <span>Équivalences indicatives, cuillères rases. Pour les poudres, la conversion dépend de la densité et reste approximative.</span>
      </p>
    </SwipeableSheet>
  );
}
