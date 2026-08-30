// ─── HELPERS PURS ABONNEMENT (sans I/O) ──────────────────────────────────────
// Isolés de stripe.ts (qui, lui, dépend de firebase-admin / stripe) pour être
// testables sans réseau ni credentials. Cf. stripeHelpers.test.ts.
import type Stripe from "stripe";

/** Canal d'achat d'un abonnement. Absent sur les docs Stripe historiques (cf. `channelOf`). */
export type SubscriptionChannel = "stripe" | "play" | "appstore";

/** Champs Firestore dérivés d'un abonnement (état d'accès Cardamome+), tous canaux. */
export interface SubscriptionDocFields {
  status: Stripe.Subscription.Status;
  /** Canal d'achat, pour router la gestion (portail Stripe vs Play Store). */
  channel: SubscriptionChannel;
  price: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  created: Date | null;
}

/**
 * Canal d'un doc d'abonnement, avec repli `"stripe"` : les docs écrits avant
 * l'ajout du champ `channel` (tous Stripe) restent correctement identifiés sans
 * migration. C'est ce qui permet à Play d'être purement additif.
 *
 * @param data - Le doc d'abonnement (ou une forme partielle avec `channel`).
 * @returns Le canal, `"stripe"` si le champ est absent.
 */
export function channelOf(data: { channel?: string } | null | undefined): SubscriptionChannel {
  const c = data && data.channel;
  return c === "play" || c === "appstore" ? c : "stripe";
}

/** Statuts Stripe considérés « abonné actif ». Doit refléter le front (subscribeToPlan). */
export const ACTIVE_STATUSES: readonly Stripe.Subscription.Status[] = ["active", "trialing"];

/**
 * @param status - Statut Stripe de l'abonnement.
 * @returns `true` si le statut donne accès à Cardamome+.
 */
export function isActiveStatus(status: string | undefined | null): boolean {
  return ACTIVE_STATUSES.includes(status as Stripe.Subscription.Status);
}

/**
 * uid Firebase porté par la métadonnée de l'abonnement (sans réseau), sinon null.
 *
 * @param sub - L'abonnement Stripe (ou une forme partielle avec `metadata`).
 * @returns L'uid Firebase, ou `null` s'il est absent.
 */
export function uidFromMetadata(sub: { metadata?: Stripe.Metadata | null } | null | undefined): string | null {
  return (sub && sub.metadata && sub.metadata.firebaseUID) || null;
}

/**
 * Champs Firestore dérivés d'un objet Subscription Stripe (forme minimale).
 * `updated` (serverTimestamp) est ajouté côté appelant, qui a accès à l'Admin SDK.
 *
 * @param sub - L'abonnement Stripe.
 * @returns Les champs d'état sérialisables (jamais l'uid ni de secret).
 */
export function subscriptionDocFields(sub: Stripe.Subscription): SubscriptionDocFields {
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  const price = item && item.price ? item.price.id : null;
  // `current_period_end` vit sur l'item d'abonnement dans les versions récentes de
  // l'API ; on retombe sur le champ historique au niveau de l'abonnement si besoin.
  const periodEnd = (item as { current_period_end?: number } | undefined)?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return {
    status: sub.status,
    channel: "stripe",
    price,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    created: sub.created ? new Date(sub.created * 1000) : null,
  };
}
