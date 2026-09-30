/**
 * Verrou d'écriture des slices partagés (garde-fou anti-client périmé).
 *
 * Engagé au bootstrap quand `evaluateAppGuard` déclasse le client (version trop
 * vieille ou hôte non canonique). Une fois posé, les écritures par diff des
 * recettes (seul chemin capable de SUPPRIMER des docs distants) deviennent des
 * no-op : un cache local obsolète ne peut plus saccager la base partagée.
 *
 * État module-level volontairement isolé ici, pour être partagé par les écritures
 * de `workspaceData` sans dupliquer la variable.
 *
 * @module firebase/writeLock
 */
let sharedWritesLocked = false;

/**
 * Engage ou lève le verrou d'écriture des slices partagés (garde-fou client périmé).
 *
 * @param locked - `true` verrouille (les diffs de recettes deviennent des no-op),
 *   `false` restaure les écritures partagées.
 */
export function setSharedWritesLocked(locked: boolean): void { sharedWritesLocked = locked; }

/** Indique si les écritures partagées sont actuellement verrouillées. */
export function isSharedWritesLocked(): boolean { return sharedWritesLocked; }
