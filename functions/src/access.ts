// ─── CONTRÔLE D'ACCÈS + QUOTAS MIJOTÉ+ (côté serveur) ────────────────────────
// Les imports IA (coûteux) sont réservés à l'ADMIN (illimité) OU à un abonné
// Mijoté+ ACTIF, avec des QUOTAS journaliers/mensuels pour les abonnés. Toute la
// vérification est côté serveur (token d'auth + Firestore) — jamais le client.
// Source de vérité abonnement : `customers/{uid}/subscriptions` (webhook Stripe).
// Compteurs d'usage : `aiUsage/{uid}` (écrit ici, en transaction).
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { ACTIVE_STATUSES } from "./stripeHelpers.js";
import { periodKeys, currentCounts, quotaError, type ImportKind, type KindUsage } from "./quota.js";

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

/** Résultat d'un contrôle d'accès : indique si l'appelant est l'admin. */
export interface AccessResult {
  admin: boolean;
}

/**
 * Vérifie l'accès et renvoie `{ admin }`. Lève si ni admin ni abonné actif.
 * (Extrait pour être réutilisé par la garde avec quota.)
 *
 * @param request - La requête onCall.
 * @param adminEmail - E-mail de l'admin (le créateur).
 * @returns `{ admin: true }` pour l'admin, `{ admin: false }` pour un abonné actif.
 * @throws HttpsError `unauthenticated` / `permission-denied` sinon.
 */
export async function requireAccess(request: CallableRequest, adminEmail: string): Promise<AccessResult> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const email = (request.auth.token && request.auth.token.email ? request.auth.token.email : "").toLowerCase();
  const admin = (adminEmail || "").toLowerCase();
  if (admin && email === admin) return { admin: true }; // 👑 le créateur : accès illimité

  const uid = request.auth.uid;
  const snap = await dbAdmin
    .collection(`customers/${uid}/subscriptions`)
    .where("status", "in", [...ACTIVE_STATUSES])
    .limit(1)
    .get();
  if (snap.empty) throw new HttpsError("permission-denied", "Fonctionnalité réservée à Mijoté+.");
  return { admin: false };
}

/**
 * Autorise l'appel si admin OU abonné actif (sans quota).
 *
 * @param request - La requête onCall.
 * @param adminEmail - E-mail de l'admin.
 * @throws HttpsError si l'appelant n'a pas accès.
 */
export async function assertPlusOrAdmin(request: CallableRequest, adminEmail: string): Promise<void> {
  await requireAccess(request, adminEmail);
}

/**
 * Autorise un import IA et CONSOMME un crédit de quota (jour + mois) pour les
 * abonnés. L'admin est exempté. Lève `resource-exhausted` si une limite est
 * atteinte. Le crédit est consommé de façon atomique AVANT l'appel IA (contrôle
 * du coût : une tentative compte, même si l'extraction échoue).
 *
 * @param request - La requête onCall.
 * @param adminEmail - E-mail de l'admin.
 * @param kind - Type d'import : `"url"` | `"photo"`.
 * @throws HttpsError `resource-exhausted` si le quota est atteint.
 */
export async function assertImportAllowed(request: CallableRequest, adminEmail: string, kind: ImportKind): Promise<void> {
  const { admin } = await requireAccess(request, adminEmail);
  if (admin) return; // roi 👑 : pas de quota

  const uid = request.auth!.uid;
  const ref = dbAdmin.doc(`aiUsage/${uid}`);
  const { day, month } = periodKeys();
  await dbAdmin.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const data = (s.exists ? (s.data() || {}) : {}) as Record<ImportKind, KindUsage | undefined>;
    const counts = currentCounts(data[kind], day, month);
    const err = quotaError(counts, kind);
    if (err) throw new HttpsError("resource-exhausted", err);
    tx.set(ref, {
      [kind]: { day, dayCount: counts.dayCount + 1, month, monthCount: counts.monthCount + 1 },
      updated: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
