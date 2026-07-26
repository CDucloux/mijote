import { doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit, where, runTransaction, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { newHouseholdDoc, withInvite, withInviteRemoved, withAcceptedMember, withMemberRemoved, peopleCount, MAX_HOUSEHOLD } from "./household.js";
import { householdWorkspace } from "./workspace.js";

// ─── FIRESTORE DATA LAYER (split documents) ──────────────────────────────────
// Structure:
//   users/{uid}/recipes/{recipeId}   – one doc per recipe (own 1MB budget each)
//   users/{uid}/meta/collections     – { items: [...] }
//   users/{uid}/meta/mealPlan        – { data: {...} }
//   users/{uid}/meta/shoppingLists   – { items: [...] }
//   users/{uid}/meta/fridge          – { items: [...], settings: {...} }
//   users/{uid}/meta/userDB          – { ingredients: [...], utensils: [...] }
//   master/ingredients               – { items: [...] } (shared, read-only for users)
//   master/utensils                  – { items: [...] }
//   master/techniques                – { items: [...] } (glossaire des techniques)

// Helpers résolus depuis un `workspace` (cf. lib/workspace.js) : `ws.segments` est
// le préfixe de chemin du namespace actif (users/{uid} en solo, households/{hid}
// en foyer). On accepte aussi un uid brut (string) pour rétro-compat ponctuelle.
const segmentsOf = (ws) => (typeof ws === "string" ? ["users", ws] : ws.segments);
export const metaDoc = (ws, name) => doc(db, ...segmentsOf(ws), "meta", name);
export const recipesCol = (ws) => collection(db, ...segmentsOf(ws), "recipes");
// Listes de courses partagées (lecture/écriture entre membres) : collection top-level
// Annuaire des utilisateurs connus (avatars des membres du foyer, invitations).
export const userDirCol = () => collection(db, "userDirectory");
export const userDirDoc = (uid) => doc(db, "userDirectory", uid);

// Inscrit/actualise ma fiche d'annuaire (pour que les autres puissent m'inviter
// et afficher mon avatar). Un seul write par session.
export function upsertOwnDirectoryEntry(user) {
  return setDoc(userDirDoc(user.uid), {
    uid: user.uid, email: (user.email || "").toLowerCase(),
    displayName: user.displayName || "", photoURL: user.photoURL || "", updatedAt: Date.now(),
  }, { merge: true });
}

// Charge l'annuaire des utilisateurs. À la DEMANDE uniquement (invitations,
// partage de liste, avatars de foyer) : ne JAMAIS l'appeler au chargement pour
// tout le monde — l'immense majorité (utilisateurs solo) n'en a aucun besoin, et
// un getDocs global à chaque session fait exploser les lectures Firestore.
// `emails` optionnel : ciblage par email (chunks de 10 pour l'opérateur `in`).
export async function fetchUserDirectory(emails) {
  if (!emails) {
    const s = await getDocs(userDirCol());
    return s.docs.map(d => d.data());
  }
  const list = [...new Set(emails.map(e => (e || "").toLowerCase()).filter(Boolean))];
  const out = [];
  for (let i = 0; i < list.length; i += 10) {
    const s = await getDocs(query(userDirCol(), where("email", "in", list.slice(i, i + 10))));
    out.push(...s.docs.map(d => d.data()));
  }
  return out;
}

// Recettes publiques (communauté) : collection top-level lisible par tous les
// connectés, écrite uniquement par l'auteur (cf. firestore.rules).
export const publicRecipesCol = () => collection(db, "publicRecipes");
export const publicRecipeDoc = (pubId) => doc(db, "publicRecipes", pubId);

// Publie un bundle (recette + ses composants) en une transaction batch.
export async function publishPublicBundle(docs) {
  const batch = writeBatch(db);
  for (const d of docs) batch.set(publicRecipeDoc(d.pubId), d);
  await batch.commit();
}

// Dépublie un ensemble de docs publics (par pubId) en une transaction batch.
export async function unpublishPublicDocs(pubIds) {
  if (!pubIds.length) return;
  const batch = writeBatch(db);
  for (const id of pubIds) batch.delete(publicRecipeDoc(id));
  await batch.commit();
}

// Charge les N recettes publiques les plus récentes (composants inclus ; le
// filtrage/affichage les écarte). Tri sur createdAt → index simple automatique.
export async function fetchPublicRecipes(max = 120) {
  const snap = await getDocs(query(publicRecipesCol(), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map(d => d.data());
}

// Récupère des composants publics par leurs pubId (pour le clone en cascade).
export async function fetchPublicDocsByIds(pubIds) {
  const unique = [...new Set(pubIds)].filter(Boolean);
  const snaps = await Promise.all(unique.map(id => getDoc(publicRecipeDoc(id))));
  return snaps.filter(s => s.exists()).map(s => s.data());
}


// ─── FOYERS (households) ──────────────────────────────────────────────────────
// households/{hid} : doc d'appartenance (cf. lib/household.js). Le pointeur du
// foyer actif de chaque utilisateur vit dans son espace privé : users/{uid}/meta/household.
export const householdsCol = () => collection(db, "households");
export const householdDoc = (hid) => doc(db, "households", hid);
const householdPointerDoc = (uid) => doc(db, "users", uid, "meta", "household");

// Requêtes temps réel : mon foyer actif (par uid) et mes invitations (par email).
export const householdMemberQuery = (uid) => query(householdsCol(), where("memberUids", "array-contains", uid));
export const householdInviteQuery = (email) => query(householdsCol(), where("invitedEmails", "array-contains", (email || "").toLowerCase()));

// Pointeur du foyer actif. `migrated` indique si la fusion des données a eu lieu
// (true dès la création – données déjà semées ; false à l'adhésion – fusion à
// faire une fois par le coordinateur de sync).
export function setHouseholdPointer(uid, id, migrated) {
  return setDoc(householdPointerDoc(uid), { id, migrated: !!migrated, updatedAt: Date.now() });
}

// Charge uniquement les slices PARTAGÉS d'un workspace (pour la migration/sync foyer).
export async function loadSharedData(ws) {
  const d = await loadUserData(ws);
  return {
    recipes: d.recipes || [],
    collections: d.collections || [],
    mealPlan: d.mealPlan || {},
    shoppingLists: d.shoppingLists || [],
    stock: d.stock || [],
    lowStock: d.lowStock || [],
  };
}

// Écrit les slices partagés dans un workspace (recettes en diff + méta en bloc).
// Renvoie la nouvelle carte de synchro des recettes.
export async function writeSharedData(ws, data, recipeMap = new Map()) {
  const newMap = await syncRecipes(ws, data.recipes || [], recipeMap);
  const batch = writeBatch(db);
  batch.set(metaDoc(ws, "collections"), { items: data.collections || [] });
  batch.set(metaDoc(ws, "mealPlan"), { data: data.mealPlan || {} });
  batch.set(metaDoc(ws, "shoppingLists"), { items: data.shoppingLists || [] });
  batch.set(metaDoc(ws, "stock"), { items: data.stock || [], low: data.lowStock || [] });
  await batch.commit();
  return newMap;
}

// Crée un foyer, y SÈME les données du créateur, puis pointe son espace dessus
// (pointeur posé EN DERNIER pour éviter toute course avec le coordinateur de sync).
export async function createHousehold(user, name, sharedData) {
  const ref = doc(householdsCol());
  await setDoc(ref, newHouseholdDoc({ id: ref.id, owner: user, name }));
  const ws = householdWorkspace(ref.id);
  await writeSharedData(ws, sharedData || {});
  await setHouseholdPointer(user.uid, ref.id, true); // déjà migré (semé)
  return ref.id;
}

// Invite un email (transaction : relit le doc pour respecter le plafond côté serveur).
export async function inviteToHousehold(hid, email) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (!snap.exists()) throw new Error("Foyer introuvable");
    const next = withInvite(snap.data(), email);
    if (peopleCount(next) > MAX_HOUSEHOLD) throw new Error("Foyer complet");
    tx.set(householdDoc(hid), next);
  });
}

// Accepte une invitation : invité → membre, et pointe mon espace sur le foyer.
export async function acceptInvite(hid, user) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (!snap.exists()) throw new Error("Foyer introuvable");
    const next = withAcceptedMember(snap.data(), { uid: user.uid, email: user.email });
    if (next.memberUids.length > MAX_HOUSEHOLD) throw new Error("Foyer complet");
    tx.set(householdDoc(hid), next);
    // migrated:false → la fusion de MES données dans le foyer sera faite une fois
    // par le coordinateur de sync (writeSharedData), puis le flag passera à true.
    tx.set(householdPointerDoc(user.uid), { id: hid, migrated: false, updatedAt: Date.now() });
  });
}

// Refuse / retire une invitation en attente (par email).
export async function declineInvite(hid, email) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (!snap.exists()) return;
    tx.set(householdDoc(hid), withInviteRemoved(snap.data(), email));
  });
}

// Un membre quitte le foyer (le propriétaire, lui, dissout via deleteHousehold).
export async function leaveHousehold(hid, user) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(householdDoc(hid));
    if (snap.exists()) tx.set(householdDoc(hid), withMemberRemoved(snap.data(), { uid: user.uid, email: user.email }));
    tx.delete(householdPointerDoc(user.uid));
  });
}

// Le propriétaire dissout le foyer (les autres membres détectent la disparition via
// leur abonnement et nettoient leur propre pointeur).
export async function dissolveHousehold(hid, uid) {
  const batch = writeBatch(db);
  batch.delete(householdDoc(hid));
  batch.delete(householdPointerDoc(uid));
  await batch.commit();
}

// Nettoie le pointeur de foyer de l'utilisateur courant (ex. foyer dissous par autrui).
export async function clearHouseholdPointer(uid) {
  await deleteDoc(householdPointerDoc(uid)).catch(() => {});
}

// Suppression RGPD : efface TOUTES les données personnelles de l'utilisateur
// (recettes, méta perso + partagé solo, fiche d'annuaire, pointeur de foyer).
// Les données d'un foyer partagé ne sont PAS supprimées ici (elles appartiennent
// au foyer) : le membre est simplement retiré via son pointeur.
const USER_META_NAMES = ["collections", "mealPlan", "shoppingLists", "stock", "userDB", "preferences", "household"];
export async function deleteAllUserData(uid) {
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

// Abonnement temps réel au pointeur de foyer actif ({ id, migrated } | null).
export function subscribeHouseholdPointer(uid, cb) {
  return onSnapshot(householdPointerDoc(uid), s => cb(s.exists() ? s.data() : null), () => cb(null));
}

// Read the shared Master reference DB (ingredients + utensils + categories).
export async function loadMasterDB() {
  try {
    const [ing, ut, cat, tech] = await Promise.all([
      getDoc(doc(db, "master", "ingredients")),
      getDoc(doc(db, "master", "utensils")),
      getDoc(doc(db, "master", "categories")),
      getDoc(doc(db, "master", "techniques")),
    ]);
    return {
      ingredients: ing.exists() ? (ing.data().items || []) : [],
      utensils: ut.exists() ? (ut.data().items || []) : [],
      techniques: tech.exists() ? (tech.data().items || []) : [],
      categories: cat.exists() && cat.data().map && Object.keys(cat.data().map).length
        ? Object.fromEntries(Object.entries({ ...DEFAULT_CATEGORIES, ...cat.data().map }).filter(([k]) => k in DEFAULT_CATEGORIES)) : DEFAULT_CATEGORIES,
    };
  } catch {
    return { ingredients: [], utensils: [], techniques: [], categories: DEFAULT_CATEGORIES };
  }
}

// Load all of a workspace's data from the split structure.
export async function loadUserData(ws) {
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

// One-time migration from the legacy single doc (users/{uid}/data/app).
export async function migrateLegacyDoc(uid) {
  try {
    const legacy = await getDoc(doc(db, "users", uid, "data", "app"));
    if (!legacy.exists()) return null;
    return legacy.data();
  } catch {
    return null;
  }
}

// Diff-based recipe sync: write only changed/new recipes, delete removed ones.
export async function syncRecipes(ws, recipes, lastSyncedMap) {
  const batch = writeBatch(db);
  const col = recipesCol(ws);
  const currentIds = new Set();
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
  const newMap = new Map();
  for (const r of recipes) if (r.id) newMap.set(r.id, r);
  return newMap;
}
