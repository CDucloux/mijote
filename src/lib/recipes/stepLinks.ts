/**
 * Éléments d'une recette (ingrédients, ustensiles) liés à une étape : ceux dont
 * l'`id` figure dans la liste de liaisons de l'étape (`step.ingredients`,
 * `step.utensils`). Garde l'ordre de la recette, pas celui des liaisons, pour que
 * les pastilles d'étape suivent la liste affichée. Un élément sans `id` n'est
 * jamais lié.
 *
 * @param items - Éléments de la recette (absents = aucun).
 * @param linkedIds - Ids liés par l'étape (absents = aucun).
 * @returns Les éléments liés, dans l'ordre de `items`.
 */
export function stepLinked<T extends { id?: string }>(
  items: readonly T[] | null | undefined,
  linkedIds: readonly string[] | null | undefined,
): T[] {
  if (!items || !linkedIds?.length) return [];
  const ids = new Set(linkedIds);
  return items.filter(item => item.id !== undefined && ids.has(item.id));
}
