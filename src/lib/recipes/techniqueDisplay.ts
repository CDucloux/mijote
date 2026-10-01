/**
 * Identité visuelle d'une catégorie de geste technique (icône du set maison +
 * couleur d'accent). Partagée entre l'affichage en recette (bulle + fiche
 * détaillée) et l'éditeur de geste, pour que l'entrée (saisie) et la sortie
 * (consultation) restent cohérentes.
 *
 * @module recipes/techniqueDisplay
 */

/** Icône (nom du set maison) et couleur d'accent d'une catégorie de geste. */
export interface TechniqueVisual {
  icon: string;
  color: string;
}

const TECHNIQUE_VISUALS: Record<string, TechniqueVisual> = {
  decoupe: { icon: "knife", color: "#e0894a" },
  cuisson: { icon: "fire", color: "#e0524f" },
  liaison: { icon: "spoon", color: "#c8951f" },
  preparation: { icon: "utensils", color: "#5b9cf6" },
  dressage: { icon: "dish", color: "#9b87f5" },
};

const FALLBACK_VISUAL: TechniqueVisual = { icon: "utensils", color: "var(--accent)" };

/**
 * Renvoie l'icône et la couleur associées à une catégorie de geste, avec un
 * repli neutre (icône générique, couleur d'accent du thème) pour une catégorie
 * inconnue, vide ou absente.
 *
 * @param category - La catégorie du geste (`decoupe`, `cuisson`, `liaison`,
 *   `preparation`, `dressage`).
 * @returns Le couple `{ icon, color }` à utiliser pour cette catégorie.
 */
export function techniqueVisual(category: string | null | undefined): TechniqueVisual {
  return (category && TECHNIQUE_VISUALS[category]) || FALLBACK_VISUAL;
}
