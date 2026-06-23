import { doc, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";
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

export const metaDoc = (uid, name) => doc(db, "users", uid, "meta", name);
export const recipesCol = (uid) => collection(db, "users", uid, "recipes");
// Listes de courses partagées (lecture/écriture entre membres) : collection top-level
// autorisée par e-mail côté règles Firestore. Annuaire des utilisateurs connus pour
// proposer les e-mails disponibles avec avatar.
export const sharedListsCol = () => collection(db, "sharedLists");
export const sharedListDoc = (id) => doc(db, "sharedLists", id);
export const userDirCol = () => collection(db, "userDirectory");
export const userDirDoc = (uid) => doc(db, "userDirectory", uid);

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
    const [ing, ut, cat] = await Promise.all([
      getDoc(doc(db, "master", "ingredients")),
      getDoc(doc(db, "master", "utensils")),
      getDoc(doc(db, "master", "categories")),
    ]);
    return {
      ingredients: ing.exists() ? (ing.data().items || []) : [],
      utensils: ut.exists() ? (ut.data().items || []) : [],
      categories: cat.exists() && cat.data().map && Object.keys(cat.data().map).length
        ? Object.fromEntries(Object.entries({ ...DEFAULT_CATEGORIES, ...cat.data().map }).filter(([k]) => k in DEFAULT_CATEGORIES)) : DEFAULT_CATEGORIES,
    };
  } catch {
    return { ingredients: [], utensils: [], categories: DEFAULT_CATEGORIES };
  }
}

// Load all of a user's data from the split structure.
export async function loadUserData(uid) {
  const [recipesSnap, collectionsSnap, mealPlanSnap, shoppingSnap, stockSnap, userDBSnap] = await Promise.all([
    getDocs(recipesCol(uid)),
    getDoc(metaDoc(uid, "collections")),
    getDoc(metaDoc(uid, "mealPlan")),
    getDoc(metaDoc(uid, "shoppingLists")),
    getDoc(metaDoc(uid, "stock")),
    getDoc(metaDoc(uid, "userDB")),
  ]);
  return {
    recipes: recipesSnap.docs.map(d => d.data()),
    collections: collectionsSnap.exists() ? (collectionsSnap.data().items || []) : null,
    mealPlan: mealPlanSnap.exists() ? (mealPlanSnap.data().data || {}) : null,
    shoppingLists: shoppingSnap.exists() ? (shoppingSnap.data().items || []) : null,
    stock: stockSnap.exists() ? (stockSnap.data().items || []) : null,
    lowStock: stockSnap.exists() ? (stockSnap.data().low || []) : null,
    userDB: userDBSnap.exists() ? userDBSnap.data() : null,
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
