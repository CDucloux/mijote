// ─── CRÉDITS D'IMPORT IA (logique pure) ──────────────────────────────────────
// Un POOL MENSUEL de crédits partagé entre tous les types d'import (fongible), à
// la place des quotas cloisonnés par type. 1 crédit = un import lien / texte /
// PDF ; 2 crédits = un import photo (vision, plus coûteuse). Un soft cap
// journalier borne les emballements et les abus sans être visible en usage
// normal. Réservé aux abonnés (l'admin est illimité, cf. access.ts). Séparé de
// l'enforcement (transaction Firestore) pour être testable sans I/O.

/** Type d'import IA soumis à quota. */
export type ImportKind = "url" | "photo" | "text" | "pdf";

/** Crédits d'import inclus par mois pour un abonné. */
export const MONTHLY_CREDITS = 150;

/** Soft cap journalier (anti-abus) : invisible en usage normal. */
export const DAILY_CREDITS = 30;

/** Coût en crédits par type d'import (la photo mobilise la vision, plus coûteuse). */
export const CREDIT_COST: Record<ImportKind, number> = { url: 1, text: 1, pdf: 1, photo: 2 };

/**
 * Coût en crédits d'un import.
 *
 * @param kind - Type d'import.
 * @returns Le nombre de crédits débités par cet import.
 */
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

/** Crédits consommés sur la période courante (après remise à zéro implicite). */
export interface Counts {
  dayCount: number;
  monthCount: number;
}

/**
 * Clés de période (jour `YYYY-MM-DD` et mois `YYYY-MM`) en fuseau Europe/Paris,
 * pour que la « journée » et le « mois » de crédits correspondent au calendrier
 * local de l'utilisateur.
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
 * Crédits consommés sur la période courante, avec remise à zéro implicite quand
 * le jour / mois stocké ne correspond plus à la période courante. Un ancien
 * document (quotas par type, sans champ `credits*`) est donc vu à zéro : les
 * abonnés repartent proprement sur le pool de crédits.
 *
 * @param usage - Compteurs stockés (`{ creditsDay, creditsDayCount, ... }`).
 * @param day - Clé jour courante.
 * @param month - Clé mois courante.
 * @returns Les crédits consommés effectifs (jour et mois).
 */
export function currentCredits(usage: CreditUsage | undefined, day: string, month: string): Counts {
  const u = usage || {};
  return {
    dayCount: u.creditsDay === day ? (u.creditsDayCount || 0) : 0,
    monthCount: u.creditsMonth === month ? (u.creditsMonthCount || 0) : 0,
  };
}

/**
 * Message d'erreur si débiter le coût de CE type dépasserait le pool mensuel ou
 * le soft cap journalier, sinon null. Le mois (la vraie limite incluse) prime sur
 * le jour (garde-fou) dans le message.
 *
 * @param counts - Crédits déjà consommés (`{ dayCount, monthCount }`).
 * @param kind - Type d'import tenté.
 * @returns Le message d'erreur, ou `null` si l'import est autorisé.
 */
export function creditsError(counts: Counts, kind: ImportKind): string | null {
  const cost = creditCost(kind);
  if (counts.monthCount + cost > MONTHLY_CREDITS) return `Plus assez de crédits d'import ce mois-ci (${MONTHLY_CREDITS} inclus). Ça repart le mois prochain.`;
  if (counts.dayCount + cost > DAILY_CREDITS) return "Beaucoup d'imports aujourd'hui. Reprends demain, tes crédits du mois restent intacts.";
  return null;
}
