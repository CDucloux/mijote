import type { CSSProperties, ReactNode, Ref } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SourceLink } from "./SourceLink.jsx";
import { CHEFS } from "../../constants/chefs.js";
import { chefWikipediaUrl } from "@/lib/recipes/chefs.js";
import type { Recipe } from "@/lib/types.js";

const chefStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.92)", textDecoration: "none" };

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
 * sur une seule ligne. Un chef de la liste qui a un article renvoie à sa page
 * Wikipédia en français, avec le même soulignement au survol que la source. Un seul conteneur pour que l'animation du héros les déplace
 * ensemble. Rien n'est rendu quand il n'y a ni chef ni source à montrer.
 */
export function RecipeCredits({ recipe, showSource = true, sourcePrefix, iconSize, style, ref }: RecipeCreditsProps) {
  const chef = (recipe.chef || "").trim();
  const source = showSource ? recipe.source : "";
  if (!chef && !source) return null;
  const wiki = chefWikipediaUrl(CHEFS, chef);
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", ...style }}>
      {chef && (wiki ? (
        <a href={wiki} target="_blank" rel="noopener noreferrer" className="source-link" style={chefStyle}>
          <Icon name="chef" size={14} color="rgba(255,255,255,0.92)" />
          <span className="source-link-label">{chef}</span>
          <Icon name="externalLink" size={iconSize ?? 10} color="rgba(255,255,255,0.65)" />
        </a>
      ) : (
        <span style={chefStyle}>
          <Icon name="chef" size={14} color="rgba(255,255,255,0.92)" />
          {chef}
        </span>
      ))}
      {source && <SourceLink source={source} prefix={sourcePrefix} iconSize={iconSize} />}
    </div>
  );
}
