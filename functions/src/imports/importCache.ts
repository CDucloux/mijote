// ─── CACHE D'IDEMPOTENCE DES IMPORTS IA ────────────────────────────────────────
// Le crédit d'import est débité AVANT l'appel LLM (une tentative compte). Si la
// réponse se perd (app passée en arrière-plan, réseau coupé), l'extraction a le plus
// souvent DÉJÀ été faite et débitée côté serveur. Pour ne pas re-débiter le client
// ni rappeler le LLM quand il rejoue le même import, on met le résultat en cache
// sous l'identifiant d'idempotence fourni par le client (dérivé du contenu). Une
// reprise du même import renvoie le résultat mémorisé, gratuitement.
//
// Stockage : `importCache/{uid}__{requestId}` (écriture serveur uniquement, cf.
// firestore.rules). Le champ `expireAt` permet de brancher une politique TTL
// Firestore pour purger automatiquement ; la fraîcheur est de toute façon revérifiée
// à la lecture.
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

/** Durée de validité d'un résultat en cache (au-delà, on ré-extrait). */
export const IMPORT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

/**
 * Indique si une entrée de cache est encore fraîche.
 * Fonction PURE (testable), sans I/O.
 *
 * @param createdAtMs - Instant de création de l'entrée (epoch ms).
 * @param nowMs - Instant courant (epoch ms).
 * @param maxAgeMs - Durée de validité (défaut {@link IMPORT_CACHE_TTL_MS}).
 * @returns `true` si l'entrée est exploitable.
 */
export function isFresh(createdAtMs: unknown, nowMs: number, maxAgeMs: number = IMPORT_CACHE_TTL_MS): boolean {
  return typeof createdAtMs === "number" && createdAtMs > 0 && nowMs - createdAtMs <= maxAgeMs && nowMs >= createdAtMs;
}

/**
 * Valide et normalise un identifiant d'idempotence fourni par le client. Refuse ce
 * qui n'est pas une chaîne courte alphanumérique (`[A-Za-z0-9_-]`, ≤ 80) pour ne
 * jamais laisser une valeur arbitraire construire un chemin de document.
 *
 * @param raw - La valeur `requestId` reçue (forme inconnue).
 * @returns L'identifiant nettoyé, ou `null` s'il est inexploitable.
 */
export function sanitizeRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 80 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  return s;
}

/** Chemin du document de cache pour un couple (utilisateur, requête). */
function cachePath(uid: string, requestId: string): string {
  return `importCache/${uid}__${requestId}`;
}

/**
 * Lit un résultat d'import en cache s'il existe ET est encore frais.
 *
 * @param uid - L'utilisateur appelant.
 * @param rawRequestId - L'identifiant d'idempotence brut reçu du client.
 * @param now - Instant courant (injectable pour les tests).
 * @returns Le résultat mémorisé (forme opaque), ou `null` (absent, périmé, id invalide).
 */
export async function readFreshImport(uid: string, rawRequestId: unknown, now: number = Date.now()): Promise<unknown> {
  const id = sanitizeRequestId(rawRequestId);
  if (!id) return null;
  const snap = await dbAdmin.doc(cachePath(uid, id)).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  if (!isFresh(d.createdAtMs, now)) return null;
  return d.result ?? null;
}

/**
 * Mémorise le résultat d'un import sous l'identifiant d'idempotence. Best-effort :
 * un échec d'écriture ne doit pas faire échouer un import réussi (le résultat est
 * déjà prêt à être renvoyé), il coûte juste la reprise gratuite en cas d'interruption.
 *
 * @param uid - L'utilisateur appelant.
 * @param rawRequestId - L'identifiant d'idempotence brut reçu du client.
 * @param result - Le résultat d'import à mémoriser (recette + méta).
 * @param now - Instant courant (injectable pour les tests).
 */
export async function writeImportCache(uid: string, rawRequestId: unknown, result: unknown, now: number = Date.now()): Promise<void> {
  const id = sanitizeRequestId(rawRequestId);
  if (!id) return;
  await dbAdmin.doc(cachePath(uid, id)).set({
    result,
    createdAtMs: now,
    expireAt: new Date(now + IMPORT_CACHE_TTL_MS),
  });
}
