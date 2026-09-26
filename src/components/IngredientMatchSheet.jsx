import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { capitalize, fmtQty, pluralizeUnit } from "../lib/format.js";
import { ingredientMatch } from "../lib/recipes/ingredientMatch.js";

// ─── FEUILLE D'APPARIEMENT D'UN INGRÉDIENT ────────────────────────────────────
// Ouverte via la pastille de statut posée à droite d'une ligne d'ingrédient (éditeur
// de recette). Remplace l'ancienne rangée de pilules « Quantité / Unité / reconnu »
// qui alourdissait chaque ligne : on ne montre le détail de l'analyse (ce que le
// parseur a compris, et l'appariement à la base) qu'à la demande.

// Registre visuel d'une tonalité : couleur de premier plan + fond doux. Le tint ambre
// n'a pas de token `--…-rgb`, on le pose en rgba littéral (idiome déjà présent ailleurs).
const TONE = {
  ok: { fg: "var(--ok)", soft: "rgba(var(--ok-rgb),0.14)" },
  warn: { fg: "var(--orange)", soft: "rgba(240,153,42,0.14)" },
  neutral: { fg: "var(--text3)", soft: "var(--surface2)" },
};

/** Une rangée « libellé → valeur » de la liste, registre réglages iOS/Linear. */
function InfoRow({ label, value, tone = "neutral", first = false }) {
  const c = TONE[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: first ? "none" : "1px solid var(--border)" }}>
      <span style={{ fontSize: 13.5, color: "var(--text3)", fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 14.5, fontWeight: 650, color: tone === "neutral" ? "var(--text)" : c.fg, textAlign: "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

/**
 * Feuille de détail de l'appariement d'une ligne d'ingrédient : nom analysé, quantité,
 * unité et reconnaissance dans la base. Purement informative (rien à éditer ici, la
 * saisie reste sur la ligne). Le statut est dérivé par {@link ingredientMatch}.
 *
 * @param {import("@/lib/types").IngredientLine} ing Ligne d'ingrédient saisie.
 * @param {string | null} [image] Vignette de l'ingrédient apparié, si connue.
 * @param {() => void} onClose
 */
export function IngredientMatchSheet({ ing, image, onClose }) {
  const m = ingredientMatch(ing);
  const tone = TONE[m.tone];
  const name = (ing?.name || "").trim();

  return (
    <SwipeableSheet onClose={onClose}>
      {/* En-tête : vignette + nom analysé en display + pilule de statut globale. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        {image
          ? <IngImage src={image} alt={name} size={52} />
          : <span style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: tone.soft, display: "grid", placeItems: "center" }}>
              <Icon name={m.recognized ? "leaf" : m.named ? "leaf" : "search"} size={22} color={tone.fg} />
            </span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name ? capitalize(name) : "Ingrédient à nommer"}
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, fontSize: 12, fontWeight: 650, color: tone.fg, background: tone.soft, padding: "3px 10px 3px 8px", borderRadius: 999 }}>
            <Icon name={m.tone === "ok" ? "check" : "warning"} size={12.5} color={tone.fg} />
            {m.summary}
          </span>
        </div>
      </div>

      {/* Détail de l'analyse : ce que la ligne a produit, ligne par ligne. */}
      <div style={{ background: "var(--surface2)", borderRadius: 18, overflow: "hidden" }}>
        <InfoRow first label="Quantité"
          value={m.hasQuantity ? fmtQty(ing.amount, ing.unit) : "Manquante"}
          tone={m.hasQuantity ? "neutral" : "warn"} />
        <InfoRow label="Unité"
          value={m.hasUnit ? pluralizeUnit(ing.amount, ing.unit) : "À la pièce"}
          tone="neutral" />
        <InfoRow label="Base d'ingrédients"
          value={m.recognized ? "Reconnu" : m.named ? "Non référencé" : "En attente"}
          tone={m.recognized ? "ok" : m.named ? "warn" : "neutral"} />
      </div>

      {/* Ce que l'appariement change concrètement, dit simplement. */}
      <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "16px 4px 2px", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 7 }}>
        <span style={{ marginTop: 1, flexShrink: 0, display: "flex" }}><Icon name="info" size={13} color="var(--text3)" /></span>
        <span>{m.recognized
          ? "Relié à la base : nutrition et conversions sont calculées pour cet ingrédient."
          : m.named
            ? "Introuvable dans la base : écris le nom au plus simple (« pomme de terre » plutôt que « pommes de terre nouvelles »)."
            : "Renseigne un nom d'ingrédient pour le relier à la base."}</span>
      </p>
    </SwipeableSheet>
  );
}
