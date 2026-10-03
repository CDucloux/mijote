/**
 * Réconciliation du pointeur de workspace avec l'appartenance autoritaire.
 *
 * Deux sources décrivent le foyer d'un utilisateur :
 *   • l'APPARTENANCE autoritaire, côté serveur : la requête
 *     `households` filtrée sur `memberUids array-contains uid` (ce qui fait
 *     qu'on « est bien dans le foyer ») ;
 *   • le POINTEUR de workspace, côté client : `users/{uid}/meta/household`,
 *     qui désigne le namespace Firestore effectivement lu/écrit par l'app.
 *
 * Toute la couche d'accès résout ses chemins sur le POINTEUR. Quand les deux
 * divergent (pointeur absent, périmé sur un autre foyer, ou effacé par erreur
 * sur un snapshot membre transitoirement vide), l'app bascule silencieusement
 * sur l'espace solo : on reste membre du foyer mais on lit/écrit ses données
 * perso, donc plus rien ne se partage (jeux de recettes disjoints, planning et
 * listes non propagés). Ce module décide comment ramener le pointeur en phase
 * avec l'appartenance, qui fait foi.
 *
 * @module household/pointerSync
 */

/** État du pointeur de workspace (`users/{uid}/meta/household`). */
export interface PointerState {
  id: string;
  migrated?: boolean;
}

/** Action à appliquer au pointeur pour le remettre en phase avec l'appartenance. */
export type PointerAction =
  | { kind: "none" }
  | { kind: "set"; hid: string; migrated: boolean }
  | { kind: "clear" };

/**
 * Décide comment réconcilier le pointeur de workspace avec l'appartenance
 * autoritaire au foyer.
 *
 * Règles :
 *   • Membre d'un foyer H, pointeur absent ou visant un autre foyer → poser le
 *     pointeur sur H avec `migrated:false`, pour que le coordinateur de sync
 *     fusionne (de façon additive) les données solo résiduelles dans le foyer
 *     puis repasse le drapeau à `true`. C'est le correctif d'un pointeur perdu :
 *     sans lui, le membre reste coincé en solo et rien ne se partage.
 *   • Membre du foyer H, pointeur déjà sur H → ne rien faire (ne jamais écraser
 *     un `migrated:true` sain, ce qui relancerait une fusion à chaque snapshot).
 *   • Plus membre d'aucun foyer (dissolution par autrui), pointeur encore posé →
 *     l'effacer pour revenir proprement en solo.
 *
 * @param membershipHid - Le foyer dont l'utilisateur est membre (source
 *   autoritaire), ou `null` s'il n'en a aucun.
 * @param pointer - L'état courant du pointeur de workspace, ou `null`.
 * @returns L'action à appliquer au pointeur (`none` quand il est déjà en phase).
 */
export function reconcileHouseholdPointer(
  membershipHid: string | null,
  pointer: PointerState | null,
): PointerAction {
  if (membershipHid) {
    if (!pointer || pointer.id !== membershipHid) {
      return { kind: "set", hid: membershipHid, migrated: false };
    }
    return { kind: "none" };
  }
  if (pointer) return { kind: "clear" };
  return { kind: "none" };
}
