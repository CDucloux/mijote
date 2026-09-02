/**
 * Couche d'accès Firestore (documents éclatés). Structure :
 * - `users/{uid}/recipes/{recipeId}`, un doc par recette (budget 1 Mo chacun)
 * - `users/{uid}/meta/{collections|mealPlan|shoppingLists|stock|userDB|preferences}`
 * - `master/{ingredients|utensils|categories|techniques}`, partagé, lecture seule
 * - `households/{hid}`, appartenance au foyer ; `publicRecipes/{pubId}`, communauté
 *
 * Les helpers de chemin sont résolus depuis un `workspace` (`ws.segments` = préfixe
 * du namespace actif : `users/{uid}` en solo, `households/{hid}` en foyer). Un uid
 * brut (string) reste accepté pour rétro-compat ponctuelle.
 *
 * @module firestore
 */
import {
  doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit, where,
  runTransaction, deleteDoc, setDoc, addDoc, serverTimestamp, onSnapshot,
  type DocumentData, type DocumentReference, type CollectionReference,
  type Query, type DocumentSnapshot, type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, firebaseApp } from "@/lib/firebase/firebase.js";
import { reportError } from "@/lib/observability/observability.js";
import { DEFAULT_CATEGORIES } from "@/constants/categories.js";
import {
  withInvite, withInviteRemoved, withAcceptedMember, withMemberRemoved,
  peopleCount, MAX_HOUSEHOLD, type Household, type HouseholdUser,
} from "@/lib/household/household.js";
import { householdWorkspace, type Workspace } from "@/lib/household/workspace.js";
import type { SharedData } from "@/lib/household/householdMigration.js";
import type { PublicDoc } from "@/lib/household/publicRecipes.js";
import type { Recipe } from "@/lib/types.js";

/** Workspace actif, ou uid brut (rétro-compat). */
export type WorkspaceRef = Workspace | string;

/** Fiche d'annuaire d'un utilisateur (avatar, email, nom). */
export interface DirectoryUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/** Données complètes d'un workspace, telles que lues depuis la structure éclatée. */
export interface UserData {
  recipes: DocumentData[];
  collections: unknown[] | null;
  mealPlan: Record<string, unknown> | null;
  shoppingLists: unknown[] | null;
  stock: unknown[] | null;
  lowStock: unknown[] | null;
  userDB: DocumentData | null;
  preferences: DocumentData | null;
}

/** Table des catégories (clé → définition d'affichage). Valeurs opaques ici. */
export type CategoryMap = Record<string, unknown>;

/** Base Master partagée (ingrédients, ustensiles, techniques, catégories). */
export interface MasterDB {
  ingredients: DocumentData[];
  utensils: DocumentData[];
  techniques: DocumentData[];
  sources: DocumentData[];
  categories: CategoryMap;
}

const segmentsOf = (ws: WorkspaceRef): string[] => (typeof ws === "string" ? ["users", ws] : ws.segments);

export const metaDoc = (ws: WorkspaceRef, name: string): DocumentReference => doc(db, [...segmentsOf(ws), "meta", name].join("/"));
export const recipesCol = (ws: WorkspaceRef): CollectionReference => collection(db, [...segmentsOf(ws), "recipes"].join("/"));

// Annuaire des utilisateurs connus (avatars des membres du foyer, invitations).
export const userDirCol = (): CollectionReference => collection(db, "userDirectory");
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

// Recettes publiques (communauté) : collection top-level lisible par tous les
// connectés, écrite uniquement par l'auteur (cf. firestore.rules).
export const publicRecipesCol = (): CollectionReference => collection(db, "publicRecipes");
export const publicRecipeDoc = (pubId: string): DocumentReference => doc(db, "publicRecipes", pubId);

/**
 * Supprime UNE recette publique (modération admin). Ne retire QUE le document
 * public `publicRecipes/{pubId}`, la copie privée de l'auteur n'est pas touchée
 * (elle est dans son espace, inaccessible depuis ici). Autorisé par les règles
 * pour l'auteur (dépublication) OU l'admin (modération).
 *
 * @param pubId - L'identifiant du document public.
 */
export async function deletePublicRecipe(pubId: string): Promise<void> {
  await deleteDoc(publicRecipeDoc(pubId));
}

/** Détails d'un signalement de recette publique (modération). */
export interface RecipeReport {
  pubId: string;
  recipeName?: string;
  authorUid?: string;
  reason: string;
  note?: string;
  reporterUid: string;
  reporterEmail?: string | null;
}

/**
 * Enregistre un signalement d'une recette publique (droit d'auteur, photo
 * inappropriée…) dans `reports/{autoId}`. Lisible uniquement par l'admin.
 *
 * @param report - Les détails du signalement.
 */
export async function reportPublicRecipe(report: RecipeReport): Promise<void> {
  await addDoc(collection(db, "reports"), { ...report, createdAt: serverTimestamp() });
}

/** Un signalement tel que lu par la modération (id du doc + horodatage résolu). */
export interface StoredReport extends RecipeReport {
  id: string;
  createdAtMs: number | null;
}

/**
 * Charge tous les signalements (modération admin), du plus récent au plus ancien.
 *
 * @returns La liste des signalements stockés.
 */
export async function loadReports(): Promise<StoredReport[]> {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => {
    const data = d.data() as RecipeReport & { createdAt?: { toMillis?: () => number } };
    return { ...data, id: d.id, createdAtMs: data.createdAt?.toMillis?.() ?? null };
  });
}

/**
 * Rejette (supprime) un signalement précis.
 *
 * @param id - L'identifiant du document `reports`.
 */
export async function resolveReport(id: string): Promise<void> {
  await deleteDoc(doc(db, "reports", id));
}

/**
 * Rejette tous les signalements visant une même recette publique (ex. après
 * suppression de la recette).
 *
 * @param pubId - L'identifiant public de la recette.
 */
export async function resolveReportsForRecipe(pubId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, "reports"), where("pubId", "==", pubId)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

/**
 * Publie un bundle (recette + ses composants) en une transaction batch.
 *
 * @param docs - Les documents publics à écrire (indexés par `pubId`).
 * @returns La promesse de commit.
 */
export async function publishPublicBundle(docs: PublicDoc[]): Promise<void> {
  const batch = writeBatch(db);
  for (const d of docs) batch.set(publicRecipeDoc(d.pubId), d);
  await batch.commit();
}

/**
 * Dépublie un ensemble de docs publics (par `pubId`) en une transaction batch.
 *
 * @param pubIds - Les identifiants publics à supprimer.
 * @returns La promesse de commit (no-op si la liste est vide).
 */
export async function unpublishPublicDocs(pubIds: string[]): Promise<void> {
  if (!pubIds.length) return;
  const batch = writeBatch(db);
  for (const id of pubIds) batch.delete(publicRecipeDoc(id));
  await batch.commit();
}

/**
 * Charge les N recettes publiques les plus récentes (composants inclus ; le
 * filtrage/affichage les écarte). Tri sur `createdAt` → index simple automatique.
 *
 * @param max - Nombre maximum de recettes (défaut 120).
 * @returns Les documents publics, du plus récent au plus ancien.
 */
export async function fetchPublicRecipes(max = 120): Promise<DocumentData[]> {
  const snap = await getDocs(query(publicRecipesCol(), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map(d => d.data());
}

/**
 * Récupère des composants publics par leurs `pubId` (pour le clone en cascade).
 *
 * @param pubIds - Les identifiants publics recherchés.
 * @returns Les documents existants (dédupliqués).
 */
export async function fetchPublicDocsByIds(pubIds: string[]): Promise<DocumentData[]> {
  const unique = [...new Set(pubIds)].filter(Boolean);
  const snaps = await Promise.all(unique.map(id => getDoc(publicRecipeDoc(id))));
  return snaps.filter(s => s.exists()).map(s => s.data() as DocumentData);
}


// ─── FOYERS (households) ──────────────────────────────────────────────────────
// households/{hid} : doc d'appartenance (cf. lib/household.js). Le pointeur du
// foyer actif de chaque utilisateur vit dans son espace privé : users/{uid}/meta/household.
export const householdsCol = (): CollectionReference => collection(db, "households");
export const householdDoc = (hid: string): DocumentReference => doc(db, "households", hid);
const householdPointerDoc = (uid: string): DocumentReference => doc(db, "users", uid, "meta", "household");

// Requêtes temps réel : mon foyer actif (par uid) et mes invitations (par email).
export const householdMemberQuery = (uid: string): Query => query(householdsCol(), where("memberUids", "array-contains", uid));
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
 * Charge uniquement les slices PARTAGÉS d'un workspace (pour la migration/sync foyer).
 *
 * @param ws - Le workspace source.
 * @returns Les slices partageables (recettes, carnets, planning, listes, stock).
 */
export async function loadSharedData(ws: WorkspaceRef): Promise<Required<SharedData>> {
  const d = await loadUserData(ws);
  return {
    recipes: (d.recipes || []) as Required<SharedData>["recipes"],
    collections: (d.collections || []) as Required<SharedData>["collections"],
    mealPlan: (d.mealPlan || {}) as Required<SharedData>["mealPlan"],
    shoppingLists: (d.shoppingLists || []) as Required<SharedData>["shoppingLists"],
    stock: (d.stock || []) as Required<SharedData>["stock"],
    lowStock: (d.lowStock || []) as Required<SharedData>["lowStock"],
  };
}

/**
 * Écrit les slices partagés dans un workspace (recettes en diff + méta en bloc).
 *
 * @param ws - Le workspace cible.
 * @param data - Les slices à écrire.
 * @param recipeMap - Carte de synchro précédente des recettes (diff).
 * @returns La nouvelle carte de synchro des recettes.
 */
export async function writeSharedData(ws: WorkspaceRef, data: SharedData, recipeMap: Map<string, Recipe> = new Map()): Promise<Map<string, Recipe>> {
  const newMap = await syncRecipes(ws, (data.recipes || []) as Recipe[], recipeMap);
  const batch = writeBatch(db);
  batch.set(metaDoc(ws, "collections"), { items: data.collections || [] });
  batch.set(metaDoc(ws, "mealPlan"), { data: data.mealPlan || {} });
  batch.set(metaDoc(ws, "shoppingLists"), { items: data.shoppingLists || [] });
  batch.set(metaDoc(ws, "stock"), { items: data.stock || [], low: data.lowStock || [] });
  await batch.commit();
  return newMap;
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
 * Nettoie le pointeur de foyer de l'utilisateur courant (ex. foyer dissous par autrui).
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @returns La promesse de suppression (erreurs avalées).
 */
export async function clearHouseholdPointer(uid: string): Promise<void> {
  await deleteDoc(householdPointerDoc(uid)).catch(() => {});
}

// Suppression RGPD : efface TOUTES les données personnelles de l'utilisateur
// (recettes, méta perso + partagé solo, fiche d'annuaire, pointeur de foyer). Les
// données d'un foyer partagé ne sont PAS supprimées ici (elles appartiennent au
// foyer) : le membre est simplement retiré via son pointeur.
const USER_META_NAMES = ["collections", "mealPlan", "shoppingLists", "stock", "userDB", "preferences", "household"];

/**
 * Efface toutes les données personnelles d'un utilisateur (RGPD).
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @returns La promesse de suppression (recettes par lots + méta + annuaire).
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  // Recettes : suppression par lots de 400 (limite Firestore 500 op/batch).
  const snap = await getDocs(collection(db, "users", uid, "recipes"));
  const refs = snap.docs.map(d => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach(r => batch.delete(r));
    await batch.commit();
  }
  const batch = writeBatch(db);
  USER_META_NAMES.forEach(n => batch.delete(doc(db, "users", uid, "meta", n)));
  batch.delete(userDirDoc(uid));
  await batch.commit();
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

/**
 * Lit la base Master partagée (ingrédients + ustensiles + techniques + catégories).
 *
 * @returns La base Master (repli sur des tableaux vides + catégories par défaut en cas d'erreur).
 */
export async function loadMasterDB(): Promise<MasterDB> {
  try {
    const [ing, ut, cat, tech, src] = await Promise.all([
      getDoc(doc(db, "master", "ingredients")),
      getDoc(doc(db, "master", "utensils")),
      getDoc(doc(db, "master", "categories")),
      getDoc(doc(db, "master", "techniques")),
      getDoc(doc(db, "master", "sources")),
    ]);
    return {
      ingredients: ing.exists() ? (ing.data().items || []) : [],
      utensils: ut.exists() ? (ut.data().items || []) : [],
      techniques: tech.exists() ? (tech.data().items || []) : [],
      sources: src.exists() ? (src.data().items || []) : [],
      categories: cat.exists() ? normCategories(cat.data()) : DEFAULT_CATEGORIES,
    };
  } catch (e) {
    // Échec de lecture de la Master (souvent droits refusés sur `master/*` si la
    // session est dégradée). On loggue au lieu d'avaler silencieusement : c'est un
    // signal fort (l'appli se retrouverait sans ingrédients/ustensiles). L'appelant
    // (bootstrap) protège désormais le cache d'un écrasement par ce repli vide.
    reportError(e, { where: "loadMasterDB" });
    return { ingredients: [], utensils: [], techniques: [], sources: [], categories: DEFAULT_CATEGORIES };
  }
}

/** Normalise le doc `master/categories` (fusion défauts + overrides, filtré aux clés connues). */
function normCategories(data: DocumentData | undefined): CategoryMap {
  return data && data.map && Object.keys(data.map).length
    ? Object.fromEntries(Object.entries({ ...DEFAULT_CATEGORIES, ...data.map }).filter(([k]) => k in DEFAULT_CATEGORIES))
    : DEFAULT_CATEGORIES;
}

/**
 * Abonnement TEMPS RÉEL à la base Master (4 docs). Émet l'objet complet à chaque
 * changement, une fois les 4 docs reçus (évite d'émettre un état partiel).
 *
 * @param cb - Rappel invoqué avec la base Master complète à chaque mise à jour.
 * @returns La fonction de désabonnement (dénoue les 4 abonnements).
 */
export function subscribeMasterDB(cb: (masterDb: MasterDB) => void): Unsubscribe {
  const latest: MasterDB = { ingredients: [], utensils: [], techniques: [], sources: [], categories: DEFAULT_CATEGORIES };
  const seen = { ingredients: false, utensils: false, techniques: false, sources: false, categories: false };
  const emit = (): void => { if (seen.ingredients && seen.utensils && seen.techniques && seen.sources && seen.categories) cb({ ...latest }); };
  const bind = <K extends keyof MasterDB>(name: string, key: K, pick: (s: DocumentSnapshot) => MasterDB[K]): Unsubscribe =>
    onSnapshot(doc(db, "master", name),
      s => { latest[key] = pick(s); seen[key] = true; emit(); }, () => { });
  const subs = [
    bind("ingredients", "ingredients", s => s.exists() ? (s.data().items || []) : []),
    bind("utensils", "utensils", s => s.exists() ? (s.data().items || []) : []),
    bind("techniques", "techniques", s => s.exists() ? (s.data().items || []) : []),
    bind("sources", "sources", s => s.exists() ? (s.data().items || []) : []),
    bind("categories", "categories", s => s.exists() ? normCategories(s.data()) : DEFAULT_CATEGORIES),
  ];
  return () => subs.forEach(u => u());
}

/**
 * Charge toutes les données d'un workspace depuis la structure éclatée.
 *
 * @param ws - Le workspace source.
 * @returns Les données du workspace (les slices absents valent `null`).
 */
export async function loadUserData(ws: WorkspaceRef): Promise<UserData> {
  const [recipesSnap, collectionsSnap, mealPlanSnap, shoppingSnap, stockSnap, userDBSnap, prefsSnap] = await Promise.all([
    getDocs(recipesCol(ws)),
    getDoc(metaDoc(ws, "collections")),
    getDoc(metaDoc(ws, "mealPlan")),
    getDoc(metaDoc(ws, "shoppingLists")),
    getDoc(metaDoc(ws, "stock")),
    getDoc(metaDoc(ws, "userDB")),
    getDoc(metaDoc(ws, "preferences")),
  ]);
  return {
    recipes: recipesSnap.docs.map(d => d.data()),
    collections: collectionsSnap.exists() ? (collectionsSnap.data().items || []) : null,
    mealPlan: mealPlanSnap.exists() ? (mealPlanSnap.data().data || {}) : null,
    shoppingLists: shoppingSnap.exists() ? (shoppingSnap.data().items || []) : null,
    stock: stockSnap.exists() ? (stockSnap.data().items || []) : null,
    lowStock: stockSnap.exists() ? (stockSnap.data().low || []) : null,
    userDB: userDBSnap.exists() ? userDBSnap.data() : null,
    preferences: prefsSnap.exists() ? prefsSnap.data() : null,
  };
}

/**
 * Migration ponctuelle depuis l'ancien document unique (`users/{uid}/data/app`).
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @returns Les données legacy, ou `null` si absentes/illisibles.
 */
export async function migrateLegacyDoc(uid: string): Promise<DocumentData | null> {
  try {
    const legacy = await getDoc(doc(db, "users", uid, "data", "app"));
    if (!legacy.exists()) return null;
    return legacy.data();
  } catch {
    return null;
  }
}

/**
 * Sync des recettes par diff : n'écrit que les recettes nouvelles/modifiées et
 * supprime celles retirées.
 *
 * @param ws - Le workspace cible.
 * @param recipes - L'état courant des recettes.
 * @param lastSyncedMap - La carte de synchro précédente (id → recette).
 * @returns La nouvelle carte de synchro (id → recette).
 */
export async function syncRecipes(ws: WorkspaceRef, recipes: Recipe[], lastSyncedMap: Map<string, Recipe>): Promise<Map<string, Recipe>> {
  const batch = writeBatch(db);
  const col = recipesCol(ws);
  const currentIds = new Set<string>();
  let ops = 0;
  for (const r of recipes) {
    if (!r.id) continue;
    currentIds.add(r.id);
    const prev = lastSyncedMap.get(r.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) {
      batch.set(doc(col, r.id), r);
      ops++;
    }
  }
  for (const id of lastSyncedMap.keys()) {
    if (!currentIds.has(id)) { batch.delete(doc(col, id)); ops++; }
  }
  if (ops > 0) await batch.commit();
  const newMap = new Map<string, Recipe>();
  for (const r of recipes) if (r.id) newMap.set(r.id, r);
  return newMap;
}
