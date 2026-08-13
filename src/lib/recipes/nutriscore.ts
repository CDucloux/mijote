/**
 * Score santé (Nutri-Score, algorithme 2023, aliments généraux). On agrège les
 * nutriments de TOUTE la recette ramenés à 100 g de plat fini, on calcule un
 * unique Nutri-Score, puis on le mappe sur l'échelle 0–100 du ring.
 *
 * @module nutriscore
 */

import type { IngredientLine } from "@/lib/types.js";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { isFruitVeg } from "@/constants/categories.js";

/** Nutriments pour 100 g (`isVegetable` est traité comme drapeau numérique). */
type Nutrition = Record<string, number>;
/** Entrée de base minimale exploitée pour le calcul. */
interface DbItem { id: string; category?: string; gramsPerPiece?: number; nutrition?: Nutrition }

/**
 * L'ingrédient compte-t-il dans la composante « fruits & légumes » du Nutri-Score ?
 * On dérive de la CATÉGORIE (source de vérité, robuste aux fiches enregistrées avant
 * l'inclusion des fruits) avec repli sur le drapeau figé `nutrition.isVegetable`.
 */
const countsAsFruitVeg = (di: DbItem): boolean => isFruitVeg(di.category) || !!di.nutrition?.isVegetable;
/** Recette (utilisée comme composant : rendement + ingrédients bruts). */
interface NutriRecipe { id?: string; ingredients?: IngredientLine[]; yield?: { amount?: number; unit?: string } }
type RecipeIndex = Map<string, NutriRecipe> | null | undefined;
/** Poids d'une unité en grammes ; l'objet marque une unité « à la pièce ». */
type UnitEntry = number | { g: number; piece: true };

/** Résultat compact du Nutri-Score. */
export interface NutriInfo { score: number; letter: "A" | "B" | "C" | "D" | "E" | null }

/** Tables de seuils par 100 g : {@link nsPoints} renvoie l'index du 1er seuil non dépassé. */
const NS_ENERGY = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];                 // kJ → 0..10
const NS_SUGAR = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];              // g  → 0..15
const NS_SATFAT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];                                            // g  → 0..10
const NS_SALT = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.4, 3.8, 4.2, 4.6, 5]; // g → 0..20
const NS_FIBER = [3.0, 4.1, 5.2, 6.3, 7.4];                                                   // g  → 0..5
const NS_PROT = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];                                             // g  → 0..7

/** Index du 1er seuil non dépassé (points Nutri-Score d'une valeur pour 100 g). */
function nsPoints(value: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return i;
  return thresholds.length;
}

/**
 * Mappe le Nutri-Score brut (négatif = sain) sur 0–100, paliers alignés sur les
 * lettres A–E et les couleurs du ring.
 */
function nutriToScore100(ns: number): number {
  const pts: [number, number][] = [[-7, 100], [0, 80], [2, 70], [10, 50], [18, 30], [28, 0]];
  if (ns <= pts[0][0]) return 100;
  if (ns >= pts[pts.length - 1][0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    if (ns <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return Math.round(y0 + (y1 - y0) * (ns - x0) / (x1 - x0));
    }
  }
  return 0;
}

/**
 * Conversion d'unité vers des grammes (approximations culinaires). Les entrées
 * objet marquent les unités « à la pièce » : on privilégie le `gramsPerPiece` de
 * l'ingrédient, sinon `g` fait défaut.
 */
export const UNIT_GRAMS: Record<string, UnitEntry> = {
  "mg": 0.001, "g": 1, "kg": 1000,
  "ml": 1, "cl": 10, "dl": 100, "l": 1000, "litre": 1000, "litres": 1000,
  "cuillère à soupe": 15, "cuillères à soupe": 15, "c. à soupe": 15, "c.à.s": 15,
  "cuillère à café": 5, "cuillères à café": 5, "c. à café": 5, "c.à.c": 5,
  "pincée": 0.4, "pincées": 0.4,
  "verre": 200, "verres": 200, "tasse": 200, "tasses": 200, "bol": 350, "bols": 350,
  "pièce": { g: 100, piece: true }, "pièces": { g: 100, piece: true }, "pce": { g: 100, piece: true }, "pc": { g: 100, piece: true },
  "tranche": { g: 25, piece: true }, "tranches": { g: 25, piece: true },
  "gousse": { g: 5, piece: true }, "gousses": { g: 5, piece: true },
  "botte": { g: 100, piece: true }, "bottes": { g: 100, piece: true },
  "sachet": { g: 10, piece: true }, "sachets": { g: 10, piece: true },
  "feuille": { g: 2, piece: true }, "feuilles": { g: 2, piece: true },
  "branche": { g: 5, piece: true }, "branches": { g: 5, piece: true },
  "poignée": { g: 30, piece: true }, "poignées": { g: 30, piece: true },
  "boîte": { g: 400, piece: true }, "boîtes": { g: 400, piece: true },
  "pot": { g: 125, piece: true }, "pots": { g: 125, piece: true },
};

/**
 * Masse en grammes d'une ligne d'ingrédient.
 *
 * @param recipeIng - La ligne d'ingrédient (quantité + unité).
 * @param dbItem - L'ingrédient de la base (pour `gramsPerPiece` des unités « à la pièce »).
 * @returns La masse en grammes (au moins 1).
 */
export function ingredientGrams(recipeIng: IngredientLine, dbItem?: DbItem): number {
  const amount = parseFloat(String(recipeIng.amount).replace(",", ".")) || 1;
  const unit = (recipeIng.unit || "").trim().toLowerCase();
  const entry = UNIT_GRAMS[unit];
  let perUnit: number;
  // Unité vide/inconnue (« 2 avocats », « 1 citron vert ») : un nombre nu dénombre
  // des PIÈCES dès que l'ingrédient a un poids à la pièce, sinon on retombe sur des
  // grammes. Sans ce repli, « 2 avocats » valait 2 g et faussait tout le calcul.
  if (entry == null) perUnit = dbItem?.gramsPerPiece || 1;
  else if (typeof entry === "object") perUnit = dbItem?.gramsPerPiece || entry.g; // pièce : poids spécifique sinon défaut
  else perUnit = entry;
  return Math.max(amount * perUnit, 1);
}

// ─── COMPOSANTS (préparations de base) ───────────────────────────────────────
// Composition mono-niveau (un composant ne contient que des ingrédients bruts) →
// pas de cycle possible.
const num = (v: unknown): number => parseFloat(String(v).replace(",", ".")) || 0;

/**
 * Une ligne référence-t-elle un composant (préparation de base) ?
 *
 * @param line - La ligne d'ingrédient.
 * @returns `true` si elle porte un `recipeId` sans `dbId`.
 */
export const isComponentLine = (line: IngredientLine | null | undefined): boolean => !!line && !!line.recipeId && !line.dbId;

/**
 * Indexe des recettes par id (pour résoudre les composants).
 *
 * @param recipes - Les recettes à indexer.
 * @returns Une map id → recette (recettes sans id ignorées).
 */
export const buildRecipeIndex = (recipes: NutriRecipe[] | null | undefined): Map<string, NutriRecipe> =>
  new Map((recipes || []).filter((r): r is NutriRecipe & { id: string } => !!r.id).map(r => [r.id, r]));

/**
 * Résout l'entrée de base d'une ligne d'ingrédient BRUTE. Le `dbId` stocké est un
 * instantané figé à l'enregistrement : si l'ingrédient n'était pas encore dans la
 * base à ce moment-là, il est vide. On retombe alors sur un appariement par NOM
 * (comme l'image, la saison et le stock côté fiche), pour que la nutrition tienne
 * compte des ingrédients appariés après coup, sans devoir ré-enregistrer.
 */
function dbItemFor(line: IngredientLine, ingredientDB: DbItem[]): DbItem | undefined {
  if (line.dbId) {
    const byId = ingredientDB.find(d => d.id === line.dbId);
    if (byId) return byId;
  }
  // `findIngredientMatch` type sa base avec `name` requis ; notre `DbItem` (calcul)
  // ne modélise que id/nutrition. La base réelle porte `name` → cast sûr.
  return line.name ? (findIngredientMatch(line.name, ingredientDB as unknown as Parameters<typeof findIngredientMatch>[1]) as DbItem | null) ?? undefined : undefined;
}

interface RawAgg { tot: Record<string, number>; mass: number; covered: number; vegMass: number }

/** Agrège les ingrédients BRUTS d'une liste (ignore les sous-références composant). */
function aggregateRaw(ingredients: IngredientLine[] | undefined, ingredientDB: DbItem[], keys: readonly string[], wantVeg: boolean): RawAgg {
  const tot: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  let mass = 0, covered = 0, vegMass = 0;
  for (const ci of ingredients || []) {
    if (!ci || ci.recipeId) continue;
    const di = dbItemFor(ci, ingredientDB);
    if (!di) continue;
    const cm = ingredientGrams(ci, di);
    mass += cm;
    if (di.nutrition) {
      for (const k of keys) tot[k] += (di.nutrition[k] || 0) * cm / 100;
      covered += cm;
      if (wantVeg && countsAsFruitVeg(di)) vegMass += cm;
    }
  }
  return { tot, mass, covered, vegMass };
}

interface ComponentAdd { totAdd: Record<string, number>; massAdd: number; coveredAdd: number; vegAdd: number }

/**
 * Contribution nutritionnelle d'une ligne composant à sa recette parente. La
 * réduction est reflétée : nutriments = totaux bruts × fraction, répartis sur la
 * masse FINIE → densité ↑.
 */
function componentContribution(line: IngredientLine, recipesById: RecipeIndex, ingredientDB: DbItem[], keys: readonly string[], wantVeg: boolean): ComponentAdd | null {
  const comp = line.recipeId ? recipesById?.get(line.recipeId) : null;
  const yieldAmount = comp?.yield?.amount;
  if (!comp || !yieldAmount || yieldAmount <= 0) return null; // orphelin / rendement inconnu → ignoré
  const f = num(line.amount) / yieldAmount;
  const agg = aggregateRaw(comp.ingredients, ingredientDB, keys, wantVeg);
  const unit = (comp.yield?.unit || "g").toLowerCase();
  const finished = (unit === "g" || unit === "ml") ? num(line.amount) : f * agg.mass;
  const covFrac = agg.mass ? agg.covered / agg.mass : 0;
  const vegFrac = agg.mass ? agg.vegMass / agg.mass : 0;
  const totAdd: Record<string, number> = Object.fromEntries(keys.map(k => [k, agg.tot[k] * f]));
  return { totAdd, massAdd: finished, coveredAdd: finished * covFrac, vegAdd: finished * vegFrac };
}

const NS_KEYS = ["calories", "sugar", "saturatedFat", "salt", "fiber", "protein"] as const;

/**
 * Nutri-Score complet d'une recette (score 0–100 + lettre A–E).
 *
 * @param ingredients - Les lignes d'ingrédients (brutes + composants).
 * @param ingredientDB - La base d'ingrédients (valeurs nutritionnelles).
 * @param recipesById - Index des recettes (résolution des composants).
 * @returns `{ score, letter }` (score 50 / lettre `null` si aucun ingrédient).
 */
export function computeNutriInfo(ingredients: IngredientLine[] | null | undefined, ingredientDB: DbItem[], recipesById?: RecipeIndex): NutriInfo {
  const raw = nutriRaw(ingredients, ingredientDB, recipesById);
  return raw ? { score: raw.score, letter: raw.letter } : { score: 50, letter: null };
}

/** Une composante du calcul (une ligne : valeur pour 100 g → points). */
export interface NutriComponent {
  key: string;
  label: string;
  value: number;   // valeur pour 100 g (ou % pour « fruits & légumes »)
  unit: string;
  pts: number;
  max: number;     // points max de la composante (pour dimensionner une jauge)
  counted?: boolean; // faux quand la composante est neutralisée (protéines exclues)
}

/** Détail complet du calcul Nutri-Score (traçabilité, réservé aux abonnés). */
export interface NutriBreakdown {
  negatives: NutriComponent[];
  N: number;
  positives: NutriComponent[];
  P: number;
  ns: number;
  score: number;
  letter: NonNullable<NutriInfo["letter"]>;
}

/**
 * Calcul BRUT et détaillé du Nutri-Score (accumulation partagée avec
 * {@link computeNutriInfo}). Renvoie `null` si aucune donnée exploitable.
 */
function nutriRaw(ingredients: IngredientLine[] | null | undefined, ingredientDB: DbItem[], recipesById?: RecipeIndex): NutriBreakdown | null {
  if (!ingredients || ingredients.length === 0) return null;
  let mass = 0, vegMass = 0;
  const tot: Record<string, number> = { calories: 0, sugar: 0, saturatedFat: 0, salt: 0, fiber: 0, protein: 0 };
  for (const recipeIng of ingredients) {
    if (isComponentLine(recipeIng)) {
      const c = componentContribution(recipeIng, recipesById, ingredientDB, NS_KEYS, true);
      if (!c) continue;
      for (const k of NS_KEYS) tot[k] += c.totAdd[k];
      vegMass += c.vegAdd;
      mass += c.coveredAdd;
      continue;
    }
    const dbItem = dbItemFor(recipeIng, ingredientDB);
    if (!dbItem || !dbItem.nutrition) continue;
    const m = ingredientGrams(recipeIng, dbItem);
    const n = dbItem.nutrition;
    tot.calories += (n.calories || 0) * m / 100;
    tot.sugar += (n.sugar || 0) * m / 100;
    tot.saturatedFat += (n.saturatedFat || 0) * m / 100;
    tot.salt += (n.salt || 0) * m / 100;
    tot.fiber += (n.fiber || 0) * m / 100;
    tot.protein += (n.protein || 0) * m / 100;
    if (countsAsFruitVeg(dbItem)) vegMass += m;
    mass += m;
  }
  if (mass === 0) return null;
  const per100 = (k: string): number => tot[k] / mass * 100;
  // Points négatifs (énergie en kJ, sucres, AG saturés, sel).
  const energyKJ = per100("calories") * 4.184;
  const nEnergy = nsPoints(energyKJ, NS_ENERGY);
  const nSugar = nsPoints(per100("sugar"), NS_SUGAR);
  const nSat = nsPoints(per100("saturatedFat"), NS_SATFAT);
  const nSalt = nsPoints(per100("salt"), NS_SALT);
  const N = nEnergy + nSugar + nSat + nSalt;
  // Points positifs (part de végétaux, fibres, protéines).
  const vegFrac = vegMass / mass * 100;
  const vegPts = vegFrac > 80 ? 5 : vegFrac > 60 ? 2 : vegFrac > 40 ? 1 : 0;
  const fiberPts = nsPoints(per100("fiber"), NS_FIBER);
  const proteinPts = nsPoints(per100("protein"), NS_PROT);
  // Règle Nutri-Score : si N≥11 et part de végétaux < 5 pts, les protéines ne comptent pas.
  const proteinCounted = !(N >= 11 && vegPts < 5);
  const P = vegPts + fiberPts + (proteinCounted ? proteinPts : 0);
  const ns = N - P;
  const letter: NutriBreakdown["letter"] = ns <= -1 ? "A" : ns <= 2 ? "B" : ns <= 10 ? "C" : ns <= 18 ? "D" : "E";
  return {
    negatives: [
      { key: "energy", label: "Énergie", value: Math.round(energyKJ), unit: "kJ", pts: nEnergy, max: 10 },
      { key: "sugar", label: "Sucres", value: per100("sugar"), unit: "g", pts: nSugar, max: 15 },
      { key: "satfat", label: "Acides gras saturés", value: per100("saturatedFat"), unit: "g", pts: nSat, max: 10 },
      { key: "salt", label: "Sel", value: per100("salt"), unit: "g", pts: nSalt, max: 20 },
    ],
    N,
    positives: [
      { key: "fruitveg", label: "Fruits & légumes", value: Math.round(vegFrac), unit: "%", pts: vegPts, max: 5 },
      { key: "fiber", label: "Fibres", value: per100("fiber"), unit: "g", pts: fiberPts, max: 5 },
      { key: "protein", label: "Protéines", value: per100("protein"), unit: "g", pts: proteinPts, max: 7, counted: proteinCounted },
    ],
    P,
    ns,
    score: nutriToScore100(ns),
    letter,
  };
}

/**
 * Détail complet du calcul Nutri-Score d'une recette (pour la traçabilité).
 *
 * @param ingredients - Les lignes d'ingrédients (brutes + composants).
 * @param ingredientDB - La base d'ingrédients.
 * @param recipesById - Index des recettes (composants).
 * @returns Le détail ({@link NutriBreakdown}) ou `null` si aucune donnée.
 */
export function computeNutriBreakdown(ingredients: IngredientLine[] | null | undefined, ingredientDB: DbItem[], recipesById?: RecipeIndex): NutriBreakdown | null {
  return nutriRaw(ingredients, ingredientDB, recipesById);
}

/**
 * Raccourci : uniquement le score santé 0–100.
 *
 * @param ingredients - Les lignes d'ingrédients.
 * @param ingredientDB - La base d'ingrédients.
 * @param recipesById - Index des recettes (composants).
 * @returns Le score santé 0–100.
 */
export function computeHealthScore(ingredients: IngredientLine[] | null | undefined, ingredientDB: DbItem[], recipesById?: RecipeIndex): number {
  return computeNutriInfo(ingredients, ingredientDB, recipesById).score;
}

const NUTRI_KEYS = ["calories", "protein", "carbs", "sugar", "fat", "saturatedFat", "omega3", "fiber", "salt"] as const;

/** Détail nutritionnel d'une recette. */
export interface NutritionDetail {
  totals: Record<string, number>;
  perServing: Record<string, number>;
  per100: Record<string, number>;
  mass: number;
  covered: number;
  /** Part de la masse (ingrédients reconnus) disposant réellement de données. */
  coverage: number;
}

/**
 * Agrégation nutritionnelle complète : totaux, par portion et pour 100 g de plat
 * fini. `coverage` renseigne la fiabilité (part de masse couverte par des données).
 *
 * @param ingredients - Les lignes d'ingrédients (brutes + composants).
 * @param ingredientDB - La base d'ingrédients.
 * @param servings - Nombre de portions (pour le détail par portion).
 * @param recipesById - Index des recettes (composants).
 * @returns Le détail nutritionnel (totaux, par portion, pour 100 g, masse, couverture).
 */
export function computeNutritionDetail(ingredients: IngredientLine[] | null | undefined, ingredientDB: DbItem[], servings: number, recipesById?: RecipeIndex): NutritionDetail {
  const tot: Record<string, number> = Object.fromEntries(NUTRI_KEYS.map(k => [k, 0]));
  let mass = 0, covered = 0;
  for (const recipeIng of ingredients || []) {
    if (isComponentLine(recipeIng)) {
      const c = componentContribution(recipeIng, recipesById, ingredientDB, NUTRI_KEYS, false);
      if (!c) continue;
      for (const k of NUTRI_KEYS) tot[k] += c.totAdd[k];
      mass += c.massAdd;
      covered += c.coveredAdd;
      continue;
    }
    const dbItem = dbItemFor(recipeIng, ingredientDB);
    if (!dbItem) continue;
    const m = ingredientGrams(recipeIng, dbItem);
    mass += m;
    if (dbItem.nutrition) {
      const n = dbItem.nutrition;
      for (const k of NUTRI_KEYS) tot[k] += (n[k] || 0) * m / 100;
      covered += m;
    }
  }
  const s = Math.max(1, servings || 1);
  const perServing: Record<string, number> = Object.fromEntries(NUTRI_KEYS.map(k => [k, tot[k] / s]));
  const per100: Record<string, number> = Object.fromEntries(NUTRI_KEYS.map(k => [k, covered ? tot[k] / covered * 100 : 0]));
  return { totals: tot, perServing, per100, mass, covered, coverage: mass ? covered / mass : 0 };
}
