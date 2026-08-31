// ─── QUOTAS D'IMPORT IA (logique pure) ───────────────────────────────────────
// Limites par utilisateur ABONNÉ (l'admin est illimité, cf. access.ts). Séparé de
// l'enforcement (transaction Firestore) pour être testable sans I/O.

/** Type d'import IA soumis à quota. */
export type ImportKind = "url" | "photo" | "text";

/** Compteurs stockés pour un type d'import dans `aiUsage/{uid}`. */
export interface KindUsage {
  day?: string;
  dayCount?: number;
  month?: string;
  monthCount?: number;
}

/** Compteurs courants (après remise à zéro implicite de période). */
export interface Counts {
  dayCount: number;
  monthCount: number;
}

/** Limites par type d'import : `day` (par jour) et `month` (par mois). */
export const LIMITS: Record<ImportKind, { day: number; month: number }> = {
  url: { day: 5, month: 60 },
  photo: { day: 3, month: 30 },
  text: { day: 5, month: 60 },
};

/** Libellé humain par type (messages d'erreur). */
export const KIND_LABEL: Record<ImportKind, string> = { url: "depuis un lien", photo: "photo", text: "depuis un texte" };

/**
 * Clés de période (jour `YYYY-MM-DD` et mois `YYYY-MM`) en fuseau Europe/Paris,
 * pour que la « journée » de quota corresponde à la journée locale de l'utilisateur.
 *
 * @param now - Instant de référence (défaut : maintenant).
 * @returns Les clés `day` et `month` de la période courante.
 */
export function periodKeys(now: Date = new Date()): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === t)!.value;
  const y = get("year"), m = get("month"), d = get("day");
  return { day: `${y}-${m}-${d}`, month: `${y}-${m}` };
}

/**
 * Compteurs courants d'un type, avec remise à zéro implicite si le jour / mois
 * stocké ne correspond plus à la période courante.
 *
 * @param kindData - Données stockées pour ce type (`{ day, dayCount, month, monthCount }`).
 * @param day - Clé jour courante.
 * @param month - Clé mois courante.
 * @returns Les compteurs jour et mois effectifs.
 */
export function currentCounts(kindData: KindUsage | undefined, day: string, month: string): Counts {
  const k = kindData || {};
  return {
    dayCount: k.day === day ? (k.dayCount || 0) : 0,
    monthCount: k.month === month ? (k.monthCount || 0) : 0,
  };
}

/**
 * Message d'erreur si la PROCHAINE utilisation dépasserait une limite, sinon null.
 *
 * @param counts - Compteurs courants (`{ dayCount, monthCount }`).
 * @param kind - Type d'import (`"url"` | `"photo"`).
 * @returns Le message d'erreur, ou `null` si l'import est autorisé.
 */
export function quotaError(counts: Counts, kind: ImportKind): string | null {
  const lim = LIMITS[kind];
  if (counts.dayCount >= lim.day) return `Limite atteinte : ${lim.day} imports ${KIND_LABEL[kind]} par jour. Réessaie demain.`;
  if (counts.monthCount >= lim.month) return `Limite atteinte : ${lim.month} imports ${KIND_LABEL[kind]} ce mois-ci.`;
  return null;
}
