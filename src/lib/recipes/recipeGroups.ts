/**
 * Groupements (sections nommées) d'ingrédients et d'étapes. Une recette peut
 * organiser ses lignes en sous-préparations partagées — « Pour la pâte », « Pour la
 * crème »… — via le champ `group` (libellé) porté par chaque `IngredientLine` et
 * chaque `Step`. Une ligne sans `group` appartient à la section PRINCIPALE (rendue en
 * premier, sans en-tête).
 *
 * Source unique de regroupement consommée par la fiche, le PDF, le cook mode et
 * l'éditeur : on regroupe en PRÉSERVANT l'ordre du tableau (l'ordre des sections suit
 * la première apparition), sans jamais réordonner les lignes elles-mêmes.
 *
 * @module recipeGroups
 */

/** Une section : `group` = libellé (`null` pour la section principale non nommée). */
export interface Section<T> {
  group: string | null;
  items: T[];
}

const label = (g: unknown): string => (typeof g === "string" ? g.trim() : "");

/**
 * Regroupe une liste (ingrédients ou étapes) par `group`, section principale d'abord.
 * L'ordre des sections nommées suit leur première apparition ; l'ordre interne des
 * items reste celui du tableau source.
 *
 * @param items - Lignes à regrouper (chaque item peut porter un `group?: string`).
 * @returns Sections ordonnées ; la section principale (`group: null`) n'est présente
 *   que si elle contient au moins un item.
 */
export function groupBy<T extends { group?: string }>(items: readonly T[]): Section<T>[] {
  const main: T[] = [];
  const named = new Map<string, T[]>();
  for (const it of items) {
    const g = label(it.group);
    if (!g) { main.push(it); continue; }
    const bucket = named.get(g);
    if (bucket) bucket.push(it);
    else named.set(g, [it]);
  }
  const out: Section<T>[] = [];
  if (main.length) out.push({ group: null, items: main });
  for (const [group, groupItems] of named) out.push({ group, items: groupItems });
  return out;
}

/** `true` si au moins une ligne porte un groupe non vide (⇒ affichage sectionné). */
export function hasGroups(items: readonly { group?: string }[] | undefined): boolean {
  return !!items?.some(i => label(i.group) !== "");
}

/**
 * Libellés de groupes d'une recette, dans l'ordre de première apparition (ingrédients
 * puis étapes). Utile pour proposer les groupes existants dans l'éditeur.
 */
export function groupOrder(recipe: { ingredients?: { group?: string }[]; steps?: { group?: string }[] }): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const it of [...(recipe.ingredients || []), ...(recipe.steps || [])]) {
    const g = label(it.group);
    if (g && !seen.has(g)) { seen.add(g); order.push(g); }
  }
  return order;
}

/** Renomme un groupe (ou le supprime si `to` est vide) sur une liste d'items. */
export function relabelGroup<T extends { group?: string }>(items: readonly T[], from: string, to: string): T[] {
  const f = label(from);
  const t = label(to);
  return items.map(it => (label(it.group) === f ? { ...it, group: t } : it));
}

/**
 * Réordonne UN item À L'INTÉRIEUR de sa section (les autres items — et les autres
 * sections — gardent leur position dans le tableau). `group` cible la section
 * (`""` = section principale) ; `fromLocal`/`toLocal` sont les index DANS la section.
 * Utilisé par l'éditeur pour un glisser/déposer ou des flèches ↑/↓ scopés à la section.
 */
export function moveWithinGroup<T extends { group?: string }>(items: readonly T[], group: string, fromLocal: number, toLocal: number): T[] {
  const g = label(group);
  const positions: number[] = [];
  items.forEach((it, idx) => { if (label(it.group) === g) positions.push(idx); });
  if (fromLocal < 0 || fromLocal >= positions.length || toLocal < 0 || toLocal >= positions.length || fromLocal === toLocal) {
    return items.slice();
  }
  const arr = items.slice();
  const subset = positions.map(p => arr[p]);
  const [moved] = subset.splice(fromLocal, 1);
  subset.splice(toLocal, 0, moved);
  positions.forEach((p, k) => { arr[p] = subset[k]; });
  return arr;
}
