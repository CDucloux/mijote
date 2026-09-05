import { useRef } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { ingredientMonths } from "@/lib/food/seasonality.js";
import { SeasonBar } from "./SeasonBar.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import { useCanHover } from "../hooks/useCanHover.js";

// ─── L'INGRÉDIENT DU MOMENT ───────────────────────────────────────────────────
// Bloc d'engagement en tête du tableau de bord (mode « À suivre ») : un fruit/
// légume de saison, sa frise de saison (donnée réelle `months`), une accroche, et
// un rebond vers « Découvrir » pré-filtré sur ce produit. Volontairement léger et
// sans I/O : les recettes de la communauté qui l'emploient vivent côté /discover.
const CAT_LABEL = { fruit: "Fruit", vegetable: "Légume" };

// Une seule teinte chaude pour toute la carte : l'ambre du badge « De saison »,
// en aplat (pas de dégradé), pour un rendu unifié. Source unique, DRY.
const AMBER = "#e8920a";
const AMBER_RGB = "232, 146, 10";

// Frise de saison (accent) : réutilise la barre partagée <SeasonBar/> et ajoute
// l'en-tête « Sa saison · N mois ».
function SeasonFrieze({ months }) {
  const count = new Set(months || []).size;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 2px 9px" }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text3)", fontWeight: 600 }}>Sa saison</span>
        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>{count} mois / an</span>
      </div>
      <SeasonBar months={months} from={AMBER} to={AMBER} node={AMBER} glow={`rgba(${AMBER_RGB}, 0.5)`} />
    </div>
  );
}

/**
 * Bloc « ingrédient du moment » du tableau de bord.
 *
 * @param ingredient - Fruit/légume de saison mis en avant (issu de la base locale).
 * @param onOpenIngredient - Ouvre la fiche de l'ingrédient (tap sur l'en-tête).
 * @param onExplore - Rebond vers « Découvrir » pré-filtré sur cet ingrédient (CTA).
 */
export function SpotlightIngredient({ ingredient, onOpenIngredient, onExplore }) {
  const canHover = useCanHover();
  // Onde tactile posée dans une COUCHE dédiée (sœur de la photo), pas via la classe
  // `.ripple` : celle-ci imposerait `overflow: hidden` au bouton, qui rognerait le
  // cercle de l'ingrédient et son ombre douce. Ici seule l'encre est bornée.
  const rippleClipRef = useRef(null);
  const onHeaderPress = (e) => {
    if (canHover) return; // souris : on garde hover/active, pas d'onde
    const layer = rippleClipRef.current;
    if (layer) spawnRipple({ currentTarget: layer, clientX: e.clientX, clientY: e.clientY });
  };
  if (!ingredient) return null;
  const months = ingredientMonths(ingredient);
  const catLabel = CAT_LABEL[ingredient.category] || "Ingrédient";

  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px" }}>
        {/* Pousse / jeune plant : distinct de l'étoile de « Découvrir », évoque le produit frais */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20v-7" />
          <path d="M12 13C12 9.7 9.5 8 6 8c0 3.5 2.5 5 6 5Z" />
          <path d="M12 11c0-3 2.5-4.6 6-4.6 0 3.4-2.5 4.6-6 4.6Z" />
        </svg>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>L'ingrédient du moment</h3>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>chaque semaine</span>
      </div>

      <article style={{ position: "relative", overflow: "hidden", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", padding: "16px 16px 14px", boxShadow: "0 10px 26px -16px rgba(120,70,30,0.22)" }}>
        <span aria-hidden="true" style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: AMBER }} />

        {/* En-tête cliquable → fiche ingrédient */}
        <button onClick={() => onOpenIngredient?.(ingredient)} onPointerDown={onHeaderPress} className="pressable" style={{ position: "relative", display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {/* Couche d'onde tactile : borne l'encre sans rogner la photo (sœur, pas parent). */}
          <span ref={rippleClipRef} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 12, pointerEvents: "none", zIndex: 0 }} />
          {/* Le cercle (fond blanc + anneau + rognage) est porté par IngImage lui-même :
              aucun anneau ici, sinon on empile deux bordures concentriques mal alignées
              (effet « double cercle », visible au zoom). */}
          <span style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "block", lineHeight: 0 }}>
            <IngImage src={ingredient.image} alt={ingredient.name} size={74} />
          </span>
          <span style={{ position: "relative", zIndex: 1, minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 6, color: "var(--text)" }}>{ingredient.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `rgba(${AMBER_RGB}, 0.95)`, color: "#fff", fontWeight: 600, fontSize: 10, padding: "3px 9px 3px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Icon name="sun" size={11} color="#fff" /> De saison
              </span>
              <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{catLabel}</span>
            </span>
          </span>
          <span style={{ position: "relative", zIndex: 1, display: "flex", flexShrink: 0 }}><Icon name="forward" size={16} color="var(--text3)" /></span>
        </button>

        {ingredient.description && (
          <p style={{ margin: "13px 2px 2px", fontSize: 13.5, lineHeight: 1.5, color: "var(--text2)" }}>{ingredient.description}</p>
        )}

        {months && <SeasonFrieze months={months} />}

        {onExplore && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "14px 0 12px" }} />
            {/* Rebond vers « Découvrir » pré-semé sur ce produit : la saisonnalité
                (tableau de bord) mène à l'exploration (communauté) d'un seul geste. */}
            <button onClick={() => onExplore(ingredient)} className="pressable" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: `rgba(${AMBER_RGB}, 0.12)`, color: AMBER, border: `1px solid rgba(${AMBER_RGB}, 0.32)`, fontWeight: 600, fontSize: 13.5, borderRadius: 999, padding: "10px 16px", cursor: "pointer" }}>
              <Icon name="sparkle" size={15} color={AMBER} />
              Des recettes avec {(ingredient.name || "").toLowerCase()}
              <Icon name="forward" size={14} color={AMBER} />
            </button>
          </>
        )}
      </article>
    </section>
  );
}
