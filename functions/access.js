// ─── CONTRÔLE D'ACCÈS + QUOTAS MIJOTÉ+ (côté serveur) ────────────────────────
// Les imports IA (coûteux) sont réservés à l'ADMIN (illimité) OU à un abonné
// Mijoté+ ACTIF, avec des QUOTAS journaliers/mensuels pour les abonnés. Toute la
// vérification est côté serveur (token d'auth + Firestore) — jamais le client.
// Source de vérité abonnement : `customers/{uid}/subscriptions` (webhook Stripe).
// Compteurs d'usage : `aiUsage/{uid}` (écrit ici, en transaction).
const { HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { ACTIVE_STATUSES } = require("./stripeHelpers.js");
const { periodKeys, currentCounts, quotaError } = require("./quota.js");

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

/**
 * Vérifie l'accès et renvoie `{ admin }`. Lève si ni admin ni abonné actif.
 * (Extrait pour être réutilisé par la garde avec quota.)
 */
async function requireAccess(request, adminEmail) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const email = (request.auth.token && request.auth.token.email ? request.auth.token.email : "").toLowerCase();
  const admin = (adminEmail || "").toLowerCase();
  if (admin && email === admin) return { admin: true }; // 👑 le créateur : accès illimité

  const uid = request.auth.uid;
  const snap = await dbAdmin
    .collection(`customers/${uid}/subscriptions`)
    .where("status", "in", ACTIVE_STATUSES)
    .limit(1)
    .get();
  if (snap.empty) throw new HttpsError("permission-denied", "Fonctionnalité réservée à Mijoté+.");
  return { admin: false };
}

/** Autorise l'appel si admin OU abonné actif (sans quota). */
async function assertPlusOrAdmin(request, adminEmail) {
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
 */
async function assertImportAllowed(request, adminEmail, kind) {
  const { admin } = await requireAccess(request, adminEmail);
  if (admin) return; // roi 👑 : pas de quota

  const uid = request.auth.uid;
  const ref = dbAdmin.doc(`aiUsage/${uid}`);
  const { day, month } = periodKeys();
  await dbAdmin.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const data = s.exists ? (s.data() || {}) : {};
    const counts = currentCounts(data[kind], day, month);
    const err = quotaError(counts, kind);
    if (err) throw new HttpsError("resource-exhausted", err);
    tx.set(ref, {
      [kind]: { day, dayCount: counts.dayCount + 1, month, monthCount: counts.monthCount + 1 },
      updated: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

module.exports = { assertPlusOrAdmin, assertImportAllowed };
