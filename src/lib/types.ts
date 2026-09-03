/**
 * Types de domaine partagés. Vocabulaire commun (recette, ligne d'ingrédient,
 * ustensile, étape, planning…) mutualisé par les modules de `lib`, pour éviter que
 * chacun redéclare sa propre variante. Les types sont volontairement PERMISSIFS
 * (champs optionnels, `id?`) : c'est le socle le plus large ; un module qui a besoin
 * d'une contrainte plus forte l'exprime par intersection (`Recipe & { id: string }`).
 *
 * @module types
 */

/** Rendement d'une préparation de base (« pour 500 g », « pour 2 pots »…). */
export interface RecipeYield {
  amount?: number | string;
  unit?: string;
}

/**
 * Forme de découpe canonique d'un légume (vocabulaire fermé). Sert de clé de
 * regroupement pour la mise en place ; les formulations libres d'une recette y sont
 * ramenées à l'import (cf. `parseCut` dans `recipes/decoupe`).
 */
export type FormeDecoupe =
  | "emince"
  | "cisele"
  | "des"
  | "brunoise"
  | "mirepoix"
  | "paysanne"
  | "julienne"
  | "batonnet"
  | "rondelle"
  | "troncon"
  | "quartier"
  | "rape"
  | "hache"
  | "chiffonade";

/** Calibre grossier d'une découpe (pas de millimètres : inexploitable et source d'hallucination LLM). */
export type Calibre = "fin" | "moyen" | "gros";

/** Découpe d'une ligne d'ingrédient. `calibre` optionnel ; absent = non précisé. */
export interface Cut {
  forme: FormeDecoupe;
  calibre?: Calibre;
}

/**
 * Ligne d'ingrédient d'une recette. Soit brute (`dbId` → base d'ingrédients), soit
 * référence à une préparation de base (`recipeId`). `amount` tolère la chaîne (saisie).
 */
export interface IngredientLine {
  id?: string;
  name?: string;
  amount?: number | string;
  unit?: string;
  dbId?: string;
  recipeId?: string;
  image?: string;
  /** Libellé de la section/groupe (« Pour la pâte »). Vide/absent = section principale. */
  group?: string;
  /** Découpe du légume, si la recette la précise (mise en place). Absent/`null` = non taillé ou non précisé. */
  cut?: Cut | null;
}

/** Ustensile lié à une recette (résolu à la base par `dbId`). */
export interface Utensil {
  id?: string;
  name?: string;
  dbId?: string;
}

/**
 * Ligne de la base d'ustensiles (master partagée / ajouts perso). Forme large :
 * `category` peut manquer sur d'anciennes entrées (repli « divers » à l'import).
 * `appliance`, s'il est posé, désigne un appareil connu (clé de `APPLIANCE_SCHEMAS`)
 * qui expose des réglages au niveau étape. `_ro` marque la lecture seule côté vue
 * fusionnée (non-admin).
 */
export interface UtensilDbItem {
  id: string;
  name?: string;
  image?: string;
  /** Famille d'ustensile (clé de `UTENSIL_CATEGORIES`). */
  category?: string;
  /** Appareil associé (clé de `APPLIANCE_SCHEMAS`) ; absent = ustensile simple. */
  appliance?: string;
  _ro?: boolean;
  [k: string]: unknown;
}

/** Étape de préparation, avec liaisons optionnelles vers ingrédients/ustensiles. */
export interface Step {
  id?: string;
  text?: string;
  tip?: string;
  ingredients?: string[];
  utensils?: string[];
  /**
   * Réglages d'appareils posés SUR cette étape, indexés par id d'ustensile de
   * recette (les mêmes ids que `utensils`). Additif : n'affecte pas `utensils`,
   * donc aucune migration des recettes existantes.
   */
  utensilParams?: Record<string, Record<string, unknown>>;
  /** Libellé de la section/groupe (« Pour la pâte »). Vide/absent = section principale. */
  group?: string;
}

/**
 * Recette (forme large). Socle permissif : la plupart des champs sont optionnels et
 * l'index de fin autorise les champs additionnels propres à un contexte. Les modules
 * qui exigent un `id` non nul utilisent `Recipe & { id: string }`.
 */
export interface Recipe {
  id?: string;
  name?: string;
  category?: string;
  cuisine?: string;
  isComponent?: boolean;
  ingredients?: IngredientLine[];
  utensils?: Utensil[];
  steps?: Step[];
  yield?: RecipeYield;
  servings?: number | string;
  prepTime?: number;
  cookTime?: number;
  nutriLetter?: string | null;
  healthScore?: number;
  difficulty?: number;
  difficultyOverride?: number;
  collections?: string[];
  tags?: string[];
  source?: string;
  image?: string;
  [k: string]: unknown;
}

/** Carnet de recettes (manuel ou intelligent). */
export interface Collection {
  id: string;
  name?: string;
  kind?: string;
  count?: number;
  [k: string]: unknown;
}

/** Item de planning : une recette posée sur un créneau, éventuellement dans un repas composé. */
export interface MealItem {
  recipeId?: string;
  slot?: string;
  role?: string;
  groupId?: string | null;
  portions?: number;
}

/** Planning hebdomadaire : items indexés par date ISO (`YYYY-MM-DD`). */
export type MealPlan = Record<string, MealItem[]>;

/** Élément de la base d'ingrédients (forme large, champs additionnels tolérés). */
export interface IngredientDbItem {
  id: string;
  name?: string;
  aliases?: string[];
  category?: string;
  image?: string;
  gramsPerPiece?: number;
  months?: number[];
  nutrition?: Record<string, number> & { isVegetable?: boolean };
  [k: string]: unknown;
}
