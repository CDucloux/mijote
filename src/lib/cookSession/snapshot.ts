/**
 * Construit le « snapshot » de session de cuisine envoyé à la barre de
 * notification native (plugin `CookSession`). Logique pure, sans I/O ni React :
 * le composant CookMode fournit ses primitives déjà calculées, cette couche
 * décide quoi afficher (étape, minuteur pilote, actions disponibles).
 *
 * La barre native reflète le pas à pas quand l'app passe en arrière-plan : elle
 * n'est utile qu'en coquille native, mais le calcul du snapshot reste testable
 * indépendamment de la plateforme.
 *
 * @module cookSession/snapshot
 */
import type { CookTimer } from "../planning/cookTimers";

/** Longueur maximale du texte d'étape repris dans la notification (2ᵉ ligne). */
const STEP_TEXT_MAX = 120;

/** Minuteur « pilote » repris dans la barre (le plus proche de sonner). */
export interface CookSnapshotTimer {
  /** Libellé de durée, ex. `"6 min"`. */
  label: string;
  /** Échéance absolue en ms epoch : alimente le chronomètre natif (décompte OS). */
  endAt: number;
  /** Durée totale en ms : alimente la barre de progression (seekbar média). */
  totalMs: number;
  /** En marche (décompte) vs en pause : conditionne le libellé du bouton. */
  running: boolean;
}

/** État figé de la session de cuisine, sérialisable vers le natif. */
export interface CookSessionSnapshot {
  /** Nom de la recette en cours. */
  recipeTitle: string;
  /** URL (ou data URI) de la photo de la recette, pour la pochette média. Vide si aucune. */
  imageUrl: string;
  /** Libellé de position, ex. `"Étape 3 / 8"`, `"Mise en place"`, `"Bases"`. */
  stepLabel: string;
  /** Texte de l'étape, tronqué pour la notification. */
  stepText: string;
  /** Progression dans le pas à pas (page courante, 0-based) : barre par défaut hors minuteur. */
  pageIndex: number;
  /** Nombre total de pages du pas à pas. */
  pageCount: number;
  /** Une étape précédente existe (bouton « Précédent »). */
  canPrev: boolean;
  /** Une étape suivante existe (bouton « Suivant »). */
  canNext: boolean;
  /** Minuteur pilote, ou `null` si aucun minuteur actif. */
  timer: CookSnapshotTimer | null;
}

/** Page courante du cook mode (miroir minimal de la logique de `pages`). */
export type CookPageKind = "overview" | "bases" | "step";

/** Entrées nécessaires à la construction du snapshot. */
export interface BuildSnapshotArgs {
  /** Nom de la recette. */
  recipeTitle: string;
  /** URL (ou data URI) de la photo de la recette, pour la pochette média. */
  imageUrl?: string;
  /** Nature de la page courante. */
  pageKind: CookPageKind;
  /** Index de la page courante (0-based). */
  stepIdx: number;
  /** Nombre total de pages. */
  totalSteps: number;
  /** Index réel de l'étape dans `recipe.steps` (>= 0 seulement si `pageKind === "step"`). */
  realIdx: number;
  /** Texte brut de l'étape courante (vide hors étape). */
  stepText: string;
  /** Minuteurs de la session (source : `cookTimers`). */
  timers: CookTimer[];
}

/**
 * Tronque un texte à `STEP_TEXT_MAX` en coupant sur un mot et en suffixant `…`.
 * Les espaces de tête/queue sont normalisés pour éviter une 2ᵉ ligne vide.
 */
function truncateStepText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= STEP_TEXT_MAX) return clean;
  const slice = clean.slice(0, STEP_TEXT_MAX);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > STEP_TEXT_MAX * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Libellé de position affiché dans la barre selon la page courante.
 * Les étapes réelles sont numérotées sur le total d'étapes (hors pages meta).
 */
function stepLabelOf(args: BuildSnapshotArgs, realStepCount: number): string {
  if (args.pageKind === "overview") return "Mise en place";
  if (args.pageKind === "bases") return "Bases à réaliser";
  const n = args.realIdx + 1;
  return realStepCount > 0 ? `Étape ${n} / ${realStepCount}` : `Étape ${n}`;
}

/**
 * Sélectionne le minuteur pilote : parmi les minuteurs en marche et non échus,
 * celui dont l'échéance est la plus proche. `null` si aucun ne tourne (tous en
 * pause, échus, ou liste vide) : la barre n'affiche alors pas de compte à rebours.
 *
 * @param timers - Minuteurs de la session.
 * @returns Le minuteur pilote sérialisé, ou `null`.
 */
export function pickPilotTimer(timers: CookTimer[]): CookSnapshotTimer | null {
  const best = findPilot(timers);
  if (best === null || best.endAt == null) return null;
  return { label: best.label, endAt: best.endAt, totalMs: best.totalSec * 1000, running: true };
}

/**
 * Identifiant du minuteur pilote (celui que le bouton « minuteur » de la barre
 * met en pause / relance), ou `null` s'il n'y en a pas.
 *
 * @param timers - Minuteurs de la session.
 * @returns L'`id` du minuteur pilote, ou `null`.
 */
export function pickPilotTimerId(timers: CookTimer[]): string | null {
  return findPilot(timers)?.id ?? null;
}

/** Minuteur en marche non échu le plus proche de sonner, ou `null`. */
function findPilot(timers: CookTimer[]): CookTimer | null {
  let best: CookTimer | null = null;
  for (const t of timers) {
    if (!t.running || t.done || t.endAt == null) continue;
    if (best === null || (best.endAt != null && t.endAt < best.endAt)) best = t;
  }
  return best;
}

/**
 * Construit le snapshot de session à partir de l'état courant du CookMode.
 *
 * @param args - Primitives déjà calculées côté composant.
 * @returns Le snapshot prêt à envoyer au plugin natif.
 */
export function buildCookSnapshot(args: BuildSnapshotArgs): CookSessionSnapshot {
  const realStepCount = countRealSteps(args);
  return {
    recipeTitle: args.recipeTitle.trim() || "Recette",
    imageUrl: (args.imageUrl ?? "").trim(),
    stepLabel: stepLabelOf(args, realStepCount),
    stepText: args.pageKind === "step" ? truncateStepText(args.stepText) : "",
    pageIndex: args.stepIdx,
    pageCount: args.totalSteps,
    canPrev: args.stepIdx > 0,
    canNext: args.stepIdx < args.totalSteps - 1,
    timer: pickPilotTimer(args.timers),
  };
}

/**
 * Déduit le nombre d'étapes réelles depuis l'index courant et le total de pages :
 * `realIdx` positionne l'étape parmi les pages meta (overview/bases) qui la
 * précèdent, donc `realStepCount = totalSteps - (stepIdx - realIdx)` sur une étape.
 * Hors étape, on retombe sur le total de pages (approximation sans effet, le
 * libellé n'utilise pas ce nombre hors `"step"`).
 */
function countRealSteps(args: BuildSnapshotArgs): number {
  if (args.pageKind !== "step" || args.realIdx < 0) return args.totalSteps;
  const metaBefore = args.stepIdx - args.realIdx;
  return Math.max(0, args.totalSteps - metaBefore);
}
