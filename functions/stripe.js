// ─── PAIEMENT MIJOTÉ+ (Stripe, intégration maison) ───────────────────────────
// Trois fonctions, sans dépendre de l'extension Firebase (en fin de vie 2027) :
//   • createStripeCheckout (callable) → URL de Stripe Checkout (abonnement) ;
//   • createStripePortal   (callable) → URL du portail de facturation Stripe ;
//   • stripeWebhook        (HTTP)     → Stripe → Firestore (statut d'abonnement).
//
// Le lien uid Firebase ↔ client Stripe est stocké dans `customers/{uid}.stripeId`
// et dupliqué en métadonnée Stripe (`firebaseUID`) pour retrouver l'uid dans le
// webhook. L'abonnement actif est écrit dans `customers/{uid}/subscriptions/{id}`
// (statut `active`/`trialing`), ce que le front écoute pour débloquer Mijoté+.
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const Stripe = require("stripe");

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

const STRIPE_SECRET = defineSecret("STRIPE_SECRET_KEY");        // sk_test_… / sk_live_…
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET"); // whsec_…
const REGION = "europe-west1"; // même région que les autres fonctions
// Version d'API Stripe épinglée : « Managed Payments » (activé par défaut sur les
// nouveaux comptes) exige ≥ 2025-03-31.basil.
const STRIPE_API_VERSION = "2025-03-31.basil";

function stripeClient() {
  const key = STRIPE_SECRET.value();
  if (!key || !key.startsWith("sk_")) throw new HttpsError("failed-precondition", "Le paiement n'est pas encore configuré (clé Stripe manquante).");
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

// Récupère (ou crée) le client Stripe lié à un uid Firebase. Le mapping est stocké
// dans `customers/{uid}.stripeId` et l'uid est dupliqué en métadonnée Stripe.
async function ensureCustomer(stripe, uid, email) {
  const ref = dbAdmin.doc(`customers/${uid}`);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;
  if (existing && existing.stripeId) return existing.stripeId;
  const customer = await stripe.customers.create({ email: email || undefined, metadata: { firebaseUID: uid } });
  await ref.set({ stripeId: customer.id, email: email || null }, { merge: true });
  return customer.id;
}

// ── Checkout (abonnement) ────────────────────────────────────────────────────
exports.createStripeCheckout = onCall(
  { secrets: [STRIPE_SECRET], region: REGION, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const uid = request.auth.uid;
    const email = request.auth.token && request.auth.token.email;
    const { price, successUrl, cancelUrl } = request.data || {};
    if (!price || typeof price !== "string" || !price.startsWith("price_")) throw new HttpsError("invalid-argument", "Tarif invalide.");
    if (!successUrl || !cancelUrl) throw new HttpsError("invalid-argument", "URLs de retour manquantes.");
    const stripe = stripeClient();
    try {
      const customer = await ensureCustomer(stripe, uid, email);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        line_items: [{ price, quantity: 1 }],
        allow_promotion_codes: true,
        client_reference_id: uid,
        subscription_data: { metadata: { firebaseUID: uid } },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return { url: session.url };
    } catch (e) {
      console.error("createStripeCheckout:", e);
      throw new HttpsError("internal", `Paiement impossible : ${(e && e.message) || "erreur Stripe"}`);
    }
  }
);

// ── Portail de facturation (gérer / annuler) ─────────────────────────────────
exports.createStripePortal = onCall(
  { secrets: [STRIPE_SECRET], region: REGION, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const uid = request.auth.uid;
    const { returnUrl } = request.data || {};
    if (!returnUrl) throw new HttpsError("invalid-argument", "URL de retour manquante.");
    const snap = await dbAdmin.doc(`customers/${uid}`).get();
    const stripeId = snap.exists ? snap.data().stripeId : null;
    if (!stripeId) throw new HttpsError("failed-precondition", "Aucun abonnement à gérer pour ce compte.");
    const stripe = stripeClient();
    try {
      const session = await stripe.billingPortal.sessions.create({ customer: stripeId, return_url: returnUrl });
      return { url: session.url };
    } catch (e) {
      console.error("createStripePortal:", e);
      throw new HttpsError("internal", `Portail indisponible : ${(e && e.message) || "erreur Stripe"}`);
    }
  }
);

// ── Retrouve l'uid Firebase d'un abonnement (métadonnée, sinon via le client) ──
async function uidForSubscription(stripe, sub) {
  if (sub.metadata && sub.metadata.firebaseUID) return sub.metadata.firebaseUID;
  const cust = await stripe.customers.retrieve(sub.customer);
  return cust && !cust.deleted && cust.metadata ? (cust.metadata.firebaseUID || null) : null;
}

// ── Écrit l'état d'abonnement dans Firestore (source de vérité du front) ──────
async function syncSubscription(stripe, sub) {
  const uid = await uidForSubscription(stripe, sub);
  if (!uid) { console.warn("stripeWebhook : aucun firebaseUID pour l'abonnement", sub.id); return; }
  const price = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price ? sub.items.data[0].price.id : null;
  await dbAdmin.doc(`customers/${uid}/subscriptions/${sub.id}`).set({
    status: sub.status,                                   // active / trialing / canceled / …
    price,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    created: sub.created ? new Date(sub.created * 1000) : null,
    updated: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ── Webhook Stripe (signature vérifiée) ──────────────────────────────────────
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET], region: REGION, timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: STRIPE_API_VERSION });
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value());
    } catch (e) {
      console.error("stripeWebhook : signature invalide", e && e.message);
      res.status(400).send(`Webhook signature verification failed: ${(e && e.message) || ""}`);
      return;
    }
    try {
      if (event.type.startsWith("customer.subscription.")) {
        await syncSubscription(stripe, event.data.object);
      } else if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        if (s.subscription) await syncSubscription(stripe, await stripe.subscriptions.retrieve(s.subscription));
      }
      res.json({ received: true });
    } catch (e) {
      console.error("stripeWebhook : erreur de traitement", e);
      res.status(500).send("handler error");
    }
  }
);
