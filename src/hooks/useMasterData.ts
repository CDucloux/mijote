import { useState, useMemo, useCallback, type SetStateAction } from "react";
import { DEFAULT_CATEGORIES } from "@/constants/categories.js";
import type { IngredientCategories } from "@/lib/data/referenceData.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { MasterDB, PersonalDB } from "@/lib/firebase/masterDb.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { RecommendedSource } from "@/lib/sources/recommendedSources.js";
import type { IngredientDbItem, UtensilDbItem } from "@/lib/types.js";

/** Ingrédient de la vue fusionnée : nommé (repli `""`) et marqué lecture seule ou non. */
export type IngredientRow = IngredientDbItem & DbEntry & { _ro: boolean };
/** Ustensile de la vue fusionnée. */
export type UtensilRow = UtensilDbItem & DbEntry & { _ro: boolean };

const resolve = <T,>(updater: SetStateAction<T>, cur: T): T => (typeof updater === "function" ? (updater as (c: T) => T)(cur) : updater);
// Le marqueur de vue `_ro` ne doit jamais être réécrit dans la Master.
function stripRo<T extends Record<string, unknown>>(row: T): T {
  const copy: T = { ...row };
  delete copy._ro;
  return copy;
}

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
  const [masterDB, setMasterDB] = useState<MasterDB>(() => {
    try {
      const cached = localStorage.getItem("rf_masterDB_cache");
      if (cached) return JSON.parse(cached) as MasterDB;
    } catch { /* ignore */ }
    return { ingredients: [], utensils: [], techniques: [], sources: [], categories: DEFAULT_CATEGORIES };
  });
  const [userDB, setUserDB] = useState<PersonalDB>({ ingredients: [], utensils: [] });

  // Catégories nutritionnelles : vivent dans la Master (admin), repli sur les défauts.
  const categories = useMemo<IngredientCategories>(
    () => (masterDB.categories && Object.keys(masterDB.categories).length ? masterDB.categories : DEFAULT_CATEGORIES),
    [masterDB]
  );
  const setCategories = useCallback((updater: SetStateAction<IngredientCategories>) => {
    setMasterDB(prev => {
      const cur = prev.categories && Object.keys(prev.categories).length ? prev.categories : DEFAULT_CATEGORIES;
      return { ...prev, categories: resolve(updater, cur) };
    });
  }, []);

  // Vues fusionnées (Master + perso), éditables pour l'admin, lecture seule sinon.
  const ingredientDB = useMemo<IngredientRow[]>(
    () => [...masterDB.ingredients, ...userDB.ingredients].map(i => ({ ...i, name: i.name ?? "", _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );
  const utensilDB = useMemo<UtensilRow[]>(
    () => [...masterDB.utensils, ...userDB.utensils].map(u => ({ ...u, name: u.name ?? "", _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );

  // Écriture : l'admin écrit dans la Master partagée (en absorbant d'éventuels ajouts
  // perso/migrés) ; les non-admins n'écrivent jamais (base en lecture seule).
  const setIngredientDB = useCallback((updater: SetStateAction<IngredientDbItem[]>) => {
    if (!isAdmin) return;
    const merged = [...masterDB.ingredients, ...userDB.ingredients];
    const next = resolve(updater, merged).map(stripRo);
    setMasterDB(prev => ({ ...prev, ingredients: next }));
    if (userDB.ingredients.length) setUserDB(prev => ({ ...prev, ingredients: [] }));
  }, [masterDB, userDB, isAdmin]);
  const setUtensilDB = useCallback((updater: SetStateAction<UtensilDbItem[]>) => {
    if (!isAdmin) return;
    const merged = [...masterDB.utensils, ...userDB.utensils];
    const next = resolve(updater, merged).map(stripRo);
    setMasterDB(prev => ({ ...prev, utensils: next }));
    if (userDB.utensils.length) setUserDB(prev => ({ ...prev, utensils: [] }));
  }, [masterDB, userDB, isAdmin]);

  // Glossaire des techniques : entièrement Master (pas de pendant userDB).
  const techniques = useMemo(() => masterDB.techniques || [], [masterDB]);
  const setTechniques = useCallback((updater: SetStateAction<TechniqueEntry[]>) => {
    if (!isAdmin) return;
    setMasterDB(prev => ({ ...prev, techniques: resolve(updater, prev.techniques || []) }));
  }, [isAdmin]);

  // Sources recommandées (page d'import « depuis un lien ») : Master seule, admin
  // en écriture. Lisibles par tous pour alimenter l'étagère de sources.
  const sources = useMemo(() => masterDB.sources || [], [masterDB]);
  const setSources = useCallback((updater: SetStateAction<RecommendedSource[]>) => {
    if (!isAdmin) return;
    setMasterDB(prev => ({ ...prev, sources: resolve(updater, prev.sources || []) }));
  }, [isAdmin]);

  return {
    masterDB, setMasterDB, userDB, setUserDB,
    categories, setCategories, ingredientDB, utensilDB, techniques, sources,
    setIngredientDB, setUtensilDB, setTechniques, setSources,
  };
}
