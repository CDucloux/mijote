import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { copyMealToDays } from "@/lib/planning/composedMeal.js";
import { shiftWeeks } from "@/lib/planning/weekDays.js";
import type { MealPlan, Recipe } from "@/lib/types.js";
import type { ItemMenuTarget } from "../components/mealPlan/SlotZone.js";
import type { AppShell } from "../context/AppShellContext.js";

/** Jour et créneau choisis pour replanifier un repas. */
export interface RescheduleTarget {
  date: string | null;
  slot: string | null;
}

interface UseMealReplanDeps {
  mealPlan: MealPlan;
  setMealPlan: Dispatch<SetStateAction<MealPlan>>;
  /** Déplacement d'un item (même règle de rattachement que le glisser-déposer). */
  moveMeal: (fromDate: string, fromIdx: number, toDate: string, toSlot: string) => void;
  recipesById: ReadonlyMap<string, Recipe>;
  notify: AppShell["notify"];
  logActivity?: AppShell["logActivity"];
}

/** État et actions du menu contextuel d'un repas planifié et de ses feuilles. */
export interface UseMealReplanResult {
  itemMenu: ItemMenuTarget | null;
  setItemMenu: (target: ItemMenuTarget | null) => void;
  moveFor: ItemMenuTarget | null;
  closeReschedule: () => void;
  moveWeekRef: Date;
  moveTarget: RescheduleTarget;
  setMoveTarget: Dispatch<SetStateAction<RescheduleTarget>>;
  shiftMoveWeek: (dir: number) => void;
  openReschedule: (target: ItemMenuTarget) => void;
  confirmReschedule: () => void;
  dupFor: ItemMenuTarget | null;
  closeDuplicate: () => void;
  dupWeekRef: Date;
  dupDates: ReadonlySet<string>;
  toggleDupDate: (date: string) => void;
  dupSlot: string | null;
  setDupSlot: (slot: string) => void;
  shiftDupWeek: (dir: number) => void;
  openDuplicate: (target: ItemMenuTarget) => void;
  confirmDuplicate: () => void;
}

/**
 * Replanification d'un repas depuis son menu contextuel (clic droit / appui long) :
 * « Replanifier » vers un autre jour/créneau, ou « Dupliquer » sur plusieurs jours.
 * Chaque feuille navigue de semaine en semaine depuis celle de l'item.
 */
export function useMealReplan({ mealPlan, setMealPlan, moveMeal, recipesById, notify, logActivity }: UseMealReplanDeps): UseMealReplanResult {
  const [itemMenu, setItemMenu] = useState<ItemMenuTarget | null>(null);
  const [moveFor, setMoveFor] = useState<ItemMenuTarget | null>(null);
  const [moveWeekRef, setMoveWeekRef] = useState(() => new Date());
  const [moveTarget, setMoveTarget] = useState<RescheduleTarget>({ date: null, slot: null });
  const [dupFor, setDupFor] = useState<ItemMenuTarget | null>(null);
  const [dupWeekRef, setDupWeekRef] = useState(() => new Date());
  const [dupDates, setDupDates] = useState<ReadonlySet<string>>(() => new Set());
  const [dupSlot, setDupSlot] = useState<string | null>(null);

  const openReschedule = useCallback((info: ItemMenuTarget) => {
    setItemMenu(null);
    setMoveFor(info);
    setMoveWeekRef(new Date(info.date + "T12:00"));
    setMoveTarget({ date: info.date, slot: info.slot });
  }, []);
  const confirmReschedule = useCallback(() => {
    if (!moveFor || !moveTarget.date || !moveTarget.slot) return;
    moveMeal(moveFor.date, moveFor.idx, moveTarget.date, moveTarget.slot);
    setMoveFor(null);
    notify("Repas replanifié");
    logActivity?.({ type: "mealplan.reschedule", target: (moveFor.recipeId && recipesById.get(moveFor.recipeId)?.name) || "" });
  }, [moveFor, moveTarget, moveMeal, notify, logActivity, recipesById]);

  // Le jour d'origine est présélectionné et verrouillé : on ne duplique que vers d'autres jours.
  const openDuplicate = useCallback((info: ItemMenuTarget) => {
    setItemMenu(null);
    setDupFor(info);
    setDupWeekRef(new Date(info.date + "T12:00"));
    setDupDates(new Set());
    setDupSlot(info.slot);
  }, []);
  const toggleDupDate = useCallback((date: string) => setDupDates(prev => {
    const next = new Set(prev);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  }), []);
  const confirmDuplicate = useCallback(() => {
    if (!dupFor || !dupDates.size || !dupSlot) return;
    const src = (mealPlan[dupFor.date] || [])[dupFor.idx];
    if (!src) { setDupFor(null); return; }
    const targets = [...dupDates];
    setMealPlan(prev => copyMealToDays(prev, src, targets, dupSlot));
    setDupFor(null);
    notify(targets.length > 1 ? `Recette dupliquée sur ${targets.length} jours` : "Recette dupliquée");
  }, [dupFor, dupDates, dupSlot, mealPlan, setMealPlan, notify]);

  return {
    itemMenu, setItemMenu,
    moveFor, closeReschedule: () => setMoveFor(null), moveWeekRef, moveTarget, setMoveTarget,
    shiftMoveWeek: dir => setMoveWeekRef(prev => shiftWeeks(prev, dir)),
    openReschedule, confirmReschedule,
    dupFor, closeDuplicate: () => setDupFor(null), dupWeekRef, dupDates, toggleDupDate, dupSlot, setDupSlot,
    shiftDupWeek: dir => setDupWeekRef(prev => shiftWeeks(prev, dir)),
    openDuplicate, confirmDuplicate,
  };
}
