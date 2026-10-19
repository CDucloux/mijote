import { useState, useCallback } from "react";
import { useLS } from "./useLS.js";
import { peopleCount } from "@/lib/household/household.js";
import { isoWeek } from "@/lib/format.js";
import { SLOT_BY_ID } from "../constants/mealSlots.js";
import type { useMealPlanner } from "./useMealPlanner.js";
import type { AppShell } from "../context/AppShellContext.js";

type MealPlanner = ReturnType<typeof useMealPlanner>;

interface UseWeekGenerationDeps {
  generate: MealPlanner["generate"];
  undo: MealPlanner["undo"];
  /** Les 7 jours de la semaine visible. */
  weekDays: string[];
  /** Mangeurs du foyer (portions par repas) ; 2 sans foyer. */
  household: Parameters<typeof peopleCount>[0] | null | undefined;
  hasRecipes: boolean;
  notify: AppShell["notify"];
  logActivity?: AppShell["logActivity"];
  /** Ouvre la session batch (demandée à la génération). */
  openBatch: () => void;
}

/** Réglages de la feuille de génération et actions générer / annuler. */
export interface UseWeekGenerationResult {
  genOpen: boolean;
  setGenOpen: (open: boolean) => void;
  genStyle: string;
  setGenStyle: (style: string) => void;
  genBatch: boolean;
  toggleGenBatch: () => void;
  genSlots: string[];
  toggleGenSlot: (slot: string) => void;
  runGenerate: () => void;
  handleUndo: () => void;
}

const DEFAULT_SLOTS = ["midi", "soir"];

/**
 * Génération automatique de la semaine visible (créneaux vides) : style de repas,
 * batch cooking, créneaux à remplir, puis retour à l'utilisateur (nombre de
 * recettes proposées, semaine déjà pleine, bibliothèque vide) et annulation.
 */
export function useWeekGeneration({ generate, undo, weekDays, household, hasRecipes, notify, logActivity, openBatch }: UseWeekGenerationDeps): UseWeekGenerationResult {
  const [genOpen, setGenOpen] = useState(false);
  const [genStyle, setGenStyle] = useState("equilibre");
  const [genBatch, setGenBatch] = useState(false); // batch cooking : tout préparer d'avance
  // Créneaux à remplir. Persisté : c'est une habitude récurrente (ex. cantine le midi
  // en semaine → on ne génère que le soir). Au moins un créneau.
  const [genSlots, setGenSlots] = useLS("rf_gen_slots", DEFAULT_SLOTS);
  const toggleGenSlot = useCallback((slot: string) => setGenSlots(prev => {
    const set = new Set(prev);
    if (set.has(slot)) { if (set.size === 1) return prev; set.delete(slot); } else set.add(slot);
    // Ordre stable midi → soir (indépendant de l'ordre de clic).
    return DEFAULT_SLOTS.filter(s => set.has(s));
  }), [setGenSlots]);

  const runGenerate = useCallback(() => {
    const ppm = household ? peopleCount(household) : 2; // portions par repas = mangeurs
    const slots = genSlots.length ? genSlots : DEFAULT_SLOTS;
    const slotsLabel = slots.map(s => SLOT_BY_ID[s]?.label || s).join(" et ").toLowerCase();
    const { count } = generate(weekDays, slots, { compose: true, portionsPerMeal: ppm, style: genStyle, batch: genBatch });
    setGenOpen(false);
    if (count > 0) {
      notify(`${count} recettes proposées, à relire et ajuster`, "success");
      const { week, year } = isoWeek(weekDays[0]);
      logActivity?.({ type: "mealplan.generate", target: `Semaine S${week} - ${year}`, count });
      // Batch cooking demandé → on ouvre directement la session (tout à préparer).
      if (genBatch) openBatch();
    } else if (!hasRecipes) {
      // Aucune recette en bibliothèque : rien à proposer (≠ semaine déjà remplie).
      notify("Ajoute d'abord des recettes pour générer une semaine", "info");
    } else notify(`Cette semaine est déjà remplie (${slotsLabel})`, "info");
  }, [generate, weekDays, notify, household, hasRecipes, genSlots, genStyle, genBatch, logActivity, openBatch]);
  const handleUndo = useCallback(() => { if (undo()) notify("Génération annulée", "info"); }, [undo, notify]);

  return {
    genOpen, setGenOpen, genStyle, setGenStyle, genBatch, toggleGenBatch: () => setGenBatch(v => !v),
    genSlots, toggleGenSlot, runGenerate, handleUndo,
  };
}
