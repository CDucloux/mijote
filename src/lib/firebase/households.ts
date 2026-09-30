/**
 * Accès Firestore aux foyers (households).
 *
 * `households/{hid}` : doc d'appartenance (cf. lib/household/household.js). Le pointeur
 * du foyer actif de chaque utilisateur vit dans son espace privé :
 * `users/{uid}/meta/household`. Le document du foyer lui-même est créé CÔTÉ SERVEUR
 * (Cloud Function `createHousehold`, gardée par l'abonnement Cardamome+) ; ici on gère
 * le semis des données, le pointeur et les transitions d'appartenance (invitation,
 * adhésion, départ, dissolution).
 *
 * @module firebase/households
 */
import {
  doc, collection, getDocs, writeBatch, query, where,
  runTransaction, deleteDoc, setDoc, onSnapshot,
  type DocumentData, type DocumentReference, type CollectionReference, type Query, type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, firebaseApp } from "@/lib/firebase/firebase.js";
import {
  withInvite, withInviteRemoved, withAcceptedMember, withMemberRemoved,
  planHouseholdExit, peopleCount, MAX_HOUSEHOLD, type Household, type HouseholdUser,
} from "@/lib/household/household.js";
import { householdWorkspace } from "@/lib/household/workspace.js";
import type { SharedData } from "@/lib/household/householdMigration.js";
import { writeSharedData } from "@/lib/firebase/workspaceData.js";

/** Réf. de la collection des foyers (top-level `households`). */
export const householdsCol = (): CollectionReference => collection(db, "households");
/** Réf. d'un foyer donné (`households/{hid}`). */
export const householdDoc = (hid: string): DocumentReference => doc(db, "households", hid);
const householdPointerDoc = (uid: string): DocumentReference => doc(db, "users", uid, "meta", "household");

// Requêtes temps réel : mon foyer actif (par uid) et mes invitations (par email).
/** Requête des foyers dont l'utilisateur est membre (filtre `memberUids array-contains uid`). */
export const householdMemberQuery = (uid: string): Query => query(householdsCol(), where("memberUids", "array-contains", uid));
/** Requête des foyers ayant invité cet email (filtre `invitedEmails array-contains`, casse normalisée). */
export const householdInviteQuery = (email: string): Query => query(householdsCol(), where("invitedEmails", "array-contains", (email || "").toLowerCase()));

/**
 * Pose/actualise le pointeur du foyer actif d'un utilisateur.
 *
 * @param uid - L'utilisateur.
 * @param id - L'identifiant du foyer.
 * @param migrated - `true` si la fusion des données a déjà eu lieu (création),
 *   `false` à l'adhésion (fusion à faire une fois par le coordinateur de sync).
 * @returns La promesse d'écriture.
 */
export function setHouseholdPointer(uid: string, id: string, migrated: boolean): Promise<void> {
  return setDoc(householdPointerDoc(uid), { id, migrated: !!migrated, updatedAt: Date.now() });
}

/**
 * Crée un foyer, y SÈME les données du créateur, puis pointe son espace dessus
 * (pointeur posé EN DERNIER pour éviter toute course avec le coordinateur de sync).
 *
 * Le document `households/{hid}` lui-même est écrit CÔTÉ SERVEUR par la Cloud
 * Function `createHousehold` (gardée par l'abonnement Cardamome+ : le client ne peut
 * plus le créer, cf. firestore.rules). Le semis des données et le pointeur restent
 * client (écritures autorisées au membre une fois le foyer créé).
 *
 * @param user - Le créateur (devient propriétaire + 1er membre côté serveur).
 * @param name - Le nom du foyer.
 * @param sharedData - Les données à semer dans le foyer.
 * @returns L'identifiant du foyer créé.
 */
export async function createHousehold(user: HouseholdUser, name: string, sharedData?: SharedData): Promise<string> {
  const call = httpsCallable<{ name: string }, { id: string }>(getFunctions(firebaseApp, "europe-west1"), "createHousehold");
  const hid = (await call({ name })).data.id;
  const ws = householdWorkspace(hid);
  await writeSharedData(ws, sharedData || {});
  await setHouseholdPointer(user.uid, hid, true); // déjà migré (semé)
  return hid;
}

/**
 * Invite un email dans un foyer (transaction : relit le doc pour respecter le
 * plafond côté serveur).
 *
 * @param hid - L'identifiant du foyer.
 * @param email - L'email à inviter.
 * @returns La promesse de transaction.
 * @throws Si le foyer est introuvable ou complet.
 */
export async function inviteToHousehold(hid: string, email: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (!snap.exists()) throw new Error("Foyer introuvable");
    const next = withInvite(snap.data() as Household, email);
    if (peopleCount(next) > MAX_HOUSEHOLD) throw new Error("Foyer complet");
    tx.set(householdDoc(hid), next);
  });
}

/**
 * Accepte une invitation : invité → membre, et pointe mon espace sur le foyer.
 *
 * @param hid - L'identifiant du foyer.
 * @param user - L'utilisateur qui accepte.
 * @returns La promesse de transaction.
 * @throws Si le foyer est introuvable ou complet.
 */
export async function acceptInvite(hid: string, user: HouseholdUser): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (!snap.exists()) throw new Error("Foyer introuvable");
    const next = withAcceptedMember(snap.data() as Household, { uid: user.uid, email: user.email });
    if ((next.memberUids?.length ?? 0) > MAX_HOUSEHOLD) throw new Error("Foyer complet");
    tx.set(householdDoc(hid), next);
    // migrated:false → la fusion de MES données dans le foyer sera faite une fois
    // par le coordinateur de sync (writeSharedData), puis le flag passera à true.
    tx.set(householdPointerDoc(user.uid), { id: hid, migrated: false, updatedAt: Date.now() });
  });
}

/**
 * Refuse / retire une invitation en attente (par email).
 *
 * @param hid - L'identifiant du foyer.
 * @param email - L'email de l'invitation.
 * @returns La promesse de transaction.
 */
export async function declineInvite(hid: string, email: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (!snap.exists()) return;
    tx.set(householdDoc(hid), withInviteRemoved(snap.data() as Household, email));
  });
}

/**
 * Un membre quitte le foyer (le propriétaire, lui, dissout via {@link dissolveHousehold}).
 *
 * @param hid - L'identifiant du foyer.
 * @param user - Le membre qui part.
 * @returns La promesse de transaction.
 */
export async function leaveHousehold(hid: string, user: HouseholdUser): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (snap.exists()) tx.set(householdDoc(hid), withMemberRemoved(snap.data() as Household, { uid: user.uid, email: user.email }));
    tx.delete(householdPointerDoc(user.uid));
  });
}

/**
 * Le propriétaire dissout le foyer (les autres membres détectent la disparition via
 * leur abonnement et nettoient leur propre pointeur).
 *
 * @param hid - L'identifiant du foyer.
 * @param uid - L'identifiant du propriétaire.
 * @returns La promesse de commit.
 */
export async function dissolveHousehold(hid: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(householdDoc(hid));
  batch.delete(householdPointerDoc(uid));
  await batch.commit();
}

/**
 * Sort l'utilisateur de TOUS ses foyers en une passe : supprime ceux qu'il possède
 * (dissolution) et quitte les autres, puis efface son pointeur. Robuste aux doublons
 * (foyers fantômes créés par erreur avant le garde-fou de création) : sans quoi,
 * n'agir que sur le premier foyer laissait les suivants remonter, donnant l'illusion
 * qu'« il ne se passe rien ». Sert autant à la dissolution (propriétaire) qu'au départ.
 *
 * @param user - L'utilisateur qui sort.
 * @returns La promesse de commit (rejette si une écriture est refusée).
 */
export async function exitAllHouseholds(user: HouseholdUser): Promise<void> {
  const snap = await getDocs(householdMemberQuery(user.uid));
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Household) }));
  const { deleteIds, leave } = planHouseholdExit(docs, user);
  const batch = writeBatch(db);
  for (const id of deleteIds) batch.delete(householdDoc(id));
  for (const { id, next } of leave) batch.set(householdDoc(id), next);
  batch.delete(householdPointerDoc(user.uid));
  await batch.commit();
}

/**
 * Nettoie le pointeur de foyer de l'utilisateur courant (ex. foyer dissous par autrui).
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @returns La promesse de suppression (erreurs avalées).
 */
export async function clearHouseholdPointer(uid: string): Promise<void> {
  await deleteDoc(householdPointerDoc(uid)).catch(() => {});
}

/**
 * Abonnement temps réel au pointeur de foyer actif.
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @param cb - Rappel invoqué avec `{ id, migrated }` ou `null` (aucun foyer / erreur).
 * @returns La fonction de désabonnement.
 */
export function subscribeHouseholdPointer(uid: string, cb: (data: DocumentData | null) => void): Unsubscribe {
  // Sur ERREUR d'écoute (perte réseau, jeton en cours de rafraîchissement, blip de
  // permission), on n'émet PAS `null` : signaler « aucun foyer » ferait basculer
  // l'app vers l'espace solo (perso) et donc afficher un tout autre jeu de données
  // (ex. 10 recettes / 0 carnet au lieu du foyer). On IGNORE l'erreur et on garde le
  // dernier pointeur connu ; le cache Firestore continue de servir les données du
  // foyer, et la reconnexion réémettra un snapshot frais.
  return onSnapshot(householdPointerDoc(uid), s => cb(s.exists() ? s.data() : null), () => { /* garder le dernier pointeur connu */ });
}
