/**
 * Session batch dans le temps et après : l'ordre de la découpe groupée, la session
 * calée sur une heure de début (bases d'abord, four partagé, via
 * {@link planMealService}) et le rangement de chaque repas de la semaine, frigo
 * ou congélateur selon le jour où il sera mangé.
 *
 * Règle de conservation retenue (plats cuisinés maison) : 3 jours au frigo, 2 pour
 * un plat à base de poisson ou de fruits de mer, congélateur au-delà, avec un
 * rappel de décongélation la veille.
 *
 * @module planning/batchPlan
 */
import type { Recipe } from "@/lib/types.js";
import type { PrepGroup, PrepItem } from "@/lib/planning/batchSession.js";
import { planMealService, shiftPlan, type ServicePlan } from "@/lib/planning/mealService.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

const DAY_MS = 24 * 60 * 60_000;

// ─── Découpe groupée : ordre de travail ──────────────────────────────────────

/** Étape de l'ordre de travail de la découpe. */
export type PrepStageId = "clairs" | "aromatiques" | "cru" | "autres";

/** Un temps de l'ordre de travail. */
export interface PrepStage {
  id: PrepStageId;
  label: string;
  hint: string;
  items: PrepItem[];
}

const STAGES: Record<PrepStageId, { label: string; hint: string; order: number }> = {
  clairs: { label: "Légumes clairs", hint: "rien qui parfume la planche", order: 0 },
  aromatiques: { label: "Aromatiques", hint: "en dernier sur la planche", order: 1 },
  cru: { label: "Viandes et poissons", hint: "planche à part, à la fin", order: 2 },
  autres: { label: "À râper, à peser", hint: "", order: 3 },
};

/** Ingrédients qui parfument la planche (ail, oignon…) : découpés après les autres légumes. */
const AROMATIC_RE = /\b(oignons?|ail|echalotes?|gingembre|piments?|ciboules?|cives?|poireaux?)\b/;

/** Minutes gagnées par recette en plus quand on groupe la découpe (planche, épluchage). */
export const PREP_GAIN_PER_EXTRA_RECIPE = 3;

/**
 * Temps de l'ordre de travail d'un ingrédient : légumes clairs, aromatiques
 * (herbes, ail, oignon…), viandes et poissons crus, puis le reste (fromage à râper,
 * légumineuses à rincer).
 *
 * @param item - L'ingrédient à préparer.
 * @returns Son temps dans l'ordre de travail.
 */
export function prepStageOf(item: Pick<PrepItem, "name" | "category">): PrepStageId {
  if (item.category === "herbs" || AROMATIC_RE.test(normalizeStr(item.name))) return "aromatiques";
  if (item.category === "meat" || item.category === "fish_seafood") return "cru";
  if (item.category === "vegetable" || item.category === "fruit" || item.category === "mushroom") return "clairs";
  return "autres";
}

/**
 * Range la mise en place dans l'ordre de travail. Dans chaque temps, les
 * ingrédients partagés par le plus de recettes viennent d'abord.
 *
 * @param groups - La mise en place par catégorie (cf. `buildMiseEnPlace`).
 * @returns Les temps non vides, dans l'ordre.
 */
export function prepWorkOrder(groups: PrepGroup[]): PrepStage[] {
  const byStage = new Map<PrepStageId, PrepItem[]>();
  for (const item of groups.flatMap(group => group.items)) {
    const stage = prepStageOf(item);
    byStage.set(stage, [...(byStage.get(stage) ?? []), item]);
  }
  return [...byStage.entries()]
    .sort(([a], [b]) => STAGES[a].order - STAGES[b].order)
    .map(([id, items]) => ({ id, label: STAGES[id].label, hint: STAGES[id].hint, items: items.sort((a, b) => b.usedBy.length - a.usedBy.length || a.name.localeCompare(b.name, "fr")) }));
}

/**
 * Minutes gagnées en préparant un ingrédient d'un coup pour plusieurs recettes
 * (estimation : une planche et un épluchage de moins par recette en plus).
 *
 * @param item - L'ingrédient.
 * @returns Les minutes gagnées (0 pour une seule recette).
 */
export function prepGain(item: Pick<PrepItem, "usedBy">): number {
  return Math.max(0, item.usedBy.length - 1) * PREP_GAIN_PER_EXTRA_RECIPE;
}

// ─── Session dans le temps ───────────────────────────────────────────────────

/** Un plat (ou une base) de la session à placer. */
export interface BatchCookInput {
  id: string;
  name: string;
  recipe: Pick<Recipe, "steps" | "prepTime" | "cookTime">;
  /** Une base : les plats qui la consomment. */
  feeds?: string[];
}

/**
 * Place la session batch à partir de son heure de DÉBUT : tout est calculé à
 * rebours vers une fin commune (longues cuissons tôt, bases avant les plats qui
 * les utilisent, four et mains partagés), puis le plan est décalé pour commencer
 * à l'heure dite.
 *
 * @param dishes - Les plats et les bases de la session.
 * @param options - Heure de début (ms), nombre de cuisiniers, instant présent.
 * @returns Le plan, qui commence à `startAt`.
 */
export function planBatchCooking(dishes: BatchCookInput[], options: { startAt: number; cooks?: number; now: number }): ServicePlan {
  const plan = planMealService(
    dishes.map(dish => ({ id: dish.id, name: dish.name, role: "plat", offset: 0, recipe: dish.recipe, feeds: dish.feeds })),
    { serveAt: options.startAt, cooks: options.cooks, now: options.now },
  );
  return { ...shiftPlan(plan, options.startAt - plan.start), lateBy: 0 };
}

// ─── Jours ───────────────────────────────────────────────────────────────────

const pad = (n: number): string => String(n).padStart(2, "0");
const toIso = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (iso: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

/**
 * Jour ISO décalé de `days` jours.
 *
 * @param iso - Le jour de départ, `YYYY-MM-DD`.
 * @param days - Nombre de jours (négatif : avant).
 * @returns Le jour obtenu, ou `iso` inchangé s'il est invalide.
 */
export function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Jours calendaires de `from` à `to` (ISO), `null` si l'un est invalide. */
export function daysBetween(from: string, to: string): number | null {
  const a = fromIso(from), b = fromIso(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / DAY_MS) : null;
}

/**
 * Jour de session par défaut : le dimanche qui précède la semaine affichée (qui
 * commence un lundi).
 *
 * @param weekStart - Premier jour de la semaine, `YYYY-MM-DD`.
 * @returns La veille de ce jour.
 */
export function defaultBatchDay(weekStart: string): string {
  return addDays(weekStart, -1);
}

const SHORT_DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const LONG_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Jour court et lisible : `"mer. 29"`.
 *
 * @param iso - Le jour, `YYYY-MM-DD`.
 * @returns Le libellé, ou `iso` s'il est invalide.
 */
export function shortDayLabel(iso: string): string {
  const date = fromIso(iso);
  return date ? `${SHORT_DAYS[date.getDay()]} ${date.getDate()}` : iso;
}

/**
 * Nom du jour de la semaine : `"dimanche"`.
 *
 * @param iso - Le jour, `YYYY-MM-DD`.
 * @returns Le nom, ou `""` s'il est invalide.
 */
export function weekdayName(iso: string): string {
  const date = fromIso(iso);
  return date ? LONG_DAYS[date.getDay()] : "";
}

// ─── Rangement ───────────────────────────────────────────────────────────────

/** Jours de conservation au frigo d'un plat cuisiné maison. */
export const FRIDGE_DAYS = 3;
/** Jours de conservation au frigo d'un plat à base de poisson ou de fruits de mer. */
export const FRIDGE_DAYS_FISH = 2;

/** Un repas de la semaine servi par la session. */
export interface BatchMeal {
  recipeId: string;
  date: string;
  slot: string;
}

/** Où ranger la boîte d'un repas. */
export interface StoredMeal extends BatchMeal {
  zone: "fridge" | "freezer";
  /** Pour une boîte congelée : le jour où la sortir (la veille du repas). */
  thawOn?: string;
}

/** Le rangement d'un plat. */
export interface DishStorage {
  recipeId: string;
  meals: StoredMeal[];
  /** Dernier jour au frigo. */
  fridgeUntil: string;
  fridgeDays: number;
}

/** Le rangement de toute la session. */
export interface BatchStorage {
  dishes: DishStorage[];
  fridge: number;
  freezer: number;
  /** Repas déjà passés au jour de la session (ignorés). */
  skipped: number;
}

const SLOT_ORDER: Record<string, number> = { matin: 0, midi: 1, soir: 2 };

/**
 * Range chaque repas de la semaine : frigo s'il est mangé dans les jours de
 * conservation du plat, congélateur au-delà (à sortir la veille). Un repas
 * antérieur à la session est ignoré.
 *
 * @param sessionDay - Jour de la session, `YYYY-MM-DD`.
 * @param meals - Les repas de la semaine.
 * @param isFish - Le plat est-il à base de poisson ou de fruits de mer ?
 * @returns Le rangement par plat (ordre d'apparition), et les totaux.
 */
export function planStorage(sessionDay: string, meals: BatchMeal[], isFish: (recipeId: string) => boolean): BatchStorage {
  const byDish = new Map<string, DishStorage>();
  let skipped = 0;
  const sorted = [...meals].sort((a, b) => a.date.localeCompare(b.date) || (SLOT_ORDER[a.slot] ?? 1) - (SLOT_ORDER[b.slot] ?? 1));
  for (const meal of sorted) {
    const days = daysBetween(sessionDay, meal.date);
    if (days == null || days < 0) { skipped++; continue; }
    const fridgeDays = isFish(meal.recipeId) ? FRIDGE_DAYS_FISH : FRIDGE_DAYS;
    let dish = byDish.get(meal.recipeId);
    if (!dish) { dish = { recipeId: meal.recipeId, meals: [], fridgeUntil: addDays(sessionDay, fridgeDays), fridgeDays }; byDish.set(meal.recipeId, dish); }
    dish.meals.push(days <= fridgeDays ? { ...meal, zone: "fridge" } : { ...meal, zone: "freezer", thawOn: addDays(meal.date, -1) });
  }
  const dishes = [...byDish.values()];
  const count = (zone: StoredMeal["zone"]): number => dishes.reduce((sum, dish) => sum + dish.meals.filter(meal => meal.zone === zone).length, 0);
  return { dishes, fridge: count("fridge"), freezer: count("freezer"), skipped };
}

/**
 * Zone d'un plat pour le regroupement de l'onglet « Ranger ».
 *
 * @param dish - Le rangement du plat.
 * @returns `fridge` (tout au frigo), `freezer` (tout congelé) ou `mixed`.
 */
export function storageZone(dish: Pick<DishStorage, "meals">): "fridge" | "freezer" | "mixed" {
  const zones = new Set(dish.meals.map(meal => meal.zone));
  return zones.size > 1 ? "mixed" : zones.has("freezer") ? "freezer" : "fridge";
}

/**
 * Étiquette à recopier sur une boîte : `"Chili · cuit dim. 25 · avant mer. 28"`,
 * ou `"… · congelé"` pour une boîte qui part au congélateur.
 *
 * @param name - Nom du plat.
 * @param sessionDay - Jour de la session.
 * @param dish - Le rangement du plat.
 * @returns Une ligne par boîte.
 */
export function boxLabels(name: string, sessionDay: string, dish: Pick<DishStorage, "meals" | "fridgeUntil">): string[] {
  return dish.meals.map(meal => `${name} · cuit ${shortDayLabel(sessionDay)} · ${meal.zone === "fridge" ? `avant ${shortDayLabel(dish.fridgeUntil)}` : "congelé"}`);
}

/**
 * Le plat contient-il du poisson ou des fruits de mer (conservation plus courte) ?
 *
 * @param recipe - La recette (ses lignes d'ingrédients).
 * @param categoryOf - Catégorie d'un ingrédient de la base d'après son id.
 * @returns `true` si une ligne relève de `fish_seafood`.
 */
export function recipeHasFish(recipe: Pick<Recipe, "ingredients">, categoryOf: (dbId: string) => string | undefined): boolean {
  return (recipe.ingredients ?? []).some(line => !!line.dbId && categoryOf(line.dbId) === "fish_seafood");
}

// ─── Réglages et avancement (par semaine) ────────────────────────────────────

/** Réglages et avancement d'une session, gardés par semaine. */
export interface BatchSettings {
  /** Jour de la session, `YYYY-MM-DD`. */
  day: string;
  /** Heure de début, `HH:MM`. */
  clock: string;
  cooks: number;
  /** Clés cochées (découpe, étapes, boîtes rangées). */
  checked: string[];
  done: boolean;
}

/** Heure de début par défaut d'une session. */
export const DEFAULT_BATCH_CLOCK = "14:00";
/** Nombre de semaines dont on garde les réglages. */
const KEPT_WEEKS = 8;

/**
 * Réglages d'une semaine, complétés par les valeurs par défaut (données lues dans
 * le stockage local, donc de forme non garantie).
 *
 * @param stored - Les réglages enregistrés pour la semaine, s'il y en a.
 * @param weekStart - Premier jour de la semaine, `YYYY-MM-DD`.
 * @returns Des réglages complets.
 */
export function batchSettingsFor(stored: unknown, weekStart: string): BatchSettings {
  const raw = stored && typeof stored === "object" ? stored as Record<string, unknown> : {};
  return {
    day: typeof raw.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? raw.day : defaultBatchDay(weekStart),
    clock: typeof raw.clock === "string" && /^\d{1,2}:\d{2}$/.test(raw.clock) ? raw.clock : DEFAULT_BATCH_CLOCK,
    cooks: raw.cooks === 2 ? 2 : 1,
    checked: Array.isArray(raw.checked) ? raw.checked.filter((key): key is string => typeof key === "string") : [],
    done: raw.done === true,
  };
}

/**
 * Enregistre les réglages d'une semaine en ne gardant que les semaines récentes.
 *
 * @param all - Tous les réglages enregistrés, par premier jour de semaine.
 * @param weekStart - La semaine à écrire.
 * @param settings - Ses réglages.
 * @returns La nouvelle table, limitée aux {@link KEPT_WEEKS} semaines les plus récentes.
 */
export function withBatchSettings(all: Record<string, BatchSettings>, weekStart: string, settings: BatchSettings): Record<string, BatchSettings> {
  const next = { ...all, [weekStart]: settings };
  const recent = Object.keys(next).sort().slice(-KEPT_WEEKS);
  return Object.fromEntries(recent.map(week => [week, next[week]]));
}

/**
 * Clé de case cochée d'un ingrédient de la découpe.
 *
 * @param item - L'ingrédient (sa clé de sommation).
 * @returns `"p:<clé>"`.
 */
export function prepKey(item: Pick<PrepItem, "key">): string {
  return `p:${item.key}`;
}

/**
 * Clé de case cochée d'un plat rangé.
 *
 * @param dish - Le rangement du plat.
 * @returns `"s:<recette>"`.
 */
export function storeKey(dish: Pick<DishStorage, "recipeId">): string {
  return `s:${dish.recipeId}`;
}
