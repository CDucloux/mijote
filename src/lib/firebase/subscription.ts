/**
 * Abonnement Cardamome+, intégration Stripe MAISON (Cloud Functions, sans dépendre
 * de l'extension Firebase en fin de vie). Le front :
 *   • écoute `customers/{uid}/subscriptions` (statut renseigné par le webhook) ;
 *   • appelle `createStripeCheckout` pour obtenir l'URL de Stripe Checkout ;
 *   • appelle `createStripePortal` pour ouvrir le portail de facturation.
 * Toute la logique de paiement vit côté fonctions (voir functions/stripe.js).
 *
 * @module subscription
 */
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, firebaseApp } from "@/lib/firebase/firebase.js";
import { APP_BASE } from "@/lib/ui/appZone.js";

/** Statuts Stripe considérés comme « abonné actif ». */
const ACTIVE_STATUSES = ["trialing", "active"];
/** Région des Cloud Functions Cardamome (surchargée via env si besoin). */
const REGION = import.meta.env.VITE_STRIPE_EXT_REGION || "europe-west1";

/**
 * Écoute l'état d'abonnement de l'utilisateur.
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @param cb - Rappelé avec `true` dès qu'un abonnement actif existe, `false` sinon.
 * @returns La fonction de désabonnement (onSnapshot).
 */
export function subscribeToPlan(uid: string, cb: (active: boolean) => void): () => void {
  const q = query(collection(db, "customers", uid, "subscriptions"), where("status", "in", ACTIVE_STATUSES));
  return onSnapshot(q, snap => cb(!snap.empty), () => cb(false));
}

/**
 * Lance un Stripe Checkout (mode abonnement) pour un tarif donné, puis redirige
 * vers la page de paiement. La session est créée côté serveur (uid dérivé du token
 * d'authentification, d'où le `_uid` inutilisé ici, conservé pour l'appelant).
 *
 * @param _uid - L'identifiant de l'utilisateur (non utilisé : le serveur le dérive).
 * @param priceId - L'ID de tarif Stripe (`price_…`).
 * @param onError - Rappel optionnel invoqué avec un message lisible en cas d'échec.
 */
export async function startCheckout(_uid: string, priceId: string, onError?: (msg: string) => void): Promise<void> {
  try {
    const fn = httpsCallable(getFunctions(firebaseApp, REGION), "createStripeCheckout");
    const { data } = await fn({
      price: priceId,
      successUrl: `${window.location.origin}${APP_BASE}/plan?checkout=success`,
      cancelUrl: `${window.location.origin}${APP_BASE}/plan`,
    });
    const url = (data as { url?: string })?.url;
    if (url) window.location.assign(url);
    else onError?.("Paiement impossible.");
  } catch (e) {
    onError?.((e as { message?: string })?.message || "Paiement impossible.");
  }
}

/**
 * Ouvre le portail de facturation Stripe (gérer / annuler l'abonnement), puis
 * redirige.
 *
 * @param onError - Rappel optionnel invoqué avec un message lisible en cas d'échec.
 */
export async function openBillingPortal(onError?: (msg: string) => void): Promise<void> {
  try {
    const fn = httpsCallable(getFunctions(firebaseApp, REGION), "createStripePortal");
    const { data } = await fn({ returnUrl: `${window.location.origin}${APP_BASE}/plan` });
    const url = (data as { url?: string })?.url;
    if (url) window.location.assign(url);
    else onError?.("Portail de facturation indisponible.");
  } catch (e) {
    onError?.((e as { message?: string })?.message || "Portail de facturation indisponible.");
  }
}
