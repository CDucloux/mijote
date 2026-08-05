// ─── CONTRÔLE D'ACCÈS MIJOTÉ+ (côté serveur) ─────────────────────────────────
// Les fonctions coûteuses (imports IA) sont réservées à l'ADMIN (le créateur) OU
// à un abonné Mijoté+ ACTIF. La vérification se fait ICI, côté serveur, sur le
// token d'auth et l'état d'abonnement dans Firestore — jamais en se fiant au
// client. Source de vérité de l'abonnement : `customers/{uid}/subscriptions`
// (renseigné par le webhook Stripe via l'Admin SDK).
const { HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { ACTIVE_STATUSES } = require("./stripeHelpers.js");

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

/**
 * Autorise l'appel si l'utilisateur est l'admin OU un abonné Mijoté+ actif.
 * Lève une HttpsError sinon (unauthenticated / permission-denied).
 *
 * @param {object} request - La requête onCall (v2).
 * @param {string} adminEmail - E-mail de l'admin (le créateur).
 */
async function assertPlusOrAdmin(request, adminEmail) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const email = (request.auth.token && request.auth.token.email ? request.auth.token.email : "").toLowerCase();
  const admin = (adminEmail || "").toLowerCase();
  if (admin && email === admin) return; // le créateur a toujours accès

  const uid = request.auth.uid;
  const snap = await dbAdmin
    .collection(`customers/${uid}/subscriptions`)
    .where("status", "in", ACTIVE_STATUSES)
    .limit(1)
    .get();
  if (snap.empty) throw new HttpsError("permission-denied", "Fonctionnalité réservée à Mijoté+.");
}

module.exports = { assertPlusOrAdmin };
