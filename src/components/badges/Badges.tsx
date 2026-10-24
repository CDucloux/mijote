import { Icon, type IconName } from "../ui/Icon.jsx";

// Badge pastille blanc sur fond coloré, décliné en « glass » (flou + ombre, posé
// sur une image) ou plat. Extrait des styles inline répétés (RecipeCard, fiche).

const LABEL = { fontSize: 9.5, fontWeight: 600, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" } as const;
// NB : pas de `backdrop-filter` ici. Le flou d'arrière-plan est recalculé à chaque
// frame de scroll pour CHAQUE badge, dans la grille de recettes (des dizaines de
// cartes) c'était la cause n°1 des saccades sur mobile. Le fond est déjà ~92 %
// opaque : sur une photo le rendu est quasi identique, mais composité gratuitement.
const GLASS = { padding: "4px 9px 4px 7px", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" };
const FLAT = { padding: "3px 10px 3px 7px" };
// Variante du hero de fiche : même boîte que les autres pastilles du hero (classe
// `hero-chip`, hauteur fixe) ; la bordure transparente prend la place de leur liseré.
const HERO = { padding: "0 10px 0 8px", border: "1px solid transparent", gap: 5 };

interface OverlayBadgeProps {
  icon: IconName;
  label: string;
  bg: string;
  title?: string;
  ariaLabel?: string;
  glass?: boolean;
  /** Pastille du hero de fiche recette, alignée sur ses voisines. */
  hero?: boolean;
}

export function OverlayBadge({ icon, label, bg, title, ariaLabel, glass = false, hero = false }: OverlayBadgeProps) {
  return (
    <span title={title || label} aria-label={ariaLabel || label} className={hero ? "hero-chip" : undefined}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20, background: bg, border: "none", ...(hero ? HERO : glass ? GLASS : FLAT) }}>
      <Icon name={icon} size={hero ? 12 : 11} color="#fff" />
      <span style={hero ? { ...LABEL, fontSize: 10 } : LABEL}>{label}</span>
    </span>
  );
}

type OverlayBadgeVariantProps = Omit<OverlayBadgeProps, "icon" | "label" | "bg">;

export const VeganBadge = (props: OverlayBadgeVariantProps) => <OverlayBadge icon="leaf" label="Vegan" ariaLabel="Recette Vegan" bg="rgba(var(--green-rgb),0.92)" {...props} />;
export const SeasonBadge = (props: OverlayBadgeVariantProps) => <OverlayBadge icon="sun" label="De saison" bg="rgba(232,146,10,0.92)" title="De saison ce mois-ci" {...props} />;
