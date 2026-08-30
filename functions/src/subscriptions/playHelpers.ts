// ─── HELPERS PURS GOOGLE PLAY BILLING (sans I/O) ─────────────────────────────
// Isolés de play.ts (qui, lui, dépend de google-auth-library / firebase-admin)
// pour être testables sans réseau ni credentials. Cf. playHelpers.test.ts et
// docs/google-play-billing.md. Miroir de stripeHelpers.ts pour le canal Play.
//
// Deux traductions délicates vivent ici, et sont la principale source de bugs si
// mal faites (d'où leurs tests dédiés) :
//   • état d'abonnement Play → `status` de forme partagée (grace period = accès
//     MAINTENU ; account hold = accès COUPÉ) ;
//   • enveloppe RTDN (Pub/Sub) → événement exploitable, payload malformé rejeté.
import type { SubscriptionDocFields } from "./stripeHelpers.js";

/** États d'abonnement renvoyés par `purchases.subscriptionsv2` (Play Developer API). */
export type PlaySubscriptionState =
  | "SUBSCRIPTION_STATE_UNSPECIFIED"
  | "SUBSCRIPTION_STATE_PENDING"
  | "SUBSCRIPTION_STATE_ACTIVE"
  | "SUBSCRIPTION_STATE_PAUSED"
  | "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
  | "SUBSCRIPTION_STATE_ON_HOLD"
  | "SUBSCRIPTION_STATE_CANCELED"
  | "SUBSCRIPTION_STATE_EXPIRED";

/** Forme MINIMALE (les seuls champs lus) d'un `SubscriptionPurchaseV2`. */
export interface PlaySubscriptionPurchaseV2 {
  subscriptionState?: string;
  startTime?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
    externalAccountId?: string;
  };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    offerDetails?: { basePlanId?: string; offerId?: string };
  }>;
}

/** Statut de forme partagée (compatible `SubscriptionDocFields.status`). */
type SharedStatus = SubscriptionDocFields["status"];

/** Statuts donnant accès à Cardamome+ (doit refléter `ACTIVE_STATUSES` de Stripe). */
const ACCESS_STATUSES: readonly SharedStatus[] = ["active", "trialing"];

/**
 * @param status - Statut de forme partagée.
 * @returns `true` si le statut donne accès à Cardamome+.
 */
export function grantsAccess(status: SharedStatus): boolean {
  return ACCESS_STATUSES.includes(status);
}

/** Parse une date RFC3339 en ms epoch, ou `null` si absente/invalide. */
function parseTimeMs(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Expiration la plus tardive parmi les `lineItems` (ms epoch), ou `null`. */
function latestExpiryMs(purchase: PlaySubscriptionPurchaseV2): number | null {
  const items = purchase.lineItems || [];
  let max: number | null = null;
  for (const it of items) {
    const ms = parseTimeMs(it.expiryTime);
    if (ms !== null && (max === null || ms > max)) max = ms;
  }
  return max;
}

/** Le renouvellement auto est-il coupé (au moins un item non renouvelable) ? */
function autoRenewOff(purchase: PlaySubscriptionPurchaseV2): boolean {
  const items = purchase.lineItems || [];
  // Un abonnement mono-item : on lit son plan. `autoRenewEnabled` absent => on ne
  // suppose PAS une résiliation (défaut prudent : renouvellement supposé actif).
  return items.some((it) => it.autoRenewingPlan && it.autoRenewingPlan.autoRenewEnabled === false);
}

/**
 * Traduit l'état d'abonnement Play en `status` de forme partagée. Le point clé :
 * `IN_GRACE_PERIOD` garde l'accès (paiement en retard mais toléré), `ON_HOLD` et
 * `PAUSED` le coupent. Un `CANCELED` encore dans sa période payée garde l'accès
 * jusqu'à l'expiration (résiliation programmée).
 *
 * @param state - L'état Play (`SUBSCRIPTION_STATE_*`).
 * @param expiryMs - Fin de période (ms epoch), ou `null`.
 * @param nowMs - Horodatage courant (ms epoch), injecté pour la testabilité.
 * @returns Le statut partagé (`active` / `trialing` donnent accès ; le reste non).
 */
export function playStateToStatus(state: string | undefined, expiryMs: number | null, nowMs: number): SharedStatus {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "active";
    case "SUBSCRIPTION_STATE_CANCELED":
      // Résilié mais éventuellement encore dans la période payée : accès maintenu
      // tant que l'expiration est future, coupé sinon.
      return expiryMs !== null && expiryMs > nowMs ? "active" : "canceled";
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PAUSED":
      return "past_due"; // accès coupé (hors ACCESS_STATUSES)
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "canceled";
    case "SUBSCRIPTION_STATE_PENDING":
    default:
      return "incomplete"; // achat non finalisé / état inconnu : jamais d'accès par défaut
  }
}

/**
 * `productId[:basePlanId]` de l'abonnement (équivalent du `price_…` Stripe), ou `null`.
 *
 * @param purchase - L'achat Play.
 * @returns Un identifiant de tarif lisible, ou `null` si indéterminable.
 */
export function playPriceId(purchase: PlaySubscriptionPurchaseV2): string | null {
  const item = purchase.lineItems && purchase.lineItems[0];
  if (!item || !item.productId) return null;
  const basePlan = item.offerDetails && item.offerDetails.basePlanId;
  return basePlan ? `${item.productId}:${basePlan}` : item.productId;
}

/** `productId` brut de l'abonnement (pour l'allow-list serveur), ou `null`. */
export function playProductId(purchase: PlaySubscriptionPurchaseV2): string | null {
  const item = purchase.lineItems && purchase.lineItems[0];
  return (item && item.productId) || null;
}

/** Identifiant de compte obfusqué (rapproché de l'uid côté serveur), ou `null`. */
export function obfuscatedAccountId(purchase: PlaySubscriptionPurchaseV2): string | null {
  const ext = purchase.externalAccountIdentifiers;
  return (ext && ext.obfuscatedExternalAccountId) || null;
}

/** L'achat est-il déjà acquitté auprès de Play ? (sinon : à acquitter, règle des 3 j). */
export function isAcknowledged(purchase: PlaySubscriptionPurchaseV2): boolean {
  return purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
}

/**
 * Champs Firestore dérivés d'un achat Play (forme partagée, `channel: "play"`).
 * `updated` (serverTimestamp) est ajouté côté appelant, qui a l'Admin SDK.
 *
 * @param purchase - L'achat Play (réponse `subscriptionsv2.get`).
 * @param nowMs - Horodatage courant (ms epoch), injecté pour la testabilité.
 * @returns Les champs d'état sérialisables (jamais l'uid ni de secret).
 */
export function playPurchaseToDocFields(purchase: PlaySubscriptionPurchaseV2, nowMs: number): SubscriptionDocFields {
  const expiryMs = latestExpiryMs(purchase);
  const startMs = parseTimeMs(purchase.startTime);
  return {
    status: playStateToStatus(purchase.subscriptionState, expiryMs, nowMs),
    channel: "play",
    price: playPriceId(purchase),
    cancelAtPeriodEnd: autoRenewOff(purchase),
    currentPeriodEnd: expiryMs !== null ? new Date(expiryMs) : null,
    created: startMs !== null ? new Date(startMs) : null,
  };
}

/**
 * @param productId - Le produit d'abonnement de l'achat.
 * @param allowed - Allow-list serveur des produits Cardamome+.
 * @returns `true` si le produit est un abonnement Cardamome+ reconnu.
 */
export function isAllowedPlayProduct(productId: string | null | undefined, allowed: readonly string[]): boolean {
  return !!productId && allowed.includes(productId);
}

// ── RTDN (Real-time Developer Notifications) ─────────────────────────────────

/** Types de notification d'abonnement (cf. Play Developer API). */
export const RTDN_SUBSCRIPTION_TYPE = {
  RECOVERED: 1,
  RENEWED: 2,
  CANCELED: 3,
  PURCHASED: 4,
  ON_HOLD: 5,
  IN_GRACE_PERIOD: 6,
  RESTARTED: 7,
  PRICE_CHANGE_CONFIRMED: 8,
  DEFERRED: 9,
  PAUSED: 10,
  PAUSE_SCHEDULE_CHANGED: 11,
  REVOKED: 12,
  EXPIRED: 13,
} as const;

/** Événement RTDN exploitable, discriminé par `kind`. */
export type RtdnEvent =
  | { kind: "subscription"; purchaseToken: string; subscriptionId: string; notificationType: number }
  | { kind: "voided"; purchaseToken: string }
  | { kind: "test" };

/**
 * Décode et valide une enveloppe RTDN (le champ `message.data` en base64 d'un push
 * Pub/Sub). Ne fait JAMAIS confiance au seul type de notification : l'appelant
 * re-vérifie l'état réel auprès de l'API. Retourne `null` pour tout payload
 * malformé, inconnu ou incomplet (jamais d'exception, jamais d'accès par défaut).
 *
 * @param dataBase64 - Le champ `message.data` (base64) reçu de Pub/Sub.
 * @returns L'événement discriminé, ou `null` si le payload est inexploitable.
 */
export function parseRtdnEnvelope(dataBase64: string | undefined | null): RtdnEvent | null {
  if (!dataBase64 || typeof dataBase64 !== "string") return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(dataBase64, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const n = json as Record<string, unknown>;

  const sub = n.subscriptionNotification;
  if (sub && typeof sub === "object") {
    const s = sub as Record<string, unknown>;
    if (typeof s.purchaseToken === "string" && typeof s.subscriptionId === "string" && typeof s.notificationType === "number") {
      return { kind: "subscription", purchaseToken: s.purchaseToken, subscriptionId: s.subscriptionId, notificationType: s.notificationType };
    }
    return null;
  }

  const voided = n.voidedPurchaseNotification;
  if (voided && typeof voided === "object") {
    const v = voided as Record<string, unknown>;
    if (typeof v.purchaseToken === "string") return { kind: "voided", purchaseToken: v.purchaseToken };
    return null;
  }

  if (n.testNotification && typeof n.testNotification === "object") return { kind: "test" };

  return null;
}
