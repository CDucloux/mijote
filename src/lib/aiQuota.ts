// ─── CRÉDITS D'IMPORT IA, côté client (affichage) ────────────────────────────
// Miroir LECTURE SEULE de la logique serveur (functions/quota.ts). L'autorité
// reste la Cloud Function (débit atomique) ; ici on ne fait qu'AFFICHER le
// reliquat de crédits à partir de `aiUsage/{uid}` (lisible par l'utilisateur,
// écrit par le serveur). Toute divergence est tranchée par le serveur : ces
// chiffres sont indicatifs. Les constantes DOIVENT rester alignées avec
// functions/quota.ts.

/** Type d'import IA soumis à quota. */
export type ImportKind = "url" | "photo" | "text" | "pdf";

/** Crédits d'import inclus par mois pour un abonné. */
export const MONTHLY_CREDITS = 100;

/** Soft cap journalier (anti-abus) : invisible en usage normal. */
export const DAILY_CREDITS = 30;

/** Coût en crédits par type d'import (la photo mobilise la vision, plus coûteuse). */
export const CREDIT_COST: Record<ImportKind, number> = { url: 1, text: 1, pdf: 1, photo: 2 };

/** Coût en crédits d'un import. */
export function creditCost(kind: ImportKind): number {
  return CREDIT_COST[kind];
}

/** Compteurs de crédits stockés dans `aiUsage/{uid}`. */
export interface CreditUsage {
  creditsDay?: string;
  creditsDayCount?: number;
  creditsMonth?: string;
  creditsMonthCount?: number;
}

/** Document `aiUsage/{uid}` (les compteurs de crédits, plus d'éventuels legacy). */
export type UsageDoc = CreditUsage & Record<string, unknown>;

/** Reliquat de crédits calculé (mois = pool inclus, jour = soft cap). */
export interface CreditState {
  monthUsed: number;
  monthLeft: number;
  monthLimit: number;
  dayUsed: number;
  dayLeft: number;
  dayLimit: number;
}

/**
 * Clés de période (jour `YYYY-MM-DD`, mois `YYYY-MM`) en fuseau Europe/Paris,
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
 * Crédits consommés courants (jour et mois), avec remise à zéro implicite si la
 * période stockée a changé (comme le serveur). Un ancien document (quotas par
 * type, sans champ `credits*`) est vu à zéro.
 *
 * @param usage - Le document `aiUsage/{uid}` (ou null).
 * @param day - Clé jour courante.
 * @param month - Clé mois courante.
 */
export function currentCredits(usage: UsageDoc | null | undefined, day: string, month: string): { dayCount: number; monthCount: number } {
  const u = usage || {};
  return {
    dayCount: u.creditsDay === day ? (u.creditsDayCount || 0) : 0,
    monthCount: u.creditsMonth === month ? (u.creditsMonthCount || 0) : 0,
  };
}

/**
 * Reliquat de crédits (pool mensuel + soft cap journalier) à partir du document
 * `aiUsage`.
 *
 * @param usageDoc - Le document `aiUsage/{uid}` (ou null).
 * @param now - Instant de référence.
 */
export function creditState(usageDoc: UsageDoc | null | undefined, now: Date = new Date()): CreditState {
  const { day, month } = periodKeys(now);
  const { dayCount, monthCount } = currentCredits(usageDoc, day, month);
  return {
    monthUsed: monthCount, monthLeft: Math.max(0, MONTHLY_CREDITS - monthCount), monthLimit: MONTHLY_CREDITS,
    dayUsed: dayCount, dayLeft: Math.max(0, DAILY_CREDITS - dayCount), dayLimit: DAILY_CREDITS,
  };
}

/**
 * Un import de ce type est-il possible (assez de crédits sur le mois ET le jour) ?
 *
 * @param state - Le reliquat de crédits courant.
 * @param kind - Type d'import tenté.
 */
export function canImport(state: CreditState, kind: ImportKind): boolean {
  const cost = creditCost(kind);
  return state.monthLeft >= cost && state.dayLeft >= cost;
}
