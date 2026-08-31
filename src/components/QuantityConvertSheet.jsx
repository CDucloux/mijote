import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { fmtQty, pluralizeUnit, capitalize } from "../lib/format.js";

// ─── FEUILLE DE CONVERSION EN CUILLÈRES ───────────────────────────────────────
// Ouverte via un petit badge « cuillère » posé en bas À DROITE de la vignette d'un
// ingrédient (fiche recette, mise en place). Aide qui ne pèse pas : « 160 g → ≈ 12 ½
// c. à soupe ». Les équivalents sont calculés en amont (lib `spoonConversions`).

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
        cursor: "pointer", padding: 0, boxShadow: "0 2px 6px -1px rgba(0,0,0,0.4)" }}>
      <Icon name="spoon" size={size - 7} color="#fff" />
    </button>
  );
}

/**
 * Feuille de conversion en cuillères. Deux registres selon les callbacks fournis :
 * - Informatif (par défaut) : affiche les équivalents, rien de cliquable.
 * - Sélection (`onSelectUnit` fourni) : chaque rangée devient un choix ; l'unité
 *   retenue est mémorisée par l'appelant et sert d'affichage ailleurs (mise en
 *   place du cook mode). `onReset` rétablit l'unité d'origine.
 *
 * @param {{ id?: string, name?: string, image?: string, amount: number, unit?: string, spoons: {unit: string, value: number}[] }} ing
 *        Ingrédient et ses équivalents cuillères pré-calculés.
 * @param {() => void} onClose
 * @param {string | null} [selectedUnit] Unité cuillère actuellement choisie (mode sélection).
 * @param {(unit: string) => void} [onSelectUnit] Choix d'une unité ; active le mode sélection.
 * @param {() => void} [onReset] Retour à l'unité d'origine (mode sélection).
 * @param {number} [zIndex] Surcharge du z-index du backdrop (au-dessus d'un overlay plein écran).
 */
export function QuantityConvertSheet({ ing, onClose, selectedUnit = null, onSelectUnit, onReset, zIndex }) {
  const selectable = typeof onSelectUnit === "function";
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex}>
      {/* En-tête : vignette + nom en display, source de conversion en pilule accent. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: selectable ? 14 : 22 }}>
        {ing.image
          ? <IngImage src={ing.image} alt={ing.name} size={52} />
          : <span style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}><Icon name="spoon" size={24} color="var(--accent)" /></span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(ing.name || "Ingrédient")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.12)", padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
              {fmtQty(ing.amount, ing.unit)} {pluralizeUnit(ing.amount, ing.unit)}
            </span>
            <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>en cuillères</span>
          </div>
        </div>
      </div>

      {selectable && (
        <p style={{ fontSize: 13.5, color: "var(--text2)", margin: "0 2px 14px", lineHeight: 1.5 }}>
          Choisis l'unité à afficher pour cet ingrédient dans toute la mise en place.
        </p>
      )}

      {/* Conversions : un seul bloc doux, deux rangées séparées d'un filet fin
          (registre « liste iOS/Linear » plutôt que gros pavés isolés). En mode
          sélection, chaque rangée est un bouton (l'unité active porte une coche). */}
      <div style={{ background: "var(--surface2)", borderRadius: 20, overflow: "hidden" }}>
        {ing.spoons.map((s, i) => {
          const active = selectable && selectedUnit === s.unit;
          const rowStyle = { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", borderTop: i ? "1px solid var(--border)" : "none", textAlign: "left", background: active ? "rgba(var(--accent-rgb),0.09)" : "transparent" };
          const inner = (
            <>
              <span style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.13)", display: "grid", placeItems: "center" }}>
                <Icon name="spoon" size={20} color="var(--accent)" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 650, color: "var(--text)", lineHeight: 1.2 }}>{capitalize(pluralizeUnit(s.value, s.unit))}</div>
                {SPOON_ML[s.unit] && <div style={{ fontSize: 11.5, color: "var(--text3)", fontWeight: 500, marginTop: 2 }}>{SPOON_ML[s.unit]} ml chacune</div>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>≈</span>
                <span style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{fmtQty(s.value, s.unit)}</span>
              </div>
              {selectable && (
                <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", background: active ? "var(--accent)" : "transparent", border: active ? "none" : "2px solid var(--border)" }}>
                  {active && <Icon name="check" size={14} color="#fff" />}
                </span>
              )}
            </>
          );
          return selectable
            ? <button key={s.unit} type="button" className="pressable" onClick={() => onSelectUnit(s.unit)} style={{ ...rowStyle, border: "none", borderTop: rowStyle.borderTop, cursor: "pointer" }}>{inner}</button>
            : <div key={s.unit} style={rowStyle}>{inner}</div>;
        })}
      </div>

      {selectable && selectedUnit && (
        <button type="button" className="pressable" onClick={onReset}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          <Icon name="undo" size={15} color="var(--text3)" /> Revenir à {fmtQty(ing.amount, ing.unit)} {pluralizeUnit(ing.amount, ing.unit)}
        </button>
      )}

      {/* Note : cuillères rases + réserve densité pour les poudres. */}
      <p style={{ fontSize: 12, color: "var(--text3)", margin: "16px 4px 2px", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 7 }}>
        <span style={{ marginTop: 1, flexShrink: 0, display: "flex" }}><Icon name="info" size={13} color="var(--text3)" /></span>
        <span>Équivalences indicatives, cuillères rases. Pour les poudres, la conversion dépend de la densité et reste approximative.</span>
      </p>
    </SwipeableSheet>
  );
}
