/**
 * Workspace (espace de données actif). Un « workspace » désigne le namespace
 * Firestore dans lequel l'app lit/écrit les données partageables : l'espace
 * personnel (`users/{uid}`) quand on est solo, ou un foyer (`households/{hid}`)
 * quand on est membre d'un foyer.
 *
 * Toute la couche d'accès (firestore.js) résout ses chemins à partir de
 * `workspace.segments`, le préfixe de chemin du namespace. Ça permet de basculer
 * l'espace de données sans toucher les helpers eux-mêmes.
 *
 * Note : certains slices restent TOUJOURS personnels (préférences, ajouts perso à
 * la base d'ingrédients) – l'appelant leur passe explicitement le workspace solo,
 * même quand l'utilisateur est dans un foyer.
 *
 * @module workspace
 */

/** Espace de données personnel (`users/{uid}`). */
export interface SoloWorkspace {
  kind: "solo";
  uid: string;
  id: string;
  segments: [string, string];
}

/** Espace de données de foyer (`households/{hid}`). */
export interface HouseholdWorkspace {
  kind: "household";
  hid: string;
  id: string;
  segments: [string, string];
}

/** Namespace Firestore actif : personnel ou foyer. */
export type Workspace = SoloWorkspace | HouseholdWorkspace;

export function soloWorkspace(uid: string): SoloWorkspace {
  return { kind: "solo", uid, id: uid, segments: ["users", uid] };
}

export function householdWorkspace(hid: string): HouseholdWorkspace {
  return { kind: "household", hid, id: hid, segments: ["households", hid] };
}

export function isHousehold(ws: Workspace | null | undefined): ws is HouseholdWorkspace {
  return ws?.kind === "household";
}

/** Identifiant du namespace (uid ou hid) – utile comme clé de cache locale. */
export function workspaceId(ws: Workspace | null | undefined): string | null {
  return ws?.id ?? null;
}
