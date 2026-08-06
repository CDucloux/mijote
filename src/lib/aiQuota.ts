// ─── QUOTAS D'IMPORT IA — côté client (affichage) ────────────────────────────
// Miroir LECTURE SEULE de la logique serveur (functions/quota.js). L'autorité
// reste la Cloud Function (consommation atomique) ; ici on ne fait qu'AFFICHER
// le reliquat à partir de `aiUsage/{uid}` (lisible par l'utilisateur, écrit par
// le serveur). Toute divergence est tranchée par le serveur : ces chiffres sont
// indicatifs. Les limites DOIVENT rester alignées avec functions/quota.js.

/** Type d'import IA soumis à quota. */
export type ImportKind = "url" | "photo";

/** Compteurs stockés pour un type dans `aiUsage/{uid}`. */
export interface KindUsage {
  day?: string;
  dayCount?: number;
  month?: string;
  monthCount?: number;
}

/** Document `aiUsage/{uid}` (partiel — un champ par type d'import). */
export type UsageDoc = Partial<Record<ImportKind, KindUsage>> & Record<string, unknown>;

/** Reliquat calculé pour un type d'import. */
export interface Remaining {
  dayUsed: number;
  dayLeft: number;
  dayLimit: number;
  monthUsed: number;
  monthLeft: number;
  monthLimit: number;
  blocked: boolean;
}

/** Limites par type d'import : `day` (par jour) et `month` (par mois). */
export const LIMITS: Record<ImportKind, { day: number; month: number }> = {
  url: { day: 5, month: 60 },
  photo: { day: 3, month: 30 },
};

/**
 * Clés de période (jour `YYYY-MM-DD`, mois `YYYY-MM`) en fuseau Europe/Paris —
 * identique au serveur pour que le reliquat affiché corresponde au décompte réel.
 *
 * @param now - Instant de référence (défaut : maintenant).
 */
export function periodKeys(now: Date = new Date()): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)!.value;
  const y = get("year"), m = get("month"), d = get("day");
  return { day: `${y}-${m}-${d}`, month: `${y}-${m}` };
}

/**
 * Compteurs courants d'un type, avec remise à zéro implicite si le jour / mois
 * stocké ne correspond plus à la période courante (comme le serveur).
 *
 * @param kindData - Données stockées (`{ day, dayCount, month, monthCount }`).
 * @param day - Clé jour courante.
 * @param month - Clé mois courante.
 */
export function currentCounts(kindData: KindUsage | undefined, day: string, month: string): { dayCount: number; monthCount: number } {
  const k = kindData || {};
  return {
    dayCount: k.day === day ? (k.dayCount || 0) : 0,
    monthCount: k.month === month ? (k.monthCount || 0) : 0,
  };
}

/**
 * Reliquat d'imports pour un type, à partir du document `aiUsage`.
 *
 * @param usageDoc - Le document `aiUsage/{uid}` (ou null).
 * @param kind - Type d'import.
 * @param now - Instant de référence.
 */
export function remainingFor(usageDoc: UsageDoc | null | undefined, kind: ImportKind, now: Date = new Date()): Remaining {
  const lim = LIMITS[kind];
  const { day, month } = periodKeys(now);
  const { dayCount, monthCount } = currentCounts((usageDoc || {})[kind], day, month);
  const dayLeft = Math.max(0, lim.day - dayCount);
  const monthLeft = Math.max(0, lim.month - monthCount);
  return {
    dayUsed: dayCount, dayLeft, dayLimit: lim.day,
    monthUsed: monthCount, monthLeft, monthLimit: lim.month,
    blocked: dayLeft === 0 || monthLeft === 0,
  };
}
