import { useState, useMemo, useCallback } from "react";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";

// ─── BASE DE RÉFÉRENCE (Master partagée + ajouts perso) ───────────────────────
// Ingrédients, ustensiles, techniques et catégories nutritionnelles. La base
// Master est partagée (admin en écriture) ; chaque utilisateur peut avoir ses
// propres ajouts (userDB). Les vues fusionnent les deux et marquent `_ro` (lecture
// seule) pour les non-admins. Extrait d'App.jsx — ne dépend que d'`isAdmin`.
// `masterDB`/`setMasterDB` et `userDB`/`setUserDB` restent exposés car la couche de
// synchro Firestore (useFirestoreSync) les lit et les écrit.
export function useMasterData(isAdmin) {
  const [masterDB, setMasterDB] = useState(() => {
    try {
      const cached = localStorage.getItem("rf_masterDB_cache");
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return { ingredients: [], utensils: [], techniques: [], categories: DEFAULT_CATEGORIES };
  });
  const [userDB, setUserDB] = useState({ ingredients: [], utensils: [] });

  // Catégories nutritionnelles : vivent dans la Master (admin), repli sur les défauts.
  const categories = useMemo(
    () => (masterDB.categories && Object.keys(masterDB.categories).length ? masterDB.categories : DEFAULT_CATEGORIES),
    [masterDB]
  );
  const setCategories = useCallback((updater) => {
    setMasterDB(prev => {
      const cur = prev.categories && Object.keys(prev.categories).length ? prev.categories : DEFAULT_CATEGORIES;
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, categories: next };
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
  const setIngredientDB = useCallback((updater) => {
    if (!isAdmin) return;
    const merged = [...masterDB.ingredients, ...userDB.ingredients];
    const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, ingredients: next }));
    if (userDB.ingredients.length) setUserDB(prev => ({ ...prev, ingredients: [] }));
  }, [masterDB, userDB, isAdmin]);
  const setUtensilDB = useCallback((updater) => {
    if (!isAdmin) return;
    const merged = [...masterDB.utensils, ...userDB.utensils];
    const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, utensils: next }));
    if (userDB.utensils.length) setUserDB(prev => ({ ...prev, utensils: [] }));
  }, [masterDB, userDB, isAdmin]);

  // Glossaire des techniques : entièrement Master (pas de pendant userDB).
  const techniques = useMemo(() => masterDB.techniques || [], [masterDB]);
  const setTechniques = useCallback((updater) => {
    if (!isAdmin) return;
    setMasterDB(prev => {
      const cur = prev.techniques || [];
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, techniques: next };
    });
  }, [isAdmin]);

  return {
    masterDB, setMasterDB, userDB, setUserDB,
    categories, setCategories, ingredientDB, utensilDB, techniques,
    setIngredientDB, setUtensilDB, setTechniques,
  };
}
