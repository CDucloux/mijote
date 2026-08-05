// ─── HELPERS PURS ABONNEMENT (sans I/O) ──────────────────────────────────────
// Isolés de stripe.js (qui, lui, dépend de firebase-admin / stripe) pour être
// testables sans réseau ni credentials. Cf. stripeHelpers.test.js.

/** Statuts Stripe considérés « abonné actif ». Doit refléter le front (subscribeToPlan). */
const ACTIVE_STATUSES = ["active", "trialing"];

/** @returns true si le statut donne accès à Mijoté+. */
function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

/** uid Firebase porté par la métadonnée de l'abonnement (sans réseau), sinon null. */
function uidFromMetadata(sub) {
  return (sub && sub.metadata && sub.metadata.firebaseUID) || null;
}

/**
 * Champs Firestore dérivés d'un objet Subscription Stripe (forme minimale).
 * `updated` (serverTimestamp) est ajouté côté appelant, qui a accès à l'Admin SDK.
 */
function subscriptionDocFields(sub) {
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  const price = item && item.price ? item.price.id : null;
  return {
    status: sub.status,
    price,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    created: sub.created ? new Date(sub.created * 1000) : null,
  };
}

module.exports = { ACTIVE_STATUSES, isActiveStatus, uidFromMetadata, subscriptionDocFields };
