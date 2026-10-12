import { Icon } from "../ui/Icon.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";

interface RecipeSheetThumbProps {
  image?: string;
  /** Préparation de base : glyphe dédié plutôt que le bol. */
  isComponent?: boolean;
}

/**
 * Vignette d'en-tête des feuilles d'actions d'une recette : la photo si elle
 * existe, sinon un glyphe du set d'icônes sur une teinte d'accent (jamais un
 * emoji, qui casserait la cohérence du système d'icônes).
 */
export function RecipeSheetThumb({ image, isComponent = false }: RecipeSheetThumbProps) {
  return (
    <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center",
      background: image ? "var(--surface2)" : "rgba(var(--accent-rgb), 0.12)" }}>
      {image
        ? <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : isComponent ? <BaseIcon size={24} color="var(--accent)" /> : <Icon name="dish" size={24} color="var(--accent)" />}
    </div>
  );
}
