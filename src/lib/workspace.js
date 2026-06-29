// ─── WORKSPACE (espace de données actif) ─────────────────────────────────────
// Un « workspace » désigne le namespace Firestore dans lequel l'app lit/écrit les
// données partageables : l'espace personnel (`users/{uid}`) quand on est solo, ou
// un foyer (`households/{hid}`) quand on est membre d'un foyer.
//
// Toute la couche d'accès (firestore.js) résout ses chemins à partir de
// `workspace.segments`, le préfixe de chemin du namespace. Ça permet de basculer
// l'espace de données sans toucher les helpers eux-mêmes.
//
// Note : certains slices restent TOUJOURS personnels (préférences, ajouts perso à
// la base d'ingrédients) — l'appelant leur passe explicitement le workspace solo,
// même quand l'utilisateur est dans un foyer.

export function soloWorkspace(uid) {
  return { kind: "solo", uid, id: uid, segments: ["users", uid] };
}

export function householdWorkspace(hid) {
  return { kind: "household", hid, id: hid, segments: ["households", hid] };
}

export function isHousehold(ws) {
  return ws?.kind === "household";
}

// Identifiant du namespace (uid ou hid) — utile comme clé de cache locale.
export function workspaceId(ws) {
  return ws?.id ?? null;
}
