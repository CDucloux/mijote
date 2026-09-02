// ─── FOYER : HELPERS SERVEUR PURS ───────────────────────────────────────────────
// Construction/normalisation du document de foyer à la création, côté Cloud
// Function (la création est réservée à Cardamome+). Sans I/O : testable seul.
//
// @module households/householdHelpers

/** Longueur maximale du nom de foyer (miroir du `maxLength` du champ côté client). */
export const HOUSEHOLD_NAME_MAX = 40;

/** Document de foyer tel qu'écrit à la création (owner = unique membre). */
export interface HouseholdDoc {
  name: string;
  ownerUid: string;
  memberUids: string[];
  memberEmails: string[];
  invitedEmails: string[];
  createdAt: number;
}

const norm = (e: string | undefined | null): string => (e || "").trim().toLowerCase();

/**
 * Nettoie le nom de foyer fourni par le client (entrée `unknown`, jamais castée) :
 * trim + plafond de longueur, repli sur « Mon foyer » si vide ou non-chaîne.
 *
 * @param name - La valeur brute reçue du client.
 * @returns Un nom sûr, non vide, borné à {@link HOUSEHOLD_NAME_MAX} caractères.
 */
export function sanitizeHouseholdName(name: unknown): string {
  const s = typeof name === "string" ? name.trim().slice(0, HOUSEHOLD_NAME_MAX) : "";
  return s || "Mon foyer";
}

/**
 * Construit le document initial d'un foyer : le créateur en est le propriétaire et
 * l'unique membre, sans invitation préchargée (invariants attendus par les règles
 * Firestore). `now` est injectable pour des tests déterministes.
 *
 * @param uid - L'identifiant du créateur.
 * @param email - L'email du créateur (normalisé ; absent → `memberEmails` vide).
 * @param name - Le nom brut du foyer (nettoyé via {@link sanitizeHouseholdName}).
 * @param now - Horodatage de création (défaut `Date.now()`).
 * @returns Le document prêt à écrire dans `households/{hid}`.
 */
export function buildHouseholdDoc(uid: string, email: string | undefined | null, name: unknown, now: number = Date.now()): HouseholdDoc {
  const e = norm(email);
  return {
    name: sanitizeHouseholdName(name),
    ownerUid: uid,
    memberUids: [uid],
    memberEmails: e ? [e] : [],
    invitedEmails: [],
    createdAt: now,
  };
}
