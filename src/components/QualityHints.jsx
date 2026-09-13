import { precautionVisual } from "@/lib/utensils/usagePrecaution.js";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";

// ─── INDICES QUALITÉ (recommandation d'ingrédient / précaution d'ustensile) ───
// Présentationnels et discrets : la logique (résolution, libellé, tonalité) vit
// dans src/lib. On ne rend jamais rien quand il n'y a pas d'info (l'appelant passe
// une valeur nulle → composant renvoie null).

/**
 * Recommandation de forme d'un ingrédient, en ligne discrète (« 💡 Frais ou surgelé
 * recommandé »). Pensée pour se glisser sous une ligne d'ingrédient (recette, courses).
 */
export function IngredientRecoHint({ label, style }) {
  if (!label) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text3)", ...style }}>
      <span style={{ fontSize: 11, flexShrink: 0 }} aria-hidden="true">💡</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

/**
 * Pastille (i) posée en coin d'une card d'ustensile pour signaler qu'une précaution
 * est disponible. Purement visuelle (le clic est géré par la card parente) : pointer
 * events désactivés pour ne pas voler le tap.
 */
export function PrecautionInfoBadge({ tone, style }) {
  const { accent } = precautionVisual(tone);
  return (
    <span aria-hidden="true" style={{
      position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%",
      background: accent + "1f", color: accent, display: "grid", placeItems: "center", pointerEvents: "none", ...style,
    }}>
      <Icon name="info" size={13} color={accent} />
    </span>
  );
}

/**
 * Feuille de détail d'une précaution d'ustensile, ouverte au clic sur la card (fiche
 * recette) ou sur l'ustensile d'une étape (mode pas à pas). En-tête au ton de la
 * précaution, puis titre, description et « bon réflexe ».
 */
export function UtensilPrecautionSheet({ utensilName, precaution, onClose, zIndex }) {
  if (!precaution) return null;
  const { icon, label, accent } = precautionVisual(precaution.tone);
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 14, background: accent + "1f", display: "grid", placeItems: "center", fontSize: 22 }} aria-hidden="true">{icon}</span>
        <div style={{ minWidth: 0 }}>
          {utensilName && <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 1 }}>{utensilName}</div>}
          <div style={{ fontSize: 11, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        </div>
      </div>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 10px", color: "var(--text)" }}>{precaution.title}</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{precaution.description}</p>
      {precaution.tip && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, padding: "12px 14px", borderRadius: 14, background: accent + "14", border: `1px solid ${accent}33` }}>
          <Icon name="bulb" size={16} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Bon réflexe</div>
            <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>{precaution.tip}</p>
          </div>
        </div>
      )}
    </SwipeableSheet>
  );
}
