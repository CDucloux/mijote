import { useState } from "react";

/** État de mise en place d'une session de cuisine (cases cochées, unités cuillère). */
export interface UseCookChecklistResult {
  checkedIngIds: ReadonlySet<string | undefined>;
  checkedUtIds: ReadonlySet<string | undefined>;
  checkedCutKeys: ReadonlySet<string>;
  toggleIngChecked: (id: string | undefined) => void;
  toggleUtChecked: (id: string | undefined) => void;
  toggleCutChecked: (key: string) => void;
  /** Unité cuillère choisie par ingrédient (absente = unité d'origine). */
  spoonUnitByIng: ReadonlyMap<string | undefined, string>;
  /** Choisit l'unité cuillère d'un ingrédient ; `null` revient à l'unité d'origine. */
  setSpoonUnit: (ingId: string | undefined, unit: string | null) => void;
}

/** Bascule la présence d'une clé dans un ensemble, sans muter l'original. */
const toggledSet = <T,>(prev: ReadonlySet<T>, key: T): Set<T> => {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
};

/**
 * Checklist de « mise en place » du pas à pas (ingrédients, ustensiles et découpes
 * rassemblés) et unités cuillère choisies par ingrédient, pour qui préfère mesurer
 * que peser. Propre à CETTE session de cuisine, jamais persistée : elle n'a plus de
 * sens à la suivante.
 */
export function useCookChecklist(): UseCookChecklistResult {
  const [checkedIngIds, setCheckedIngIds] = useState<ReadonlySet<string | undefined>>(() => new Set());
  const [checkedUtIds, setCheckedUtIds] = useState<ReadonlySet<string | undefined>>(() => new Set());
  const [checkedCutKeys, setCheckedCutKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [spoonUnitByIng, setSpoonUnitByIng] = useState<ReadonlyMap<string | undefined, string>>(() => new Map());
  return {
    checkedIngIds, checkedUtIds, checkedCutKeys, spoonUnitByIng,
    toggleIngChecked: id => setCheckedIngIds(prev => toggledSet(prev, id)),
    toggleUtChecked: id => setCheckedUtIds(prev => toggledSet(prev, id)),
    toggleCutChecked: key => setCheckedCutKeys(prev => toggledSet(prev, key)),
    setSpoonUnit: (ingId, unit) => setSpoonUnitByIng(prev => {
      const next = new Map(prev);
      if (unit) next.set(ingId, unit); else next.delete(ingId);
      return next;
    }),
  };
}
