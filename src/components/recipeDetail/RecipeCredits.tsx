import type { CSSProperties, ReactNode, Ref } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SourceLink } from "./SourceLink.jsx";
import type { Recipe } from "@/lib/types.js";

interface RecipeCreditsProps {
  recipe: Pick<Recipe, "chef" | "source">;
  /** Affiche le lien vers la source (masqué quand l'attribution publique s'en charge). */
  showSource?: boolean;
  /** Texte avant le domaine de la source (ex. « d'après »). */
  sourcePrefix?: ReactNode;
  iconSize?: number;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Crédits d'une recette sur le héros : le chef (toque) puis le lien vers la source,
 * sur une seule ligne. Un seul conteneur pour que l'animation du héros les déplace
 * ensemble. Rien n'est rendu quand il n'y a ni chef ni source à montrer.
 */
export function RecipeCredits({ recipe, showSource = true, sourcePrefix, iconSize, style, ref }: RecipeCreditsProps) {
  const chef = (recipe.chef || "").trim();
  const source = showSource ? recipe.source : "";
  if (!chef && !source) return null;
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", ...style }}>
      {chef && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>
          <Icon name="chef" size={14} color="rgba(255,255,255,0.92)" />
          {chef}
        </span>
      )}
      {source && <SourceLink source={source} prefix={sourcePrefix} iconSize={iconSize} />}
    </div>
  );
}
