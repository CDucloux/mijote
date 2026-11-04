/**
 * Temps de découpe d'une étape, pour un cuisinier amateur. Une durée forfaitaire
 * (« 30 min ») ne dit rien : tailler un oignon en brunoise n'est pas couper trois
 * carottes en rondelles. Le temps se construit donc poste par poste :
 *
 *   pièces × (préparation + coupe de référence × facteur de forme × facteur de calibre)
 *
 * - **pièces** : la quantité ramenée à des pièces (poids moyen d'une pièce pour une
 *   quantité en grammes) ;
 * - **préparation** : éplucher, épépiner, laver, une fois par pièce ;
 * - **coupe de référence** : secondes pour émincer une pièce ;
 * - **facteur de forme** : une brunoise coûte bien plus qu'un tronçon.
 *
 * S'ajoutent la mise en route (sortir planche et couteau) et un changement de bol
 * par poste. Les valeurs sont des ordres de grandeur d'amateur appliqué, pas de
 * commis : mieux vaut un planning un peu large qu'un planning qu'on ne tient pas.
 *
 * @module planning/cutTiming
 */
import type { Calibre, FormeDecoupe, IngredientLine, Recipe } from "@/lib/types.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { buildPostesDecoupe, findDecoupeStepIndex, formeInText, mentionsCutGesture, parseCut } from "@/lib/recipes/decoupe.js";

/** Profil de découpe d'un ingrédient. */
export interface CutProfile {
  /** Poids moyen d'une pièce (g), pour convertir une quantité en grammes. */
  grams: number;
  /** Secondes pour émincer une pièce (forme de référence). */
  cut: number;
  /** Secondes de préparation par pièce (éplucher, épépiner, laver). */
  prep: number;
}

/** Ingrédient sans profil connu : un légume moyen. */
export const DEFAULT_CUT_PROFILE: CutProfile = { grams: 100, cut: 40, prep: 10 };

/** Singulier approché d'un mot normalisé (« oignons » → « oignon »), appliqué des deux côtés. */
const singular = (word: string): string => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word);

const MEAT: CutProfile = { grams: 100, cut: 30, prep: 5 };
const HERBS: CutProfile = { grams: 30, cut: 60, prep: 30 };
const CHEESE: CutProfile = { grams: 100, cut: 150, prep: 0 };

/** Profils par nom (singulier, sans accent), les noms composés avant leur tête. */
const PROFILES: [string, CutProfile][] = ([
  ["pomme de terre", { grams: 180, cut: 50, prep: 35 }],
  ["patate douce", { grams: 300, cut: 70, prep: 40 }],
  ["oignon", { grams: 150, cut: 70, prep: 30 }],
  ["echalote", { grams: 40, cut: 45, prep: 25 }],
  ["ail", { grams: 5, cut: 15, prep: 15 }],
  ["gingembre", { grams: 30, cut: 40, prep: 20 }],
  ["carotte", { grams: 120, cut: 50, prep: 20 }],
  ["navet", { grams: 150, cut: 55, prep: 30 }],
  ["panais", { grams: 150, cut: 55, prep: 25 }],
  ["celeri rave", { grams: 600, cut: 180, prep: 90 }],
  ["celeri", { grams: 50, cut: 35, prep: 10 }],
  ["poireau", { grams: 200, cut: 60, prep: 30 }],
  ["courgette", { grams: 250, cut: 60, prep: 5 }],
  ["aubergine", { grams: 300, cut: 80, prep: 5 }],
  ["poivron", { grams: 180, cut: 70, prep: 25 }],
  ["piment", { grams: 10, cut: 20, prep: 15 }],
  ["tomate cerise", { grams: 15, cut: 6, prep: 2 }],
  ["tomate", { grams: 120, cut: 35, prep: 10 }],
  ["concombre", { grams: 300, cut: 50, prep: 15 }],
  ["champignon", { grams: 20, cut: 10, prep: 5 }],
  ["fenouil", { grams: 250, cut: 60, prep: 15 }],
  ["chou fleur", { grams: 800, cut: 150, prep: 60 }],
  ["brocoli", { grams: 400, cut: 90, prep: 30 }],
  ["chou", { grams: 1000, cut: 300, prep: 60 }],
  ["butternut", { grams: 1000, cut: 300, prep: 180 }],
  ["potiron", { grams: 1000, cut: 300, prep: 180 }],
  ["courge", { grams: 1000, cut: 300, prep: 180 }],
  ["betterave", { grams: 150, cut: 50, prep: 30 }],
  ["radis", { grams: 15, cut: 6, prep: 4 }],
  ["avocat", { grams: 200, cut: 30, prep: 30 }],
  ["mangue", { grams: 350, cut: 60, prep: 60 }],
  ["ananas", { grams: 1000, cut: 150, prep: 120 }],
  ["pomme", { grams: 170, cut: 45, prep: 25 }],
  ["poire", { grams: 170, cut: 45, prep: 25 }],
  ["citron", { grams: 120, cut: 20, prep: 5 }],
  ["orange", { grams: 200, cut: 30, prep: 20 }],
  ["mozzarella", { grams: 125, cut: 50, prep: 0 }],
  ...["persil", "coriandre", "basilic", "menthe", "ciboulette", "aneth", "estragon", "cerfeuil", "sauge", "romarin", "thym"]
    .map((herb): [string, CutProfile] => [herb, HERBS]),
  ...["parmesan", "pecorino", "gruyere", "comte", "emmental", "fromage"].map((cheese): [string, CutProfile] => [cheese, CHEESE]),
  ...["poulet", "volaille", "boeuf", "veau", "porc", "agneau", "dinde", "canard", "jambon", "saumon", "cabillaud", "poisson", "thon", "viande", "chorizo"]
    .map((meat): [string, CutProfile] => [meat, MEAT]),
] satisfies [string, CutProfile][])
  .map(([key, profile]): [string, CutProfile] => [key.split(" ").map(word => singular(word)).join(" "), profile])
  .sort(([a], [b]) => b.length - a.length);

/** Coût d'une forme rapporté à l'émincé (1). */
export const FORME_FACTOR: Record<FormeDecoupe, number> = {
  quartier: 0.3, troncon: 0.4, rondelle: 0.6, rape: 0.6, concasse: 0.7,
  lamelle: 0.9, mirepoix: 0.9, emince: 1, chiffonade: 1, batonnet: 1.1,
  paysanne: 1.1, des: 1.2, hache: 1.2, cisele: 1.4, julienne: 1.8, brunoise: 2.5,
};

const CALIBRE_FACTOR: Record<Calibre, number> = { fin: 1.25, moyen: 1, gros: 0.8 };

/** Mise en route d'une étape de découpe : planche, couteau, bol. */
export const CUT_SETUP_SECONDS = 60;
/** Changement de poste (bol de réserve, rinçage de la planche). */
export const CUT_SWITCH_SECONDS = 15;

/** Unités qui comptent des pièces. */
const PIECE_UNITS = new Set(["", "piece", "pieces", "gousse", "gousses", "branche", "branches", "botte", "bottes", "bouquet", "bouquets", "tranche", "tranches", "feuille", "feuilles", "tige", "tiges"]);
const GRAM_FACTOR: Record<string, number> = { g: 1, gr: 1, gramme: 1, grammes: 1, kg: 1000 };

/** Un poste à découper : un ingrédient, sa quantité et son geste. */
export interface CutTask {
  name: string;
  amount: number | null;
  unit: string;
  forme: FormeDecoupe;
  calibre?: Calibre | null;
}

/**
 * Profil de découpe d'un ingrédient d'après son nom (pluriel et accents tolérés).
 *
 * @param name - Nom de l'ingrédient (« Oignons jaunes »).
 * @returns Son profil, ou `null` s'il n'est pas connu.
 */
export function cutProfileOf(name: string | null | undefined): CutProfile | null {
  const words = ` ${normalizeStr(name).split(/[^a-z0-9]+/).filter(Boolean).map(singular).join(" ")} `;
  return PROFILES.find(([key]) => words.includes(` ${key} `))?.[1] ?? null;
}

/**
 * Nombre de pièces à découper : la quantité telle quelle quand elle compte des
 * pièces (gousses, branches…), ramenée au poids moyen d'une pièce quand elle est en
 * grammes, une demi-pièce pour une mesure de volume (« 2 c. à soupe de persil »).
 *
 * @param task - Le poste (quantité, unité, nom).
 * @returns Les pièces, entre 0,25 et 50 (une quantité absente compte pour une).
 */
export function cutPieces(task: Pick<CutTask, "name" | "amount" | "unit">): number {
  if (task.amount == null || !(task.amount > 0)) return 1;
  const unit = normalizeStr(task.unit).replace(/\.$/, "");
  const grams = GRAM_FACTOR[unit];
  const pieces = PIECE_UNITS.has(unit) ? task.amount
    : grams ? (task.amount * grams) / (cutProfileOf(task.name) ?? DEFAULT_CUT_PROFILE).grams
    : 0.5;
  return Math.min(Math.max(pieces, 0.25), 50);
}

/**
 * Secondes pour découper un poste, mise en route d'étape non comprise.
 *
 * @param task - Le poste.
 * @returns Les secondes, préparation (épluchage) comprise.
 */
export function cutSeconds(task: CutTask): number {
  const profile = cutProfileOf(task.name) ?? DEFAULT_CUT_PROFILE;
  const factor = FORME_FACTOR[task.forme] * (task.calibre ? CALIBRE_FACTOR[task.calibre] : 1);
  return cutPieces(task) * (profile.prep + profile.cut * factor);
}

/**
 * Minutes d'une étape de découpe : mise en route, un changement par poste, puis
 * chaque poste.
 *
 * @param tasks - Les postes découpés à cette étape.
 * @returns Les minutes (arrondies à la minute supérieure), 0 sans poste.
 */
export function cutStepMinutes(tasks: readonly CutTask[]): number {
  if (!tasks.length) return 0;
  const seconds = CUT_SETUP_SECONDS + tasks.length * CUT_SWITCH_SECONDS + tasks.reduce((sum, task) => sum + cutSeconds(task), 0);
  return Math.ceil(seconds / 60);
}

const amountOf = (value: IngredientLine["amount"]): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Minutes de découpe de chaque étape d'une recette. Les postes structurés (lignes
 * portant une découpe) sont rattachés à l'étape qui les décrit ; une étape qui
 * nomme un geste de découpe sans poste rattaché se rabat sur ses ingrédients
 * liés de profil connu (jamais le beurre ni la farine), avec la forme lue dans
 * son texte (émincé par défaut).
 *
 * @param recipe - Les ingrédients et les étapes.
 * @returns Par étape, les minutes de découpe, ou `null` si l'étape ne découpe rien.
 */
export function recipeCutMinutes(recipe: Pick<Recipe, "ingredients" | "steps">): (number | null)[] {
  const ingredients = recipe.ingredients ?? [];
  const steps = recipe.steps ?? [];
  const byStep = steps.map((): CutTask[] => []);
  for (const poste of buildPostesDecoupe(ingredients)) {
    const index = findDecoupeStepIndex(poste, ingredients, steps);
    if (index >= 0) byStep[index].push({ name: poste.name, amount: poste.amount, unit: poste.unit, forme: poste.forme, calibre: poste.calibre });
  }
  const byId = new Map(ingredients.map(line => [line.id, line]));
  return steps.map((step, index) => {
    let tasks = byStep[index];
    if (!tasks.length && mentionsCutGesture(step.text)) {
      const forme = formeInText(step.text) ?? "emince";
      tasks = (step.ingredients ?? []).flatMap(id => {
        const line = byId.get(id);
        if (!line?.name || !cutProfileOf(line.name)) return [];
        const cut = parseCut(line.cut);
        return [{ name: line.name, amount: amountOf(line.amount), unit: line.unit ?? "", forme: cut?.forme ?? forme, calibre: cut?.calibre }];
      });
    }
    return tasks.length ? cutStepMinutes(tasks) : null;
  });
}
