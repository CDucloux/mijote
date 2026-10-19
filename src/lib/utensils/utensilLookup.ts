/**
 * Résolution d'une ligne ustensile de recette vers sa fiche en base. Logique pure,
 * sans I/O ni React.
 *
 * @module utensils/utensilLookup
 */
import type { UtensilDbItem } from "@/lib/types";
import { normalizeStr } from "@/lib/food/parseIngredient";

/**
 * Fiche de base d'un ustensile : par `dbId` figé, sinon par nom normalisé (ustensile
 * saisi à la main, ou ajouté à la base après la recette). Source unique pour l'image
 * et la précaution d'utilisation, partagée par la fiche recette et le pas à pas.
 *
 * @param utensilDB - Base d'ustensiles (absente = aucune fiche).
 * @param dbId - Identifiant figé sur la ligne, s'il existe.
 * @param name - Nom saisi sur la ligne, repli quand `dbId` ne résout rien.
 * @returns La fiche trouvée, `undefined` sinon.
 */
export function findUtensilEntry(
  utensilDB: readonly UtensilDbItem[] | null | undefined,
  dbId: string | null | undefined,
  name: string | null | undefined,
): UtensilDbItem | undefined {
  const db = utensilDB || [];
  const pinned = dbId ? db.find(d => d.id === dbId) : undefined;
  if (pinned || !name) return pinned;
  const wanted = normalizeStr(name);
  return db.find(d => d.name !== undefined && normalizeStr(d.name) === wanted);
}
