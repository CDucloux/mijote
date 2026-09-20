/**
 * Planification de la synchro des recettes par diff, avec coupe-circuit
 * anti-suppression de masse.
 *
 * Contexte : la synchro supprime côté serveur toute recette absente de l'état
 * local courant. Un état local périmé (vieux cache, démarrage hors-ligne qui
 * pousse avant d'avoir re-téléchargé le cloud) peut donc effacer en masse des
 * recettes récentes. Ce module SÉPARE la décision (pure, testable) de l'exécution
 * Firestore : au-delà d'un seuil de suppressions, on REFUSE de les exécuter (les
 * ajouts/modifications, eux, restent appliqués) plutôt que de saccager la base.
 * Le cas normal (l'utilisateur supprime 1 recette) passe sans friction ; seule
 * une suppression massive et silencieuse est stoppée.
 */
import type { Recipe } from "@/lib/types.js";

/** Seuil au-delà duquel une suppression par diff est considérée anormale et bloquée. */
export const MAX_SYNC_DELETIONS = 3;

/** Plan de synchro : ce qu'on écrit, ce qu'on supprime, ce qu'on refuse de supprimer. */
export interface RecipeSyncPlan {
  /** Recettes nouvelles ou modifiées à écrire. */
  upserts: Recipe[];
  /** Ids à supprimer (sous le seuil, donc autorisés). */
  deletions: string[];
  /** Ids que le coupe-circuit REFUSE de supprimer (au-delà du seuil). */
  blockedDeletions: string[];
}

/**
 * Calcule le diff entre l'état courant et la dernière synchro connue, en appliquant
 * le coupe-circuit : si le nombre de suppressions dépasse `maxDeletions`, aucune
 * suppression n'est exécutée (toutes basculent en `blockedDeletions`), les
 * upserts restant appliqués. Sous le seuil, comportement de diff classique.
 *
 * @param recipes - État courant des recettes.
 * @param lastSyncedMap - Dernière carte de synchro (id -> recette).
 * @param maxDeletions - Seuil de déclenchement du coupe-circuit (défaut `MAX_SYNC_DELETIONS`).
 */
export function planRecipeSync(
  recipes: Recipe[],
  lastSyncedMap: Map<string, Recipe>,
  maxDeletions: number = MAX_SYNC_DELETIONS,
): RecipeSyncPlan {
  const currentIds = new Set<string>();
  const upserts: Recipe[] = [];
  for (const r of recipes) {
    if (!r.id) continue;
    currentIds.add(r.id);
    const prev = lastSyncedMap.get(r.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) upserts.push(r);
  }
  const pendingDeletions: string[] = [];
  for (const id of lastSyncedMap.keys()) {
    if (!currentIds.has(id)) pendingDeletions.push(id);
  }
  if (pendingDeletions.length > maxDeletions) {
    return { upserts, deletions: [], blockedDeletions: pendingDeletions };
  }
  return { upserts, deletions: pendingDeletions, blockedDeletions: [] };
}
