import { Icon } from "./Icon.jsx";

// ─── BADGES (vegan / de saison) ───────────────────────────────────────────────
// Badge pastille blanc sur fond coloré, décliné en « glass » (flou + ombre, posé
// sur une image) ou plat. Extrait des styles inline répétés (RecipeCard, fiche).

const LABEL = { fontSize: 9.5, fontWeight: 600, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" };
// NB : pas de `backdrop-filter` ici. Le flou d'arrière-plan est recalculé à chaque
// frame de scroll pour CHAQUE badge → dans la grille de recettes (des dizaines de
// cartes), c'était la cause n°1 des saccades sur mobile. Le fond est déjà ~92 %
// opaque : sur une photo le rendu est quasi identique, mais composité gratuitement.
const GLASS = { padding: "4px 9px 4px 7px", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" };
const FLAT = { padding: "3px 10px 3px 7px" };

export function OverlayBadge({ icon, label, bg, title, ariaLabel, glass = false }) {
  return (
    <span title={title || label} aria-label={ariaLabel || label} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20, background: bg, border: "1px solid rgba(255,255,255,0.3)", ...(glass ? GLASS : FLAT) }}>
      <Icon name={icon} size={11} color="#fff" />
      <span style={LABEL}>{label}</span>
    </span>
  );
}

export const VeganBadge = (p) => <OverlayBadge icon="leaf" label="Vegan" ariaLabel="Recette Vegan" bg="rgba(var(--green-rgb),0.92)" {...p} />;
export const SeasonBadge = (p) => <OverlayBadge icon="sun" label="De saison" bg="rgba(232,146,10,0.92)" title="De saison ce mois-ci" {...p} />;
