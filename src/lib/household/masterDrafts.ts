/**
 * Normalisation des fiches saisies dans la console admin avant écriture dans la
 * base master : Firestore ne doit recevoir ni champ vide ni doublon, et l'absence
 * d'un champ porte un sens (`status` absent = fiche en cours de rédaction).
 *
 * @module household/masterDrafts
 */
import { sortedCategoryEntries } from "@/constants/categories.js";
import type { IngredientDbItem, PrecautionTone, UtensilDbItem } from "@/lib/types.js";

/**
 * Nettoie une fiche ingrédient éditée : conseils vides retirés, accroche et nom
 * rognés, mois dédoublonnés et triés, statut retiré s'il n'est pas « validé ».
 * Un champ devenu vide disparaît plutôt que d'être stocké vide.
 *
 * @param draft - La fiche telle que sortie du formulaire.
 * @returns La fiche prête à écrire (même id).
 */
export function normalizeIngredientDraft(draft: IngredientDbItem): IngredientDbItem {
  const { tips, description, months, status, ...rest } = draft;
  const item: IngredientDbItem = { ...rest, name: (draft.name || "").trim() };
  const cleanTips = (tips || []).map(t => ({ type: t.type, text: (t.text || "").trim() })).filter(t => t.text);
  if (cleanTips.length) item.tips = cleanTips;
  const desc = (description || "").trim();
  if (desc) item.description = desc;
  if (Array.isArray(months) && months.length) item.months = [...new Set(months)].sort((a, b) => a - b);
  if (status === "validated") item.status = status;
  return item;
}

/**
 * Nettoie une fiche ustensile éditée : la précaution d'utilisation n'est gardée
 * que si son titre ET sa description sont remplis (sinon c'est une fiche vide),
 * rognée, avec la tonalité « chaleur » par défaut et le bon réflexe s'il existe.
 *
 * @param draft - La fiche telle que sortie du formulaire.
 * @returns La fiche prête à écrire (même id).
 */
export function normalizeUtensilDraft(draft: UtensilDbItem): UtensilDbItem {
  const { usagePrecaution: precaution, ...rest } = draft;
  const title = (precaution?.title || "").trim();
  const description = (precaution?.description || "").trim();
  if (!title || !description) return rest;
  const tone: PrecautionTone = precaution?.tone || "heat";
  const tip = (precaution?.tip || "").trim();
  return { ...rest, usagePrecaution: { tone, title, description, ...(tip ? { tip } : {}) } };
}

/**
 * Déplace une catégorie à la place d'une autre (glisser-déposer) et renumérote
 * l'ordre d'affichage de toutes les catégories, sans trou.
 *
 * @param categories - Les catégories, clé vers définition ordonnée.
 * @param fromKey - La catégorie déplacée.
 * @param toKey - La catégorie dont elle prend la place.
 * @returns Les catégories renumérotées, ou `null` si rien ne bouge (même clé,
 *   ou clé inconnue).
 */
export function reorderCategories<T extends { order?: number }>(categories: Record<string, T>, fromKey: string, toKey: string): Record<string, T> | null {
  if (fromKey === toKey) return null;
  const ordered = sortedCategoryEntries(categories).map(([k]) => k);
  const from = ordered.indexOf(fromKey), to = ordered.indexOf(toKey);
  if (from < 0 || to < 0) return null;
  ordered.splice(to, 0, ...ordered.splice(from, 1));
  const next = { ...categories };
  ordered.forEach((k, i) => { next[k] = { ...next[k], order: i }; });
  return next;
}

/** Signalements d'une même recette publique, traités d'un bloc en modération. */
export interface ReportGroup<T> {
  pubId: string;
  name: string;
  items: T[];
}

/**
 * Regroupe les signalements par recette publique, dans l'ordre de première
 * apparition (les signalements arrivent du plus récent au plus ancien).
 *
 * @param reports - Les signalements à regrouper.
 * @returns Un groupe par recette, nommé d'après le premier signalement.
 */
export function groupReportsByRecipe<T extends { pubId: string; recipeName?: string }>(reports: readonly T[]): ReportGroup<T>[] {
  const groups = new Map<string, ReportGroup<T>>();
  for (const report of reports) {
    const group = groups.get(report.pubId);
    if (group) group.items.push(report);
    else groups.set(report.pubId, { pubId: report.pubId, name: report.recipeName || "Recette", items: [report] });
  }
  return [...groups.values()];
}
