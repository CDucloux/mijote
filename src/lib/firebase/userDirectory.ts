/**
 * Annuaire des utilisateurs connus (avatars des membres du foyer, invitations).
 *
 * Collection top-level `userDirectory`, lisible par tout connecté, chacun n'écrit
 * que SA fiche (cf. firestore.rules).
 *
 * @module firebase/userDirectory
 */
import {
  doc, collection, getDocs, query, where, setDoc,
  type DocumentData, type DocumentReference, type CollectionReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";

/** Fiche d'annuaire d'un utilisateur (avatar, email, nom). */
export interface DirectoryUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/** Réf. de la collection d'annuaire des utilisateurs (top-level `userDirectory`). */
export const userDirCol = (): CollectionReference => collection(db, "userDirectory");
/** Réf. de la fiche d'annuaire d'un utilisateur donné (`userDirectory/{uid}`). */
export const userDirDoc = (uid: string): DocumentReference => doc(db, "userDirectory", uid);

/**
 * Inscrit/actualise ma fiche d'annuaire (pour que les autres puissent m'inviter et
 * afficher mon avatar). Un seul write par session.
 *
 * @param user - L'utilisateur courant (uid + profil public).
 * @returns La promesse d'écriture (merge).
 */
export function upsertOwnDirectoryEntry(user: DirectoryUser): Promise<void> {
  return setDoc(userDirDoc(user.uid), {
    uid: user.uid, email: (user.email || "").toLowerCase(),
    displayName: user.displayName || "", photoURL: user.photoURL || "", updatedAt: Date.now(),
  }, { merge: true });
}

/**
 * Charge l'annuaire des utilisateurs. À la DEMANDE uniquement (invitations, partage
 * de liste, avatars de foyer) : ne JAMAIS l'appeler au chargement pour tout le monde
 *, l'immense majorité (utilisateurs solo) n'en a aucun besoin, et un `getDocs`
 * global à chaque session fait exploser les lectures Firestore.
 *
 * @param emails - Ciblage optionnel par email (chunks de 10 pour l'opérateur `in`).
 * @returns Les fiches d'annuaire correspondantes.
 */
export async function fetchUserDirectory(emails?: string[]): Promise<DocumentData[]> {
  if (!emails) {
    const s = await getDocs(userDirCol());
    return s.docs.map(d => d.data());
  }
  const list = [...new Set(emails.map(e => (e || "").toLowerCase()).filter(Boolean))];
  const out: DocumentData[] = [];
  for (let i = 0; i < list.length; i += 10) {
    const s = await getDocs(query(userDirCol(), where("email", "in", list.slice(i, i + 10))));
    out.push(...s.docs.map(d => d.data()));
  }
  return out;
}
