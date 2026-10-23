/**
 * Progression affichée pendant l'extraction IA d'un import.
 *
 * L'API ne renvoie pas d'avancement en continu : la progression est calée sur une
 * durée ESTIMÉE et suit une courbe asymptotique (1 - e^-kt), rapide au début puis
 * de plus en plus lente. Elle atteint ~90 % à la durée estimée puis grignote vers
 * un plafond de 99 % : une extraction plus longue que prévu n'est jamais figée à
 * un palier, et 100 % n'est jamais affiché (la fermeture de l'overlay fait office
 * de « terminé »).
 *
 * @module importProgress
 */

/** Phases annoncées pendant l'extraction, dans l'ordre. */
export const IMPORT_STEPS = [
  "Lecture du contenu",
  "Repérage de la recette",
  "Extraction des ingrédients",
  "Rédaction des étapes",
  "Derniers réglages",
] as const;

/** Plafond de progression tant que l'extraction n'est pas revenue. */
export const IMPORT_PROGRESS_CAP = 0.99;
const CURVE_K = 2.4;
const MIN_ESTIMATE_MS = 2000;

/**
 * Progression (0 à {@link IMPORT_PROGRESS_CAP}) après `elapsedMs` d'attente.
 * @param elapsedMs - Temps écoulé depuis le début de l'extraction (négatif traité comme 0).
 * @param estimateMs - Durée estimée de l'extraction, ramenée à 2 s au minimum.
 * @returns Fraction de progression, jamais 1.
 */
export function importProgress(elapsedMs: number, estimateMs: number): number {
  const duration = Math.max(MIN_ESTIMATE_MS, Number.isFinite(estimateMs) ? estimateMs : MIN_ESTIMATE_MS);
  const ratio = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) / duration;
  return IMPORT_PROGRESS_CAP * (1 - Math.exp(-CURVE_K * ratio));
}

/**
 * Index de la phase en cours dans {@link IMPORT_STEPS} pour une progression donnée :
 * les phases se partagent la course à parts égales jusqu'au plafond.
 * @param progress - Progression renvoyée par {@link importProgress}.
 * @returns Index de phase, borné à la dernière.
 */
export function importStepIndex(progress: number): number {
  const ratio = Math.max(0, progress) / IMPORT_PROGRESS_CAP;
  return Math.min(IMPORT_STEPS.length - 1, Math.floor(ratio * IMPORT_STEPS.length));
}
