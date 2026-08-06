// ─── QUOTAS D'IMPORT IA (logique pure) ───────────────────────────────────────
// Limites par utilisateur ABONNÉ (l'admin est illimité, cf. access.js). Séparé de
// l'enforcement (transaction Firestore) pour être testable sans I/O.

/** Limites par type d'import : `day` (par jour) et `month` (par mois). */
const LIMITS = {
  url: { day: 5, month: 60 },
  photo: { day: 3, month: 30 },
};

/** Libellé humain par type (messages d'erreur). */
const KIND_LABEL = { url: "depuis un lien", photo: "photo" };

/**
 * Clés de période (jour `YYYY-MM-DD` et mois `YYYY-MM`) en fuseau Europe/Paris,
 * pour que la « journée » de quota corresponde à la journée locale de l'utilisateur.
 *
 * @param now - Instant de référence (défaut : maintenant).
 */
function periodKeys(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = get("year"), m = get("month"), d = get("day");
  return { day: `${y}-${m}-${d}`, month: `${y}-${m}` };
}

/**
 * Compteurs courants d'un type, avec remise à zéro implicite si le jour / mois
 * stocké ne correspond plus à la période courante.
 *
 * @param kindData - Les données stockées pour ce type (`{ day, dayCount, month, monthCount }`).
 * @param day - Clé jour courante.
 * @param month - Clé mois courante.
 */
function currentCounts(kindData, day, month) {
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
 */
function quotaError(counts, kind) {
  const lim = LIMITS[kind];
  if (counts.dayCount >= lim.day) return `Limite atteinte : ${lim.day} imports ${KIND_LABEL[kind]} par jour. Réessaie demain.`;
  if (counts.monthCount >= lim.month) return `Limite atteinte : ${lim.month} imports ${KIND_LABEL[kind]} ce mois-ci.`;
  return null;
}

module.exports = { LIMITS, KIND_LABEL, periodKeys, currentCounts, quotaError };
