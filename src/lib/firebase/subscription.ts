/**
 * Abonnement Mijoté+ via l'extension Firebase **firestore-stripe-payments**.
 * L'extension synchronise les abonnements dans `customers/{uid}/subscriptions` et
 * consomme un doc écrit dans `customers/{uid}/checkout_sessions` pour créer une
 * session Stripe Checkout. Ce module ne fait qu'écrire/écouter ces documents —
 * toute la logique de paiement vit dans l'extension (webhooks Stripe côté serveur).
 *
 * @module subscription
 */
import { collection, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, firebaseApp } from "@/lib/firebase/firebase.js";

/** Statuts Stripe considérés comme « abonné actif ». */
const ACTIVE_STATUSES = ["trialing", "active"];

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
 * vers la page de paiement Stripe. L'extension remplit l'URL de façon asynchrone.
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @param priceId - L'ID de tarif Stripe (`price_…`).
 * @param onError - Rappel optionnel invoqué avec un message lisible en cas d'échec.
 */
export async function startCheckout(uid: string, priceId: string, onError?: (msg: string) => void): Promise<void> {
  try {
    const ref = await addDoc(collection(db, "customers", uid, "checkout_sessions"), {
      mode: "subscription",
      price: priceId,
      allow_promotion_codes: true,
      success_url: `${window.location.origin}/plus?checkout=success`,
      cancel_url: `${window.location.origin}/plus`,
    });
    const unsub = onSnapshot(ref, snap => {
      const data = snap.data() as { error?: { message?: string }; url?: string } | undefined;
      if (!data) return;
      if (data.error) { unsub(); onError?.(data.error.message || "Paiement impossible."); }
      else if (data.url) { unsub(); window.location.assign(data.url); }
    });
  } catch (e) {
    onError?.((e as { message?: string })?.message || "Paiement impossible.");
  }
}

/**
 * Ouvre le portail de facturation Stripe (gérer / annuler l'abonnement) via la
 * fonction appelable de l'extension, puis redirige.
 *
 * @param onError - Rappel optionnel invoqué avec un message lisible en cas d'échec.
 */
export async function openBillingPortal(onError?: (msg: string) => void): Promise<void> {
  try {
    // Région de l'extension (par défaut us-central1 ; surcharge via env si déployée ailleurs).
    const region = import.meta.env.VITE_STRIPE_EXT_REGION || "us-central1";
    const fn = httpsCallable(getFunctions(firebaseApp, region), "ext-firestore-stripe-payments-createPortalLink");
    const { data } = await fn({ returnUrl: `${window.location.origin}/plus` });
    const url = (data as { url?: string })?.url;
    if (url) window.location.assign(url);
    else onError?.("Portail de facturation indisponible.");
  } catch (e) {
    onError?.((e as { message?: string })?.message || "Portail de facturation indisponible.");
  }
}
