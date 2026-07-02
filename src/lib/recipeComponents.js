// ─── COMPOSANTS – éclatement courses & utilitaires ────────────────────────────
// Un composant est une recette (isComponent) avec un rendement (yield).
// Une ligne d'ingrédient le référence par recipeId et en consomme une quantité,
// exprimée dans l'unité du rendement → fraction f = consommé / rendement.
// v1 : composition mono-niveau (un composant ne contient que des ingrédients bruts).
import { isComponentLine } from "./nutriscore.js";

const num = v => parseFloat(String(v).replace(",", ".")) || 0;

// Fraction consommée d'un composant par une ligne parente.
export function consumptionFraction(line, component) {
  if (!component || !(component.yield && component.yield.amount > 0)) return 0;
  return num(line.amount) / component.yield.amount;
}

// Recettes (non-composants) qui référencent un composant donné → avertissement
// avant suppression / déliage.
export function recipesReferencing(componentId, recipes) {
  return (recipes || []).filter(r =>
    r.id !== componentId &&
    (r.ingredients || []).some(l => l.recipeId === componentId));
}

// Éclate une liste de lignes en ingrédients BRUTS pour la liste de courses.
// - ligne brute (dbId) → conservée telle quelle ;
// - ligne composant (recipeId) → remplacée par ses ingrédients bruts × f ;
//   sauf si le composant est en stock (stockSet) → considéré « déjà préparé » et exclu ;
//   composant introuvable → ligne marquée orpheline (conservée, signalée).
export function flattenForShopping(lines, recipesById, stockSet) {
  const out = [];
  for (const line of lines || []) {
    if (!isComponentLine(line)) { out.push(line); continue; }
    const comp = recipesById && recipesById.get(line.recipeId);
    if (!comp || !(comp.yield && comp.yield.amount > 0)) { out.push({ ...line, _orphan: true }); continue; }
    if (stockSet && stockSet.has(comp.id)) continue; // déjà préparé → pas d'éclatement
    const f = consumptionFraction(line, comp);
    for (const ci of comp.ingredients || []) {
      if (ci.recipeId) continue; // v1 : pas d'imbrication
      out.push({ dbId: ci.dbId, name: ci.name, amount: +(num(ci.amount) * f).toFixed(4), unit: ci.unit, image: ci.image });
    }
  }
  return out;
}

// Fusionne les lignes brutes identiques (même dbId + unité) en cumulant les quantités.
export function mergeRawLines(lines) {
  const map = new Map();
  const order = [];
  for (const l of lines || []) {
    const key = `${l.dbId || l.name}|${(l.unit || "").toLowerCase()}`;
    if (map.has(key)) { map.get(key).amount = +(map.get(key).amount + num(l.amount)).toFixed(4); }
    else { const copy = { ...l, amount: num(l.amount) }; map.set(key, copy); order.push(key); }
  }
  return order.map(k => map.get(k));
}
