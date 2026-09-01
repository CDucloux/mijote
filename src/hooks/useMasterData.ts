import { useState, useMemo, useCallback } from "react";
import { DEFAULT_CATEGORIES } from "@/constants/categories.js";

/** Ligne de base (ingrédient/ustensile/technique), forme opaque. */
type DbRow = Record<string, unknown>;
/** Table des catégories nutritionnelles (clé → définition d'affichage). */
type CategoryMap = Record<string, unknown>;
/** Valeur ou updater façon `setState`. */
type Updater<T> = T | ((cur: T) => T);

/** Base Master partagée (admin en écriture). */
export interface MasterData {
  ingredients: DbRow[];
  utensils: DbRow[];
  techniques: DbRow[];
  sources: DbRow[];
  categories: CategoryMap;
}

/** Ajouts personnels (par utilisateur, hors Master). */
export interface PersonalDB {
  ingredients: DbRow[];
  utensils: DbRow[];
}

const resolve = <T,>(updater: Updater<T>, cur: T): T => (typeof updater === "function" ? (updater as (c: T) => T)(cur) : updater);

/**
 * Base de référence (Master partagée + ajouts perso). Ingrédients, ustensiles,
 * techniques et catégories nutritionnelles. La base Master est partagée (admin en
 * écriture) ; chaque utilisateur peut avoir ses propres ajouts (`userDB`). Les vues
 * fusionnent les deux et marquent `_ro` (lecture seule) pour les non-admins.
 * `masterDB`/`setMasterDB` et `userDB`/`setUserDB` restent exposés car la couche de
 * synchro Firestore (useFirestoreSync) les lit et les écrit.
 *
 * @param isAdmin - L'utilisateur peut-il écrire dans la Master ?
 * @returns Les bases, vues fusionnées et setters correspondants.
 */
export function useMasterData(isAdmin: boolean) {
  const [masterDB, setMasterDB] = useState<MasterData>(() => {
    try {
      const cached = localStorage.getItem("rf_masterDB_cache");
      if (cached) return JSON.parse(cached) as MasterData;
    } catch { /* ignore */ }
    return { ingredients: [], utensils: [], techniques: [], sources: [], categories: DEFAULT_CATEGORIES };
  });
  const [userDB, setUserDB] = useState<PersonalDB>({ ingredients: [], utensils: [] });

  // Catégories nutritionnelles : vivent dans la Master (admin), repli sur les défauts.
  const categories = useMemo<CategoryMap>(
    () => (masterDB.categories && Object.keys(masterDB.categories).length ? masterDB.categories : DEFAULT_CATEGORIES),
    [masterDB]
  );
  const setCategories = useCallback((updater: Updater<CategoryMap>) => {
    setMasterDB(prev => {
      const cur = prev.categories && Object.keys(prev.categories).length ? prev.categories : DEFAULT_CATEGORIES;
      return { ...prev, categories: resolve(updater, cur) };
    });
  }, []);

  // Vues fusionnées (Master + perso), éditables pour l'admin, lecture seule sinon.
  const ingredientDB = useMemo(
    () => [...masterDB.ingredients, ...userDB.ingredients].map(i => ({ ...i, _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );
  const utensilDB = useMemo(
    () => [...masterDB.utensils, ...userDB.utensils].map(u => ({ ...u, _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );

  // Écriture : l'admin écrit dans la Master partagée (en absorbant d'éventuels ajouts
  // perso/migrés) ; les non-admins n'écrivent jamais (base en lecture seule).
  const setIngredientDB = useCallback((updater: Updater<DbRow[]>) => {
    if (!isAdmin) return;
    const merged = [...masterDB.ingredients, ...userDB.ingredients];
    const next = resolve(updater, merged).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, ingredients: next }));
    if (userDB.ingredients.length) setUserDB(prev => ({ ...prev, ingredients: [] }));
  }, [masterDB, userDB, isAdmin]);
  const setUtensilDB = useCallback((updater: Updater<DbRow[]>) => {
    if (!isAdmin) return;
    const merged = [...masterDB.utensils, ...userDB.utensils];
    const next = resolve(updater, merged).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, utensils: next }));
    if (userDB.utensils.length) setUserDB(prev => ({ ...prev, utensils: [] }));
  }, [masterDB, userDB, isAdmin]);

  // Glossaire des techniques : entièrement Master (pas de pendant userDB).
  const techniques = useMemo(() => masterDB.techniques || [], [masterDB]);
  const setTechniques = useCallback((updater: Updater<DbRow[]>) => {
    if (!isAdmin) return;
    setMasterDB(prev => ({ ...prev, techniques: resolve(updater, prev.techniques || []) }));
  }, [isAdmin]);

  // Sources recommandées (page d'import « depuis un lien ») : Master seule, admin
  // en écriture. Lisibles par tous pour alimenter l'étagère de sources.
  const sources = useMemo(() => masterDB.sources || [], [masterDB]);
  const setSources = useCallback((updater: Updater<DbRow[]>) => {
    if (!isAdmin) return;
    setMasterDB(prev => ({ ...prev, sources: resolve(updater, prev.sources || []) }));
  }, [isAdmin]);

  return {
    masterDB, setMasterDB, userDB, setUserDB,
    categories, setCategories, ingredientDB, utensilDB, techniques, sources,
    setIngredientDB, setUtensilDB, setTechniques, setSources,
  };
}
