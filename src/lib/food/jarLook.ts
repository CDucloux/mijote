/**
 * Apparence d'un contenant du mur de stock : sa forme selon le rayon et la teinte
 * de son contenu. Partagée par le bocal de l'étagère et par le menu du bocal
 * (bocaux miniatures), pour que les deux montrent le même contenu.
 *
 * @module food/jarLook
 */
import { vesselColor, type VesselShelf } from "@/lib/food/vesselColor.js";

/** Forme d'un contenant hors bocal : bouteille (liquides) ou pot à épices (poudres). */
export type VesselKind = "bottle" | "spice";

/** Contenant d'un rayon et sa palette de repli. */
export interface JarVessel {
  kind: VesselKind;
  fill: readonly string[];
}

/** Ingrédient minimal pour teinter un bocal. */
export interface JarIngredient {
  id: string;
  name?: string;
  dbId?: string;
}

const VESSEL_SHELVES: readonly VesselShelf[] = ["oil", "acid", "alcohol", "condiment"];
const isVesselShelf = (key: string): key is VesselShelf => VESSEL_SHELVES.some(shelf => shelf === key);

// Palette de contenus (fond du bocal quand l'image est absente/transparente) :
// tons chauds « garde-manger », choisis déterministiquement par ingrédient.
const JAR_FILL: readonly string[] = ["#cdb98a", "#c9a15c", "#b98c4a", "#a6743a", "#8f6b3f", "#7d5a34", "#c7b552", "#9aa15a", "#b5773f", "#d3a86a"];

// Contenant selon le rayon : huiles, vinaigres et alcools en BOUTEILLE (liquides
// dorés, du vinaigre blanc au balsamique, vins et spiritueux), condiments et
// épices en POT À ÉPICES (poudres : paprika, curcuma, poivre, herbes séchées…).
// Le reste en bocal.
const VESSELS: Partial<Record<string, JarVessel>> = {
  oil: { kind: "bottle", fill: ["#d8b44a", "#c9a23a", "#b9a646", "#e0c46a"] },
  acid: { kind: "bottle", fill: ["#a8483a", "#d6c38a", "#7a3b2a", "#c58a4a"] },
  alcohol: { kind: "bottle", fill: ["#6e1f2a", "#e3cf86", "#e8a3a0", "#b8742a", "#8a2b3a"] },
  condiment: { kind: "spice", fill: ["#b8432c", "#d9a42a", "#4a3a2c", "#7c8a45", "#a0522d", "#c9b48a"] },
};

/** Couleur stable pour une graine (hash simple vers la palette). */
function stableColor(seed: string, palette: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/**
 * Contenant d'un rayon.
 *
 * @param catKey - Clé de catégorie (rayon) de l'ingrédient.
 * @returns La bouteille ou le pot à épices du rayon, ou `undefined` pour un bocal.
 */
export function jarVessel(catKey: string): JarVessel | undefined {
  return VESSELS[catKey];
}

/**
 * Teinte du contenu d'un contenant. La couleur vient d'abord du nom (vin rouge,
 * balsamique, paprika… cf. `vesselColor`) ; à défaut, une couleur STABLE de la
 * palette du rayon (ou des tons garde-manger pour un bocal), pour qu'un même
 * ingrédient garde sa teinte d'une visite à l'autre.
 *
 * @param ingredient - L'ingrédient (graine : `dbId`, sinon `id`).
 * @param catKey - Clé de catégorie (rayon).
 * @returns Une couleur CSS hexadécimale.
 */
export function jarFillColor(ingredient: JarIngredient, catKey: string): string {
  const vessel = VESSELS[catKey];
  const byName = vessel && isVesselShelf(catKey) ? vesselColor(ingredient.name, catKey) : null;
  return byName || stableColor(ingredient.dbId || ingredient.id || "", vessel?.fill ?? JAR_FILL);
}
