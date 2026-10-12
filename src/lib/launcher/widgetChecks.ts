/**
 * Cases cochées depuis le widget « Courses ». Le widget ne parle pas à Firestore :
 * il coche en local, tout de suite, et garde la bascule en attente. L'app la
 * récupère ensuite (démarrage, retour au premier plan) et l'applique aux vraies
 * listes, qui se synchronisent alors comme un achat fait dans l'app.
 *
 * @module launcher/widgetChecks
 */
import type { Contributor, ShoppingList } from "@/lib/food/shoppingAggregate.js";

/** Une bascule faite sur le widget : l'état voulu pour tous les articles visés. */
export interface WidgetCheck {
  checked: boolean;
  refs: Contributor[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toRef = (value: unknown): Contributor | null =>
  isRecord(value) && typeof value.listId === "string" && typeof value.itemId === "string"
    ? { listId: value.listId, itemId: value.itemId }
    : null;

/**
 * Valide les bascules renvoyées par le natif. Toute entrée malformée est ignorée
 * plutôt que de faire échouer le lot : une case perdue vaut mieux qu'une liste cassée.
 *
 * @param raw - La charge utile brute du plugin (`{ checks: [...] }`).
 * @returns Les bascules exploitables, dans l'ordre reçu.
 */
export function parseWidgetChecks(raw: unknown): WidgetCheck[] {
  const checks = isRecord(raw) && Array.isArray(raw.checks) ? raw.checks : [];
  return checks.flatMap((check): WidgetCheck[] => {
    if (!isRecord(check) || typeof check.checked !== "boolean" || !Array.isArray(check.refs)) return [];
    const refs = check.refs.map(toRef).filter((ref): ref is Contributor => ref !== null);
    return refs.length ? [{ checked: check.checked, refs }] : [];
  });
}

/**
 * Applique les bascules du widget aux listes. Un article supprimé entre-temps est
 * simplement ignoré ; la dernière bascule d'un même article l'emporte.
 *
 * @param lists - Les listes de courses courantes.
 * @param checks - Les bascules validées ({@link parseWidgetChecks}).
 * @returns De nouvelles listes, ou `lists` lui-même quand rien ne change (pas
 *   d'écriture inutile vers Firestore).
 */
export function applyWidgetChecks(lists: ShoppingList[], checks: WidgetCheck[]): ShoppingList[] {
  const target = new Map<string, boolean>();
  for (const check of checks) for (const ref of check.refs) target.set(`${ref.listId}\u0000${ref.itemId}`, check.checked);
  if (!target.size) return lists;
  let changed = false;
  const next = lists.map(list => {
    let listChanged = false;
    const items = (list.items || []).map(item => {
      const want = target.get(`${list.id}\u0000${item.id}`);
      if (want === undefined || !!item.checked === want) return item;
      listChanged = true;
      return { ...item, checked: want };
    });
    if (!listChanged) return list;
    changed = true;
    return { ...list, items };
  });
  return changed ? next : lists;
}
