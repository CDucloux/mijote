/**
 * Couleur du contenu d'un contenant du mur de stock, déduite du NOM de
 * l'ingrédient : un vin rouge doit être rouge, un balsamique presque noir, une
 * huile d'olive vert doré, un paprika rouge brique. Sans mot reconnu, l'appelant
 * retombe sur une couleur stable tirée au hasard dans la palette du rayon.
 *
 * Les règles sont testées dans l'ordre : la plus spécifique d'abord (« vinaigre
 * de vin rouge » avant « vin rouge », « vin blanc » avant « blanc »).
 *
 * @module food/vesselColor
 */
import { normalizeStr } from "@/lib/food/parseIngredient.js";

/** Rayons dont le contenu a une couleur reconnaissable au nom. */
export type VesselShelf = "oil" | "acid" | "alcohol" | "condiment";

type Rule = [pattern: RegExp, color: string];

const RULES: Record<VesselShelf, Rule[]> = {
  alcohol: [
    [/\bros[e]\b/, "#e8a3a0"],
    [/\b(vin rouge|rouge|bordeaux|bourgogne|beaujolais|lambrusco)\b/, "#6e1f2a"],
    [/\b(porto|madere|marsala|xeres|sherry)\b/, "#8a3a1e"],
    [/\b(vin blanc|blanc|champagne|cremant|prosecco|vermouth|noilly)\b/, "#e3cf86"],
    [/\b(rhum|cognac|armagnac|whisky|whiskey|calvados|brandy|amaretto|grand marnier|cointreau)\b/, "#b8742a"],
    [/\b(biere|cidre)\b/, "#d6a03a"],
    [/\b(vodka|gin|kirsch|sake|eau de vie|tequila|pastis|anis)\b/, "#e6e8e2"],
  ],
  acid: [
    [/\bbalsamique\b/, "#3b1e14"],
    [/\b(vin rouge|xeres|sherry)\b/, "#a8483a"],
    [/\bcidre\b/, "#d6a85a"],
    [/\b(citron|lime|yuzu|verjus)\b/, "#efe08a"],
    [/\b(riz|blanc|alcool|cristal)\b/, "#ece6cc"],
  ],
  oil: [
    [/\bsesame\b/, "#8a5a2a"],
    [/\bolive\b/, "#b9a646"],
    [/\b(noix|noisette|amande|argan)\b/, "#c99a3a"],
    [/\b(truffe|piment)\b/, "#c9862a"],
    [/\b(tournesol|colza|pepins|arachide|neutre|friture|mais)\b/, "#e6c95a"],
  ],
  condiment: [
    [/\b(soja|worcestershire|nuoc mam|poisson)\b/, "#3b2416"],
    [/\b(paprika|piment|cayenne|espelette|chili|harissa|sriracha)\b/, "#b8432c"],
    [/\b(curcuma|curry|safran|moutarde)\b/, "#d9a42a"],
    [/\b(poivre|vanille|cacao|cafe)\b/, "#3a302a"],
    [/\b(cannelle|muscade|cumin|girofle|quatre epices|ras el hanout|gingembre)\b/, "#a0522d"],
    [/\b(thym|origan|persil|basilic|romarin|estragon|ciboulette|herbes|laurier|sauge|aneth|menthe|coriandre)\b/, "#7c8a45"],
    [/\b(sel|fleur de sel|sucre|ail|oignon|semoule)\b/, "#e3d9c0"],
  ],
};

/**
 * Couleur de contenu d'après le nom de l'ingrédient.
 *
 * @param name - Nom de l'ingrédient (casse et accents ignorés).
 * @param shelf - Rayon du contenant.
 * @returns La couleur reconnue, ou `null` si aucun mot du nom n'en désigne une.
 */
export function vesselColor(name: string | null | undefined, shelf: VesselShelf): string | null {
  const key = normalizeStr(name).replace(/[-']/g, " ");
  if (!key) return null;
  for (const [pattern, color] of RULES[shelf]) if (pattern.test(key)) return color;
  return null;
}
