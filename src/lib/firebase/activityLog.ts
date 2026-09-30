/**
 * Journal d'activité (notifications du tableau de bord).
 *
 * Sous-collection append-only du workspace actif : `users/{uid}/activity` en solo,
 * `households/{hid}/activity` en foyer. Les deux sont déjà couverts par les règles
 * wildcard existantes (membre du foyer / propriétaire de l'espace), aucune règle à
 * ajouter. La lecture est plafonnée (limit) : le coût reste borné même si l'historique
 * grossit.
 *
 * @module firebase/activityLog
 */
import {
  collection, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot,
  type DocumentData, type CollectionReference, type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { segmentsOf, type WorkspaceRef } from "@/lib/firebase/paths.js";

/** Réf. de la sous-collection append-only du journal d'activité du workspace. */
export const activityCol = (ws: WorkspaceRef): CollectionReference => collection(db, [...segmentsOf(ws), "activity"].join("/"));

/** Charge utile d'un évènement, hors horodatage (posé côté serveur). */
export interface ActivityWrite {
  type: string;
  actorEmail: string;
  actorName: string;
  target: string;
  /** Id de la cible pour un lien profond ; omis quand il n'y en a pas. */
  targetId?: string;
  count: number;
}

/**
 * Ajoute un évènement au journal d'activité du workspace. L'horodatage est posé par
 * le serveur (`serverTimestamp`) pour un ordre cohérent entre les appareils/membres.
 * Les échecs sont silencieux côté appelant : une notification manquée ne doit jamais
 * casser l'action métier qui l'a déclenchée.
 *
 * @param ws - Workspace actif (solo ou foyer).
 * @param rec - Évènement à journaliser (acteur + type + cible + compteur).
 */
export async function appendActivity(ws: WorkspaceRef, rec: ActivityWrite): Promise<void> {
  await addDoc(activityCol(ws), { ...rec, ts: serverTimestamp() });
}

/**
 * Abonnement temps réel aux `max` derniers évènements (les plus récents d'abord).
 * Les writes en attente sont lus en estimation (`serverTimestamps: "estimate"`) pour
 * afficher immédiatement sa propre action avant résolution serveur. Une erreur de
 * lecture livre une liste vide plutôt que de casser le tableau de bord.
 *
 * @param ws - Workspace actif.
 * @param cb - Reçoit les documents bruts `{ id, data }` (validés en amont).
 * @param max - Nombre maximum d'évènements lus (défaut 40).
 */
export function subscribeActivity(
  ws: WorkspaceRef,
  cb: (docs: { id: string; data: DocumentData }[]) => void,
  max = 40,
): Unsubscribe {
  const q = query(activityCol(ws), orderBy("ts", "desc"), limit(max));
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => ({ id: d.id, data: d.data({ serverTimestamps: "estimate" }) }))),
    () => cb([]),
  );
}
