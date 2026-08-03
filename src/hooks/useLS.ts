import { useState, useEffect, type Dispatch, type SetStateAction } from "react";

/**
 * État React persisté dans `localStorage` (sérialisé en JSON). API identique à
 * `useState` : lecture initiale depuis le stockage (repli sur `def`), réécriture à
 * chaque changement. Robuste aux erreurs (JSON invalide, quota dépassé).
 *
 * @param key - Clé de stockage.
 * @param def - Valeur par défaut si la clé est absente ou illisible.
 * @returns Le couple `[valeur, setter]`.
 */
export function useLS<T>(key: string, def: T): [T, Dispatch<SetStateAction<T>>] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : def; }
    catch { return def; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
  }, [key, val]);
  return [val, setVal];
}
