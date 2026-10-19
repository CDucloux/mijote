import { useMemo, useRef, useEffect, useCallback, type Dispatch, type SetStateAction } from "react";
import { applyStockLevel, nextStockLevel, stockLevelOf, type StockLevel } from "@/lib/food/stockLevel.js";
import type { ActivityInput, ActivityType } from "@/lib/notifications/activity.js";

/** Journal d'activité du foyer (un événement par changement de niveau). */
type LogActivity = ((event: ActivityInput) => void) | undefined;

interface UseStockLevelsOptions {
  stock: string[];
  setStock: Dispatch<SetStateAction<string[]>>;
  lowStock: string[];
  setLowStock: Dispatch<SetStateAction<string[]>>;
  nameById: Map<string, string>;
  logActivity: LogActivity;
}

/** Ensembles de lecture et actions sur le niveau d'un bocal. */
export interface StockLevels {
  stockSet: Set<string>;
  lowSet: Set<string>;
  /** Pose un niveau précis (menu du bocal). */
  setLevel: (id: string, level: StockLevel) => void;
  /** Passe au niveau suivant du cycle (tap sur le bocal). */
  cycle: (id: string) => void;
}

const ACTIVITY: Record<StockLevel, ActivityType> = { full: "stock.add", low: "stock.low", empty: "stock.out" };

/**
 * Niveaux du stock pour le mur d'étagères. Les actions sont STABLES (lecture de
 * l'état courant via refs) pour préserver la mémoïsation des bocaux, et les refs
 * sont avancées dès l'écriture : deux taps rapides avant le rendu suivant
 * enchaînent bien deux niveaux.
 *
 * @param options - Stock courant, setters, noms (journal) et journal d'activité.
 * @returns Les ensembles en stock / bientôt vide et les actions `setLevel` / `cycle`.
 */
export function useStockLevels({ stock, setStock, lowStock, setLowStock, nameById, logActivity }: UseStockLevelsOptions): StockLevels {
  const stockSet = useMemo(() => new Set(stock), [stock]);
  const lowSet = useMemo(() => new Set(lowStock), [lowStock]);
  const stockRef = useRef(stock);
  const lowRef = useRef(lowStock);
  useEffect(() => { stockRef.current = stock; lowRef.current = lowStock; }, [stock, lowStock]);

  const setLevel = useCallback((id: string, level: StockLevel) => {
    const current = { stock: stockRef.current, lowStock: lowRef.current };
    const next = applyStockLevel(current, id, level);
    if (next.stock === current.stock && next.lowStock === current.lowStock) return;
    stockRef.current = next.stock;
    lowRef.current = next.lowStock;
    if (next.stock !== current.stock) setStock(next.stock);
    if (next.lowStock !== current.lowStock) setLowStock(next.lowStock);
    logActivity?.({ type: ACTIVITY[level], target: nameById.get(id) || "" });
  }, [setStock, setLowStock, logActivity, nameById]);

  const cycle = useCallback((id: string) => {
    const level = stockLevelOf(id, new Set(stockRef.current), new Set(lowRef.current));
    setLevel(id, nextStockLevel(level));
  }, [setLevel]);

  return { stockSet, lowSet, setLevel, cycle };
}
