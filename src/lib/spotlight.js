// ─── INGRÉDIENT DU MOMENT (logique pure) ──────────────────────────────────────
// Choisit un fruit/légume de saison à mettre en vedette dans l'Accueil, et
// retrouve les recettes publiques qui l'utilisent. Deux entrées pures, testables.

import { ingredientMonths } from "./seasonality.js";

const SPOTLIGHT_CATEGORIES = new Set(["fruit", "vegetable"]);

// Index de semaine déterministe (rotation hebdomadaire de la vedette).
export function weekIndex(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / 86400000);
  return Math.floor((days + start.getDay()) / 7);
}

// Fruit/légume de saison ce mois, choisi de façon déterministe et tournant chaque
// semaine sur TOUS les candidats de saison (la description ne fait qu'enrichir la
// carte : la préférer figeait la rotation quand un seul ingrédient en avait une).
// Renvoie `null` si aucun candidat de saison.
export function pickSpotlightIngredient(ingredientDB, date = new Date()) {
  const month = date.getMonth() + 1;
  const candidates = (ingredientDB || []).filter(i => {
    if (!SPOTLIGHT_CATEGORIES.has(i.category)) return false;
    const m = ingredientMonths(i);
    return m && m.includes(month);
  });
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  return sorted[weekIndex(date) % sorted.length];
}

// Recettes publiques (hors préparations de base) utilisant l'ingrédient vedette.
// `resolver` (createIngredientResolver) : gère pluriels, qualificatifs et
// distingue les proches (« poire » ≠ « poireau »).
export function publicRecipesWithIngredient(ingredient, pubs, resolver, max = 10) {
  if (!ingredient || !resolver) return [];
  const uses = (recipe) => (recipe?.ingredients || []).some(ing => resolver(ing?.name)?.id === ingredient.id);
  return (pubs || []).filter(p => !p.isComponent && uses(p.recipe)).slice(0, max);
}
