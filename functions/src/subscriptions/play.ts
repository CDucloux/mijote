// ─── PAIEMENT CARDAMOME+ (Google Play Billing, vérification maison) ──────────────
// Pendant Android du canal Stripe (cf. stripe.ts), sans dépendance tierce payante :
//   • verifyPlayPurchase (callable) → vérifie un reçu Play, acquitte, écrit le doc ;
//   • playRtdnWebhook    (HTTP)     → RTDN Pub/Sub → Firestore (cycle de vie).
//
// Source de vérité inchangée : `customers/{uid}/subscriptions` (même forme que Stripe,
// avec `channel: "play"`), ce que le front et `access.ts` lisent déjà tel quel. Le
// mapping `playPurchases/{purchaseToken} → uid` permet de résoudre l'uid des RTDN
// (qui ne le portent pas). Toute la logique PURE vit dans playHelpers.ts (testée).
//
// Accès à la Play Developer API : ADC (service account des Functions habilité en Play
// Console), SANS clé de fichier. Voir docs/google-play-billing.md.
import * as logger from "firebase-functions/logger";
import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";
import { ACTIVE_STATUSES } from "./stripeHelpers.js";
import {
  playPurchaseToDocFields,
  playProductId,
  isAllowedPlayProduct,
  parseRtdnEnvelope,
  type PlaySubscriptionPurchaseV2,
} from "./playHelpers.js";

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

const REGION = "europe-west1"; // même région que les autres fonctions
const ANDROID_PACKAGE = "studio.cardamome"; // appId Capacitor (cf. capacitor.config.json)
/** Produits d'abonnement Cardamome+ acceptés (allow-list serveur anti-forge). */
const PLUS_PRODUCT_IDS = ["cardamome_plus"] as const;
const ANDROIDPUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";

// Secret partagé avec l'abonnement push Pub/Sub (passé en query `?token=…`), analogue
// de la signature du webhook Stripe : on ne traite jamais un push non authentifié.
const PLAY_RTDN_SECRET = defineSecret("PLAY_RTDN_SECRET");

/** Client d'authentification Google (ADC), réutilisé entre invocations chaudes. */
let authClient: GoogleAuth | null = null;
function playAuth(): GoogleAuth {
  if (!authClient) authClient = new GoogleAuth({ scopes: [ANDROIDPUBLISHER_SCOPE] });
  return authClient;
}

/** En-tête d'autorisation Bearer pour la Play Developer API (jeton ADC scellé). */
async function authHeader(): Promise<string> {
  const token = await playAuth().getAccessToken();
  if (!token) throw new HttpsError("internal", "Jeton Google Play indisponible.");
  return `Bearer ${token}`;
}

/**
 * Récupère l'état d'un abonnement Play (API v2). Ne fait confiance à aucune donnée
 * client : c'est l'API Google qui fait foi.
 *
 * @param purchaseToken - Le jeton d'achat renvoyé par Play Billing.
 * @returns L'achat (forme minimale lue par les helpers).
 */
async function getSubscriptionV2(purchaseToken: string): Promise<PlaySubscriptionPurchaseV2> {
  const url = `${API_BASE}/applications/${ANDROID_PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: await authHeader() } });
  if (!res.ok) throw new HttpsError("internal", `Vérification Play échouée (${res.status}).`);
  return (await res.json()) as PlaySubscriptionPurchaseV2;
}

/**
 * Acquitte un achat d'abonnement (obligatoire sous 3 jours, sinon remboursement
 * automatique). Idempotent côté Play ; on n'appelle que si nécessaire.
 *
 * @param subscriptionId - Le productId d'abonnement.
 * @param purchaseToken - Le jeton d'achat.
 */
async function acknowledge(subscriptionId: string, purchaseToken: string): Promise<void> {
  const url = `${API_BASE}/applications/${ANDROID_PACKAGE}/purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: await authHeader(), "Content-Type": "application/json" }, body: "{}" });
  // 410 Gone : déjà acquitté / expiré → non bloquant.
  if (!res.ok && res.status !== 410) logger.warn("acknowledge Play non-OK", res.status, subscriptionId);
}

/** Un abonnement actif existe-t-il déjà pour cet uid (n'importe quel canal) ? */
async function hasActiveSubscription(uid: string): Promise<boolean> {
  const snap = await dbAdmin.collection(`customers/${uid}/subscriptions`).where("status", "in", [...ACTIVE_STATUSES]).limit(1).get();
  return !snap.empty;
}

/** Écrit l'état d'abonnement Play + le mapping token→uid (résolveur des RTDN). */
async function writePlaySubscription(uid: string, purchaseToken: string, purchase: PlaySubscriptionPurchaseV2): Promise<void> {
  const fields = playPurchaseToDocFields(purchase, Date.now());
  await dbAdmin.doc(`customers/${uid}/subscriptions/${purchaseToken}`).set({ ...fields, updated: FieldValue.serverTimestamp() }, { merge: true });
  await dbAdmin.doc(`playPurchases/${purchaseToken}`).set({ uid, productId: playProductId(purchase), updated: FieldValue.serverTimestamp() }, { merge: true });
}

/** Données attendues du client pour vérifier un achat Play. */
interface VerifyData {
  purchaseToken?: string;
  productId?: string;
  packageName?: string;
}

// ── Vérification d'un achat (callable) ───────────────────────────────────────
export const verifyPlayPurchase = onCall(
  { region: REGION, timeoutSeconds: 30, memory: "256MiB" },
  async (request: CallableRequest<VerifyData>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const uid = request.auth.uid;
    const { purchaseToken, productId, packageName } = request.data || {};
    if (!purchaseToken || typeof purchaseToken !== "string") throw new HttpsError("invalid-argument", "Jeton d'achat manquant.");
    if (!isAllowedPlayProduct(productId, PLUS_PRODUCT_IDS)) throw new HttpsError("invalid-argument", "Produit inconnu.");
    if (packageName && packageName !== ANDROID_PACKAGE) throw new HttpsError("invalid-argument", "Application inattendue.");

    // Anti-usurpation (premier réclamant) : un jeton déjà rattaché à un AUTRE uid ne
    // peut être revendiqué. Combiné à l'acquittement serveur, empêche de « voler » un achat.
    const mapSnap = await dbAdmin.doc(`playPurchases/${purchaseToken}`).get();
    if (mapSnap.exists && mapSnap.get("uid") && mapSnap.get("uid") !== uid) {
      throw new HttpsError("permission-denied", "Cet achat est rattaché à un autre compte.");
    }

    // Garde anti-double-abonnement inter-canal (décision produit : bloquer + message).
    if (await hasActiveSubscription(uid)) {
      throw new HttpsError("failed-precondition", "Tu as déjà un abonnement actif. Gère-le depuis « Gérer mon abonnement ».");
    }

    try {
      const purchase = await getSubscriptionV2(purchaseToken);
      await acknowledge(productId as string, purchaseToken);
      await writePlaySubscription(uid, purchaseToken, purchase);
      return { ok: true };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.error("verifyPlayPurchase:", e);
      throw new HttpsError("internal", "Vérification de l'achat impossible.");
    }
  }
);

// ── Webhook RTDN (push Pub/Sub authentifié par secret) ───────────────────────
export const playRtdnWebhook = onRequest(
  { secrets: [PLAY_RTDN_SECRET], region: REGION, timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    // Authentification du push : secret partagé en query (posé sur l'URL de
    // l'abonnement Pub/Sub), pendant de la vérification de signature Stripe.
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!PLAY_RTDN_SECRET.value() || token !== PLAY_RTDN_SECRET.value()) {
      res.status(401).send("unauthorized");
      return;
    }

    // Enveloppe Pub/Sub : { message: { data: base64 }, subscription }.
    const body = req.body as { message?: { data?: string } } | undefined;
    const event = parseRtdnEnvelope(body && body.message ? body.message.data : undefined);
    if (!event) {
      // Payload inexploitable : on ACK quand même (200) pour ne pas boucler les redéliveries.
      res.status(200).json({ ignored: true });
      return;
    }
    if (event.kind === "test") { res.status(200).json({ test: true }); return; }

    try {
      const uidSnap = await dbAdmin.doc(`playPurchases/${event.purchaseToken}`).get();
      const uid = uidSnap.exists ? (uidSnap.get("uid") as string | undefined) : undefined;
      if (!uid) {
        // Jeton inconnu (achat jamais vérifié côté client) : rien à réconcilier.
        logger.warn("playRtdnWebhook : uid introuvable pour le token", event.purchaseToken);
        res.status(200).json({ unmapped: true });
        return;
      }
      // On ne fait JAMAIS confiance au type de notification : on re-lit l'état réel.
      const purchase = await getSubscriptionV2(event.purchaseToken);
      await writePlaySubscription(uid, event.purchaseToken, purchase);
      res.status(200).json({ received: true });
    } catch (e) {
      logger.error("playRtdnWebhook : erreur de traitement", e);
      res.status(500).send("handler error");
    }
  }
);
