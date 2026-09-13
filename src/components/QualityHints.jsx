import { precautionVisual } from "@/lib/utensils/usagePrecaution.js";

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
 * Carte « À savoir » d'une précaution d'ustensile : pastille de tonalité (emoji +
 * couleur), titre, description, et « bon réflexe » optionnel. Réutilisée dans la
 * fiche ustensile (admin) et contextuellement en recette.
 */
export function UtensilPrecautionCard({ precaution, style }) {
  if (!precaution) return null;
  const { icon, label, accent } = precautionVisual(precaution.tone);
  return (
    <div style={{
      display: "flex", gap: 12, padding: "13px 15px", borderRadius: 14, alignItems: "flex-start",
      background: "var(--surface)", border: "1px solid var(--border)", ...style,
    }}>
      <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: accent + "1f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }} aria-hidden="true">{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{precaution.title}</div>
        <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>{precaution.description}</p>
        {precaution.tip && (
          <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "7px 0 0", fontStyle: "italic" }}>
            Bon réflexe : {precaution.tip}
          </p>
        )}
      </div>
    </div>
  );
}
