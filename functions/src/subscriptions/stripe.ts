// ─── PAIEMENT CARDAMOME+ (Stripe, intégration maison) ───────────────────────────
// Trois fonctions, sans dépendre de l'extension Firebase (en fin de vie 2027) :
//   • createStripeCheckout (callable) → URL de Stripe Checkout (abonnement) ;
//   • createStripePortal   (callable) → URL du portail de facturation Stripe ;
//   • stripeWebhook        (HTTP)     → Stripe → Firestore (statut d'abonnement).
//
// Le lien uid Firebase ↔ client Stripe est stocké dans `customers/{uid}.stripeId`
// et dupliqué en métadonnée Stripe (`firebaseUID`) pour retrouver l'uid dans le
// webhook. L'abonnement actif est écrit dans `customers/{uid}/subscriptions/{id}`
// (statut `active`/`trialing`), ce que le front écoute pour débloquer Cardamome+.
import * as logger from "firebase-functions/logger";
import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";
import { uidFromMetadata, subscriptionDocFields, ACTIVE_STATUSES } from "./stripeHelpers.js";

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

const STRIPE_SECRET = defineSecret("STRIPE_SECRET_KEY");        // sk_test_… / sk_live_…
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET"); // whsec_…
const REGION = "europe-west1"; // même région que les autres fonctions
// Version d'API Stripe épinglée : « Managed Payments » (activé par défaut sur les
// nouveaux comptes) exige ≥ 2025-03-31.basil.
const STRIPE_API_VERSION = "2025-03-31.basil";

/** Client Stripe configuré, ou lève si la clé n'est pas renseignée. */
function stripeClient(): Stripe {
  const key = STRIPE_SECRET.value();
  if (!key || !key.startsWith("sk_")) throw new HttpsError("failed-precondition", "Le paiement n'est pas encore configuré (clé Stripe manquante).");
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });
}

/**
 * Récupère (ou crée) le client Stripe lié à un uid Firebase. Le mapping est stocké
 * dans `customers/{uid}.stripeId` et l'uid est dupliqué en métadonnée Stripe.
 *
 * @param stripe - Client Stripe.
 * @param uid - uid Firebase.
 * @param email - E-mail de l'utilisateur (facultatif).
 * @returns L'identifiant client Stripe (`cus_…`).
 */
async function ensureCustomer(stripe: Stripe, uid: string, email: string | undefined): Promise<string> {
  const ref = dbAdmin.doc(`customers/${uid}`);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;
  if (existing && existing.stripeId) return existing.stripeId as string;
  const customer = await stripe.customers.create({ email: email || undefined, metadata: { firebaseUID: uid } });
  await ref.set({ stripeId: customer.id, email: email || null }, { merge: true });
  return customer.id;
}

/** Données attendues du client pour lancer un Checkout. */
interface CheckoutData {
  price?: string;
  successUrl?: string;
  cancelUrl?: string;
}

// ── Checkout (abonnement) ────────────────────────────────────────────────────
export const createStripeCheckout = onCall(
  { secrets: [STRIPE_SECRET], region: REGION, timeoutSeconds: 30, memory: "256MiB" },
  async (request: CallableRequest<CheckoutData>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const uid = request.auth.uid;
    const email = request.auth.token && request.auth.token.email;
    const { price, successUrl, cancelUrl } = request.data || {};
    if (!price || typeof price !== "string" || !price.startsWith("price_")) throw new HttpsError("invalid-argument", "Tarif invalide.");
    if (!successUrl || !cancelUrl) throw new HttpsError("invalid-argument", "URLs de retour manquantes.");
    const stripe = stripeClient();
    try {
      // Durcissement : on n'accepte QUE des tarifs Stripe actifs et récurrents
      // (bloque un `price` ponctuel / inactif / inconnu passé par un client forgé).
      let priceObj: Stripe.Price;
      try { priceObj = await stripe.prices.retrieve(price); }
      catch { throw new HttpsError("invalid-argument", "Tarif inconnu."); }
      if (!priceObj.active || priceObj.type !== "recurring") throw new HttpsError("invalid-argument", "Tarif invalide pour un abonnement.");

      const customer = await ensureCustomer(stripe, uid, email);

      // Garde anti-double-abonnement : si un abonnement actif/en essai existe déjà,
      // on refuse un nouveau Checkout (évite le double prélèvement) → gérer via le portail.
      const existing = await stripe.subscriptions.list({ customer, status: "all", limit: 10 });
      if (existing.data.some((s) => ACTIVE_STATUSES.includes(s.status))) {
        throw new HttpsError("failed-precondition", "Tu as déjà un abonnement actif. Gère-le depuis « Gérer mon abonnement ».");
      }

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
      if (e instanceof HttpsError) throw e;
      logger.error("createStripeCheckout:", e);
      throw new HttpsError("internal", `Paiement impossible : ${(e instanceof Error && e.message) || "erreur Stripe"}`);
    }
  }
);

/** Données attendues du client pour ouvrir le portail. */
interface PortalData {
  returnUrl?: string;
}

// ── Portail de facturation (gérer / annuler) ─────────────────────────────────
export const createStripePortal = onCall(
  { secrets: [STRIPE_SECRET], region: REGION, timeoutSeconds: 30, memory: "256MiB" },
  async (request: CallableRequest<PortalData>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const uid = request.auth.uid;
    const { returnUrl } = request.data || {};
    if (!returnUrl) throw new HttpsError("invalid-argument", "URL de retour manquante.");
    const snap = await dbAdmin.doc(`customers/${uid}`).get();
    const stripeId = snap.exists ? (snap.data()!.stripeId as string | undefined) : null;
    if (!stripeId) throw new HttpsError("failed-precondition", "Aucun abonnement à gérer pour ce compte.");
    const stripe = stripeClient();
    try {
      const session = await stripe.billingPortal.sessions.create({ customer: stripeId, return_url: returnUrl });
      return { url: session.url };
    } catch (e) {
      logger.error("createStripePortal:", e);
      throw new HttpsError("internal", `Portail indisponible : ${(e instanceof Error && e.message) || "erreur Stripe"}`);
    }
  }
);

/**
 * Retrouve l'uid Firebase d'un abonnement (métadonnée, sinon via le client Stripe).
 *
 * @param stripe - Client Stripe.
 * @param sub - L'abonnement Stripe.
 * @returns L'uid Firebase, ou `null` s'il est introuvable.
 */
async function uidForSubscription(stripe: Stripe, sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = uidFromMetadata(sub);
  if (fromMeta) return fromMeta;
  const custId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const cust = await stripe.customers.retrieve(custId);
  return !cust.deleted && cust.metadata ? (cust.metadata.firebaseUID || null) : null;
}

/**
 * Écrit l'état d'abonnement dans Firestore (source de vérité du front).
 *
 * @param stripe - Client Stripe.
 * @param sub - L'abonnement Stripe à synchroniser.
 */
async function syncSubscription(stripe: Stripe, sub: Stripe.Subscription): Promise<void> {
  const uid = await uidForSubscription(stripe, sub);
  if (!uid) { logger.warn("stripeWebhook : aucun firebaseUID pour l'abonnement", sub.id); return; }
  await dbAdmin.doc(`customers/${uid}/subscriptions/${sub.id}`).set(
    { ...subscriptionDocFields(sub), updated: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// ── Webhook Stripe (signature vérifiée) ──────────────────────────────────────
export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET], region: REGION, timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET.value(), { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"] as string, STRIPE_WEBHOOK_SECRET.value());
    } catch (e) {
      logger.error("stripeWebhook : signature invalide", e instanceof Error && e.message);
      res.status(400).send(`Webhook signature verification failed: ${(e instanceof Error && e.message) || ""}`);
      return;
    }
    try {
      if (event.type.startsWith("customer.subscription.")) {
        await syncSubscription(stripe, event.data.object as Stripe.Subscription);
      } else if (event.type === "checkout.session.completed") {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          await syncSubscription(stripe, await stripe.subscriptions.retrieve(subId));
        }
      }
      res.json({ received: true });
    } catch (e) {
      logger.error("stripeWebhook : erreur de traitement", e);
      res.status(500).send("handler error");
    }
  }
);
