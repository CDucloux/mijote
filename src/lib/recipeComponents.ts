/**
 * Composants (préparations de base) : éclatement pour les courses et utilitaires.
 * Un composant est une recette (`isComponent`) avec un rendement (`yield`). Une
 * ligne d'ingrédient le référence par `recipeId` et en consomme une quantité,
 * exprimée dans l'unité du rendement → fraction `f = consommé / rendement`.
 * v1 : composition mono-niveau (un composant ne contient que des ingrédients bruts).
 *
 * @module recipeComponents
 */
import { isComponentLine } from "./nutriscore.js";

/** Ligne d'ingrédient (brute ou référence de composant) manipulée ici. */
export interface ComponentLine {
  amount?: number | string;
  unit?: string;
  dbId?: string;
  recipeId?: string;
  name?: string;
  image?: string;
  /** Marqueur : composant référencé mais introuvable (conservé, signalé). */
  _orphan?: boolean;
}

/** Recette-composant : rendement + ingrédients bruts. */
export interface ComponentRecipe {
  id?: string;
  yield?: { amount?: number; unit?: string };
  ingredients?: ComponentLine[];
}

/** Recette pouvant référencer un composant (pour l'avertissement de suppression). */
export interface ReferencingRecipe {
  id?: string;
  name?: string;
  ingredients?: { recipeId?: string }[];
}

const num = (v: number | string | null | undefined): number => parseFloat(String(v).replace(",", ".")) || 0;

/** Fraction d'un composant consommée par une ligne parente (`0` si rendement absent). */
export function consumptionFraction(line: ComponentLine, component: ComponentRecipe | null | undefined): number {
  if (!component || !(component.yield && (component.yield.amount || 0) > 0)) return 0;
  return num(line.amount) / (component.yield!.amount as number);
}

/**
 * Recettes (non-composants) qui référencent un composant donné — pour avertir
 * avant sa suppression / son déliage.
 */
export function recipesReferencing(componentId: string, recipes: ReferencingRecipe[] | null | undefined): ReferencingRecipe[] {
  return (recipes || []).filter(r =>
    r.id !== componentId &&
    (r.ingredients || []).some(l => l.recipeId === componentId));
}

/**
 * Éclate des lignes en ingrédients BRUTS pour la liste de courses :
 * - ligne brute (`dbId`) → conservée telle quelle ;
 * - ligne composant (`recipeId`) → remplacée par ses ingrédients bruts × `f`,
 *   sauf si le composant est en stock (`stockSet`) → « déjà préparé », exclu ;
 * - composant introuvable → ligne marquée orpheline (conservée, signalée).
 */
export function flattenForShopping(
  lines: ComponentLine[] | null | undefined,
  recipesById: Map<string, ComponentRecipe> | null | undefined,
  stockSet: Set<string> | null | undefined,
): ComponentLine[] {
  const out: ComponentLine[] = [];
  for (const line of lines || []) {
    if (!isComponentLine(line)) { out.push(line); continue; }
    const comp = recipesById && line.recipeId ? recipesById.get(line.recipeId) : undefined;
    if (!comp || !(comp.yield && (comp.yield.amount || 0) > 0)) { out.push({ ...line, _orphan: true }); continue; }
    if (stockSet && comp.id && stockSet.has(comp.id)) continue; // déjà préparé → pas d'éclatement
    const f = consumptionFraction(line, comp);
    for (const ci of comp.ingredients || []) {
      if (ci.recipeId) continue; // v1 : pas d'imbrication
      out.push({ dbId: ci.dbId, name: ci.name, amount: +(num(ci.amount) * f).toFixed(4), unit: ci.unit, image: ci.image });
    }
  }
  return out;
}

/** Fusionne les lignes brutes identiques (même `dbId` + unité) en cumulant les quantités. */
export function mergeRawLines(lines: ComponentLine[] | null | undefined): ComponentLine[] {
  const map = new Map<string, ComponentLine>();
  const order: string[] = [];
  for (const l of lines || []) {
    const key = `${l.dbId || l.name}|${(l.unit || "").toLowerCase()}`;
    const existing = map.get(key);
    if (existing) { existing.amount = +((existing.amount as number) + num(l.amount)).toFixed(4); }
    else { const copy = { ...l, amount: num(l.amount) }; map.set(key, copy); order.push(key); }
  }
  return order.map(k => map.get(k)!);
}
