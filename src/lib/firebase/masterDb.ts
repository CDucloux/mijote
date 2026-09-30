/**
 * Base Master partagée (ingrédients, ustensiles, techniques, sources, catégories).
 *
 * `master/{doc}` : documents partagés en lecture seule pour tout compte vérifié,
 * écrits par l'admin (cf. firestore.rules). Lecture ponctuelle ou en temps réel.
 *
 * @module firebase/masterDb
 */
import { doc, getDoc, onSnapshot, type DocumentData, type DocumentSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { reportError } from "@/lib/observability/observability.js";
import { DEFAULT_CATEGORIES } from "@/constants/categories.js";

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
