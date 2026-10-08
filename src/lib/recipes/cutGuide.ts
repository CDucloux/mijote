/**
 * Guide de découpe : ce qui aide l'utilisateur à CHOISIR une forme sans connaître le
 * vocabulaire de brigade. Trois responsabilités pures :
 *   1. ranger les formes par RÉSULTAT visible (cubes, tranches…), cf. {@link CUT_FAMILIES} ;
 *   2. décrire le résultat de chaque forme et ses tailles indicatives ({@link CUT_GUIDE}) ;
 *   3. suggérer les découpes usuelles d'un ingrédient ({@link cutShortlist}) ;
 *   4. écarter les catégories qui ne se taillent jamais ({@link isCuttableCategory}).
 *
 * Les tailles en millimètres ne sont QUE des repères d'affichage : le modèle stocké
 * reste le calibre grossier (fin/moyen/gros), cf. {@link Calibre}.
 *
 * @module recipes/cutGuide
 */

import type { Calibre, FormeDecoupe } from "@/lib/types.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

/** Famille de découpe, nommée d'après la forme du résultat. */
export type CutFamily = "tranches" | "cubes" | "fin" | "batons" | "morceaux";

/** Une famille et ses formes, dans l'ordre d'affichage. */
export interface CutFamilyEntry {
  id: CutFamily;
  label: string;
  formes: readonly FormeDecoupe[];
}

/** Familles dans l'ordre d'affichage ; chaque forme appartient à exactement une famille. */
export const CUT_FAMILIES: readonly CutFamilyEntry[] = [
  { id: "tranches", label: "Tranches", formes: ["emince", "lamelle", "rondelle"] },
  { id: "cubes", label: "Cubes", formes: ["des", "brunoise", "mirepoix", "paysanne"] },
  { id: "fin", label: "Hachés et râpés", formes: ["cisele", "hache", "rape"] },
  { id: "batons", label: "Bâtons et fils", formes: ["batonnet", "julienne", "chiffonade"] },
  { id: "morceaux", label: "Morceaux", formes: ["troncon", "quartier"] },
];

/** Fiche d'aide d'une forme. */
export interface CutGuideEntry {
  /** Nom du résultat (« Brunoise »), plus parlant qu'un verbe dans une liste de choix. */
  name: string;
  /** Traduction en langage courant, en quelques mots (« très petits dés »). */
  hint: string;
  /** Description du résultat attendu, une phrase. */
  result: string;
  /**
   * Repère de taille par calibre. Absent quand la taille fait partie de la définition
   * (une brunoise est fine par nature) : le calibre n'a alors pas de sens.
   */
  sizes?: Record<Calibre, string>;
}

/** Fiche de chaque forme. `Record` exhaustif : une forme ajoutée sans fiche ne compile pas. */
export const CUT_GUIDE: Record<FormeDecoupe, CutGuideEntry> = {
  emince: { name: "Émincé", hint: "fines tranches", result: "Fines tranches régulières, qui cuisent vite et fondent.", sizes: { fin: "1 mm", moyen: "3 mm", gros: "5 mm" } },
  lamelle: { name: "Lamelles", hint: "tranches plates", result: "Tranches plates coupées à plat, pour un gratin ou une poêlée.", sizes: { fin: "2 mm", moyen: "4 mm", gros: "8 mm" } },
  rondelle: { name: "Rondelles", hint: "tranches rondes", result: "Disques coupés en travers d'un légume long.", sizes: { fin: "2 mm", moyen: "5 mm", gros: "1 cm" } },
  des: { name: "Dés", hint: "cubes réguliers", result: "Cubes réguliers, qui cuisent tous au même rythme.", sizes: { fin: "5 mm", moyen: "1 cm", gros: "2 cm" } },
  brunoise: { name: "Brunoise", hint: "très petits dés", result: "Très petits dés de 2 à 3 mm, pour une sauce ou une garniture fine." },
  mirepoix: { name: "Mirepoix", hint: "gros dés rustiques", result: "Gros dés irréguliers de 1 à 2 cm, pour un fond ou un braisé." },
  paysanne: { name: "Paysanne", hint: "petits carrés plats", result: "Carrés ou triangles plats d'environ 1 cm, fins de 2 mm, pour une soupe." },
  cisele: { name: "Ciselé", hint: "petits dés d'oignon", result: "Petits dés nets qui ne s'écrasent pas, pour l'oignon, l'échalote ou les herbes.", sizes: { fin: "2 mm", moyen: "3 mm", gros: "5 mm" } },
  hache: { name: "Haché", hint: "menu, irrégulier", result: "Morceaux fins et irréguliers, obtenus en repassant la lame.", sizes: { fin: "très menu", moyen: "menu", gros: "grossier" } },
  rape: { name: "Râpé", hint: "à la râpe", result: "Copeaux ou filaments obtenus à la râpe.", sizes: { fin: "râpe fine", moyen: "râpe moyenne", gros: "gros trous" } },
  batonnet: { name: "Bâtonnets", hint: "comme des frites", result: "Bâtons de section carrée d'environ 5 cm de long.", sizes: { fin: "5 mm", moyen: "1 cm", gros: "1,5 cm" } },
  julienne: { name: "Julienne", hint: "fins filaments", result: "Filaments de 1 à 2 mm sur 5 cm, pour une garniture croquante." },
  chiffonade: { name: "Chiffonade", hint: "lanières de feuilles", result: "Fines lanières de feuilles roulées puis tranchées (basilic, salade, oseille)." },
  troncon: { name: "Tronçons", hint: "gros segments", result: "Segments coupés en travers d'un légume long, droits ou en biseau.", sizes: { fin: "2 cm", moyen: "4 cm", gros: "6 cm" } },
  quartier: { name: "Quartiers", hint: "parts égales", result: "Parts égales coupées depuis le centre, comme une orange." },
};

/** Famille d'une forme. */
export function familyOf(forme: FormeDecoupe): CutFamily {
  return (CUT_FAMILIES.find((family) => family.formes.includes(forme)) ?? CUT_FAMILIES[0]).id;
}

/** Vrai quand la forme se décline en calibres (sinon la taille fait partie de sa définition). */
export function hasSizes(forme: FormeDecoupe): boolean {
  return !!CUT_GUIDE[forme].sizes;
}

// Découpes usuelles par ingrédient. Clés = mots (ou expressions) normalisés, testés
// dans l'ordre : les expressions composées d'abord (« pomme de terre » avant « pomme »).
const BY_NAME: [string[], FormeDecoupe[]][] = [
  [["pomme de terre", "patate"], ["des", "lamelle", "rondelle", "batonnet"]],
  [["oignon", "echalote"], ["emince", "cisele", "hache"]],
  [["ail", "gingembre", "piment"], ["hache", "emince", "rape"]],
  [["poireau"], ["rondelle", "emince", "julienne"]],
  [["carotte", "panais", "navet", "radis", "betterave"], ["rondelle", "des", "julienne", "rape"]],
  [["celeri"], ["des", "brunoise", "mirepoix"]],
  [["courgette", "aubergine", "concombre"], ["rondelle", "lamelle", "des", "batonnet"]],
  [["tomate"], ["des", "quartier", "rondelle"]],
  [["poivron"], ["lamelle", "des", "julienne"]],
  [["chou"], ["emince", "quartier", "rape"]],
  [["champignon", "cepe", "girolle"], ["emince", "lamelle", "quartier"]],
  [["fenouil"], ["emince", "lamelle", "quartier"]],
  [["lard", "lardon", "bacon", "ventreche", "pancetta", "chorizo", "jambon"], ["des", "batonnet", "lamelle"]],
  [["persil", "coriandre", "basilic", "menthe", "ciboulette", "aneth", "estragon", "cerfeuil", "sauge", "oseille"], ["cisele", "hache", "chiffonade"]],
  [["citron", "orange", "pamplemousse"], ["rape", "quartier", "rondelle"]],
  [["parmesan", "gruyere", "comte", "emmental", "fromage"], ["rape", "des", "lamelle"]],
  [["pomme", "poire", "peche", "mangue", "ananas", "fraise", "abricot"], ["des", "lamelle", "quartier"]],
];

// Repli sur la catégorie de la base d'ingrédients (clés de DEFAULT_CATEGORIES).
const BY_CATEGORY: Record<string, FormeDecoupe[]> = {
  herbs: ["cisele", "hache", "chiffonade"],
  vegetable: ["des", "emince", "rondelle", "lamelle"],
  mushroom: ["emince", "lamelle", "quartier"],
  meat: ["des", "lamelle", "emince"],
  fish_seafood: ["des", "lamelle", "troncon"],
  fruit: ["des", "lamelle", "quartier"],
  dairy: ["rape", "des", "lamelle"],
};

const DEFAULT_SHORTLIST: FormeDecoupe[] = ["des", "emince", "lamelle", "hache"];

/** Nombre maximal de suggestions : au-delà, on retombe dans la liste qu'on veut éviter. */
const MAX_SUGGESTIONS = 4;

/** Vrai si `key` figure comme mot (ou expression) entier dans le nom normalisé, pluriel en -s/-x toléré. */
function nameHas(words: string, key: string): boolean {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${esc}[sx]?( |$)`).test(words);
}

/** Catégories liquides ou en vrac (alcools, huiles, vinaigres, sauces, sucres) : une
 *  découpe n'y a aucun sens, on ne la propose donc même pas. */
const UNCUTTABLE_CATEGORIES: ReadonlySet<string> = new Set(["alcohol", "oil", "acid", "sauce", "sugar"]);

/**
 * Dit si une découpe peut s'appliquer à un ingrédient de cette catégorie. Une catégorie
 * inconnue ou absente reste découpable : on ne retire l'option qu'à coup sûr.
 *
 * @param category - Catégorie de l'ingrédient en base (`vegetable`, `alcohol`…), si connue.
 * @returns `false` uniquement pour les catégories qui ne se taillent jamais.
 */
export function isCuttableCategory(category?: string | null): boolean {
  return !category || !UNCUTTABLE_CATEGORIES.has(category);
}

/**
 * Découpes à proposer en premier pour un ingrédient : celles qu'on lui applique
 * d'habitude (d'après son nom, sinon sa catégorie en base), la découpe déjà posée
 * toujours en tête pour rester visible. Les autres formes restent accessibles à part.
 *
 * @param name - Nom de l'ingrédient (« oignon rouge »).
 * @param category - Catégorie de l'ingrédient en base (`vegetable`, `herbs`…), si connue.
 * @param current - Forme actuellement choisie, si elle existe.
 * @returns Au plus {@link MAX_SUGGESTIONS} formes, sans doublon (plus la forme courante).
 */
export function cutShortlist(name: string | null | undefined, category?: string | null, current?: FormeDecoupe | null): FormeDecoupe[] {
  const words = normalizeStr(name).replace(/['’-]/g, " ").replace(/\s+/g, " ");
  const byName = words ? BY_NAME.find(([keys]) => keys.some((key) => nameHas(words, key)))?.[1] : undefined;
  const base = (byName ?? BY_CATEGORY[category ?? ""] ?? DEFAULT_SHORTLIST).slice(0, MAX_SUGGESTIONS);
  return current && !base.includes(current) ? [current, ...base] : base;
}

/**
 * Repère de taille lisible pour une découpe posée (« environ 1 cm », « râpe fine »).
 *
 * @param forme - La forme choisie.
 * @param calibre - Le calibre choisi, s'il y en a un.
 * @returns Le repère, ou `""` sans calibre ou pour une forme sans tailles.
 */
export function cutSizeLabel(forme: FormeDecoupe, calibre?: Calibre | null): string {
  const size = calibre ? CUT_GUIDE[forme].sizes?.[calibre] : undefined;
  if (!size) return "";
  return /\d/.test(size) ? `environ ${size}` : size;
}
