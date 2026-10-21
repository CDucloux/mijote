/**
 * Sessions de cuisine à deux (accès Firestore).
 *
 * Une session par recette : `households/{hid}/cookSessions/{recipeId}`. Couverte par
 * la règle wildcard des membres du foyer (cf. firestore.rules), aucune règle à
 * ajouter. Les lectures livrent des données brutes, validées par
 * `cookSession/together` ; les échecs d'écriture sont silencieux côté appelant (une
 * position manquée ne doit jamais bloquer le pas à pas).
 *
 * @module firebase/cookSessions
 */
import {
  collection, doc, onSnapshot, runTransaction, updateDoc, arrayUnion, deleteField,
  type DocumentReference, type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { isSessionLive, parseCookSession } from "@/lib/cookSession/together.js";

/** Identité publiée par un participant (lue telle quelle par l'autre membre). */
export interface CookMember {
  uid: string;
  name: string;
  photoURL: string;
}

const sessionDoc = (hid: string, recipeId: string): DocumentReference =>
  doc(db, "households", hid, "cookSessions", recipeId);

/** Entrée complète d'un participant : l'identité voyage à chaque battement. */
const participantEntry = (me: CookMember, page: string, away: boolean, now: number) =>
  ({ name: me.name, photoURL: me.photoURL, page, lastSeen: now, away });

/**
 * Rejoint (ou démarre) la session d'une recette. Si la session est terminée ou que
 * plus personne n'y est présent, elle repart de zéro (nouveau chrono, étapes vierges) ;
 * sinon on s'y ajoute. Transactionnel : deux lancements simultanés convergent vers
 * une seule session.
 *
 * @param hid - Foyer.
 * @param recipe - Recette cuisinée (id + nom affiché dans le bandeau).
 * @param me - Identité du participant.
 * @param page - Clé de la page de départ.
 * @returns La date de lancement de la session (epoch ms), pour un chrono commun.
 */
export async function joinCookSession(hid: string, recipe: { id: string; name: string }, me: CookMember, page: string): Promise<number> {
  const ref = sessionDoc(hid, recipe.id);
  return runTransaction(db, async (tx) => {
    const now = Date.now();
    const current = parseCookSession((await tx.get(ref)).data());
    const self = participantEntry(me, page, false, now);
    if (current && isSessionLive(current, now)) {
      tx.update(ref, { [`participants.${me.uid}`]: self, recipeName: recipe.name });
      return current.startedAt || now;
    }
    tx.set(ref, {
      recipeId: recipe.id, recipeName: recipe.name, startedAt: now,
      participants: { [me.uid]: self }, doneSteps: [], finished: false, finishedBy: null,
    });
    return now;
  });
}

/**
 * Publie sa position et son battement de présence. L'entrée est réécrite en entier
 * (nom, photo compris) : un participant dont la jonction a échoué hors ligne n'apparaît
 * jamais anonyme chez l'autre.
 *
 * @param hid - Foyer.
 * @param recipeId - Recette de la session.
 * @param me - Identité du participant.
 * @param page - Clé de la page courante.
 * @param away - App en arrière-plan (écran éteint) : tolérance de présence longue.
 */
export async function publishPresence(hid: string, recipeId: string, me: CookMember, page: string, away: boolean): Promise<void> {
  await updateDoc(sessionDoc(hid, recipeId), { [`participants.${me.uid}`]: participantEntry(me, page, away, Date.now()) });
}

/**
 * Marque une étape faite pour toute la session.
 *
 * @param hid - Foyer.
 * @param recipeId - Recette de la session.
 * @param realIdx - Index réel de l'étape dans `recipe.steps`.
 */
export async function markStepDone(hid: string, recipeId: string, realIdx: number): Promise<void> {
  await updateDoc(sessionDoc(hid, recipeId), { doneSteps: arrayUnion(realIdx) });
}

/**
 * Termine la recette pour tous les participants (écran de fin commun).
 *
 * @param hid - Foyer.
 * @param recipeId - Recette de la session.
 * @param uid - Celui qui termine : lui seul consigne le plat au journal.
 */
export async function finishCookSession(hid: string, recipeId: string, uid: string): Promise<void> {
  await updateDoc(sessionDoc(hid, recipeId), { finished: true, finishedBy: uid });
}

/**
 * Quitte la session (fermeture du pas à pas) : retire sa présence.
 *
 * @param hid - Foyer.
 * @param recipeId - Recette de la session.
 * @param uid - Participant qui part.
 */
export async function leaveCookSession(hid: string, recipeId: string, uid: string): Promise<void> {
  await updateDoc(sessionDoc(hid, recipeId), { [`participants.${uid}`]: deleteField() });
}

/**
 * Abonnement temps réel à une session. Une erreur de lecture livre `undefined`
 * (session inconnue) plutôt que de casser le pas à pas.
 *
 * @param hid - Foyer.
 * @param recipeId - Recette de la session.
 * @param cb - Reçoit les données brutes du document (à valider en amont).
 */
export function subscribeCookSession(hid: string, recipeId: string, cb: (raw: unknown) => void): Unsubscribe {
  return onSnapshot(sessionDoc(hid, recipeId), (snap) => cb(snap.data()), () => cb(undefined));
}

/**
 * Abonnement temps réel à toutes les sessions du foyer (bandeau « Rejoindre »).
 *
 * @param hid - Foyer.
 * @param cb - Reçoit les données brutes des documents (à valider en amont).
 */
export function subscribeCookSessions(hid: string, cb: (raws: unknown[]) => void): Unsubscribe {
  return onSnapshot(collection(db, "households", hid, "cookSessions"), (snap) => cb(snap.docs.map((d) => d.data())), () => cb([]));
}
