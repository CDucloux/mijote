import { doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";

// ─── FIRESTORE DATA LAYER (split documents) ──────────────────────────────────
// Structure:
//   users/{uid}/recipes/{recipeId}   — one doc per recipe (own 1MB budget each)
//   users/{uid}/meta/collections     — { items: [...] }
//   users/{uid}/meta/mealPlan        — { data: {...} }
//   users/{uid}/meta/shoppingLists   — { items: [...] }
//   users/{uid}/meta/fridge          — { items: [...], settings: {...} }
//   users/{uid}/meta/userDB          — { ingredients: [...], utensils: [...] }
//   master/ingredients               — { items: [...] } (shared, read-only for users)
//   master/utensils                  — { items: [...] }
//   master/techniques                — { items: [...] } (glossaire des techniques)

export const metaDoc = (uid, name) => doc(db, "users", uid, "meta", name);
export const recipesCol = (uid) => collection(db, "users", uid, "recipes");
// Listes de courses partagées (lecture/écriture entre membres) : collection top-level
// autorisée par e-mail côté règles Firestore. Annuaire des utilisateurs connus pour
// proposer les e-mails disponibles avec avatar.
export const sharedListsCol = () => collection(db, "sharedLists");
export const sharedListDoc = (id) => doc(db, "sharedLists", id);
export const userDirCol = () => collection(db, "userDirectory");
export const userDirDoc = (uid) => doc(db, "userDirectory", uid);

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

// Nettoie une liste avant écriture dans sharedLists (retire les champs internes _*).
export function toSharedListDoc(list, { ownerEmail, ownerUid }) {
  const sharedWith = Array.from(new Set((list.sharedWith || []).map(e => (e || "").trim().toLowerCase()).filter(Boolean)));
  const memberEmails = Array.from(new Set([ownerEmail, ...sharedWith].filter(Boolean)));
  return {
    id: list.id,
    name: list.name || "",
    type: list.type || "free",
    items: list.items || [],
    hideClear: !!list.hideClear,
    sharedWith,
    ownerEmail,
    ownerUid: ownerUid || null,
    memberEmails,
    updatedAt: Date.now(),
  };
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

// Load all of a user's data from the split structure.
export async function loadUserData(uid) {
  const [recipesSnap, collectionsSnap, mealPlanSnap, shoppingSnap, stockSnap, userDBSnap, prefsSnap] = await Promise.all([
    getDocs(recipesCol(uid)),
    getDoc(metaDoc(uid, "collections")),
    getDoc(metaDoc(uid, "mealPlan")),
    getDoc(metaDoc(uid, "shoppingLists")),
    getDoc(metaDoc(uid, "stock")),
    getDoc(metaDoc(uid, "userDB")),
    getDoc(metaDoc(uid, "preferences")),
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
export async function syncRecipes(uid, recipes, lastSyncedMap) {
  const batch = writeBatch(db);
  const currentIds = new Set();
  let ops = 0;
  for (const r of recipes) {
    if (!r.id) continue;
    currentIds.add(r.id);
    const prev = lastSyncedMap.get(r.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) {
      batch.set(doc(recipesCol(uid), r.id), r);
      ops++;
    }
  }
  for (const id of lastSyncedMap.keys()) {
    if (!currentIds.has(id)) { batch.delete(doc(recipesCol(uid), id)); ops++; }
  }
  if (ops > 0) await batch.commit();
  const newMap = new Map();
  for (const r of recipes) if (r.id) newMap.set(r.id, r);
  return newMap;
}
