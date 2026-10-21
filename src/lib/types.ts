/**
 * Types de domaine partagés. Vocabulaire commun (recette, ligne d'ingrédient,
 * ustensile, étape, planning…) mutualisé par les modules de `lib`, pour éviter que
 * chacun redéclare sa propre variante. Les types sont volontairement PERMISSIFS
 * (champs optionnels, `id?`) : c'est le socle le plus large ; un module qui a besoin
 * d'une contrainte plus forte l'exprime par intersection (`Recipe & { id: string }`).
 *
 * @module types
 */
import type { RecipeFilters } from "@/lib/recipes/recipeFilters.js";

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
  | "lamelle"
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

/**
 * Forme d'approvisionnement / conservation d'un ingrédient (vocabulaire fermé).
 * Sert de base à la recommandation qualité (« privilégier frais ou surgelé »).
 * Distinct de {@link FormeDecoupe} (découpe) : ici on parle du produit acheté.
 */
export type IngredientForm =
  | "fresh"
  | "frozen"
  | "canned"
  | "jarred"
  | "dried";

/**
 * Recommandation culinaire, ingrédient par ingrédient, sur la forme à privilégier
 * à l'achat (pas une règle nutritionnelle). Optionnelle : la majorité des ingrédients
 * n'en portent pas. `message` éditorialise ; à défaut on dérive un libellé des formes.
 */
export interface QualityRecommendation {
  preferredForms: IngredientForm[];
  message?: string;
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
  /** Précaution d'utilisation éditoriale (chaleur, revêtement…) ; absent = rien à signaler. */
  usagePrecaution?: UsagePrecaution;
  [k: string]: unknown;
}

/**
 * Tonalité d'une précaution d'utilisation : conseil neutre, conseil de cuisson lié
 * à la chaleur, ou véritable attention. Pilote l'icône/couleur d'affichage : toutes
 * les précautions ne sont pas des risques (cf. spec « ne pas tout transformer en alerte »).
 */
export type PrecautionTone = "info" | "heat" | "warning";

/**
 * Précaution d'utilisation d'un ustensile, éditorialisée directement au niveau de
 * l'ustensile (pas de moteur de règles). `tip` porte le « bon réflexe » optionnel.
 */
export interface UsagePrecaution {
  tone?: PrecautionTone;
  title: string;
  description: string;
  tip?: string;
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
  /** Photo illustrant l'étape (URL). Absente = pas de visuel pour cette étape. */
  image?: string;
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
  /** Chef ou créatrice dont la recette est tirée (« Adam Byatt »). Optionnel, texte libre. */
  chef?: string;
  image?: string;
  /** Origine d'une recette ajoutée depuis la communauté (doc public source). */
  clonedFrom?: { publicId: string; authorUid?: string; authorName?: string };
  /** Identifiant du doc public, une fois la recette publiée. */
  publicId?: string;
  [k: string]: unknown;
}

/** Recette enregistrée (bibliothèque) : toujours identifiée. */
export type SavedRecipe = Recipe & { id: string };

/** Carnet de recettes : manuel (appartenance explicite) ou intelligent (`kind: "smart"`, vue de filtres). */
export interface Collection {
  id: string;
  name?: string;
  kind?: string;
  count?: number;
  color?: string;
  /** Picto choisi par l'utilisateur (emoji). */
  icon?: string;
  /** Vue de filtres d'un carnet intelligent. */
  filters?: Partial<RecipeFilters>;
  /** Recherche d'un carnet intelligent. */
  search?: string;
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

/** Aliment de la table Ciqual d'où proviennent les valeurs nutritionnelles d'un ingrédient. */
export interface CiqualRef {
  /** Code de l'aliment dans la table (`alim_code`). */
  code: number;
  /** Nom de l'aliment dans la table, tel que publié par l'Anses. */
  name?: string;
}

/** Élément de la base d'ingrédients (forme large, champs additionnels tolérés). */
/** Valeurs nutritionnelles d'un ingrédient pour 100 g (g, sauf `calories` en kcal). */
export interface IngredientNutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  saturatedFat?: number;
  sugar?: number;
  fiber?: number;
  salt?: number;
  omega3?: number;
  /** Compte comme fruit/légume au Nutri-Score (figé depuis la catégorie). */
  isVegetable?: boolean;
  [key: string]: number | boolean | undefined;
}

/** Conseil éditorial d'un ingrédient : type (clé de `TIP_TYPES`) et texte. */
export interface IngredientTip {
  type: string;
  text: string;
}

export interface IngredientDbItem {
  id: string;
  name?: string;
  aliases?: string[];
  category?: string;
  image?: string;
  gramsPerPiece?: number;
  months?: number[];
  /** Valeurs pour 100 g ; `null` = fiche créée sans données nutritionnelles. */
  nutrition?: IngredientNutrition | null;
  /** Recommandation de forme à privilégier (frais/surgelé…) ; absent = aucune. */
  qualityRecommendation?: QualityRecommendation;
  /** Aliment Ciqual source des valeurs nutritionnelles ; absent = non tracé. */
  ciqual?: CiqualRef;
  /** Conseils de préparation, conservation, utilisation… */
  tips?: IngredientTip[];
  /** `"validated"` une fois la fiche relue ; absent = en cours de rédaction. */
  status?: string;
  /** Accroche courte (« ingrédient du moment »). */
  description?: string;
  [k: string]: unknown;
}
