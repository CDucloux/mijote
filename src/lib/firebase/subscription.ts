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

/** URL de gestion des abonnements Google Play (canal `play`, hors portail Stripe). */
export const PLAY_SUBS_URL = "https://play.google.com/store/account/subscriptions";

/**
 * État d'abonnement Cardamome+ vu du front. `active` reste le signal booléen
 * historique (accès premium) ; les autres champs alimentent le récap de la page
 * Formule et ne sont renseignés que lorsqu'un abonnement réel existe.
 */
export interface PlanState {
  /** Un abonnement actif (ou en essai) existe. */
  active: boolean;
  /** Canal de facturation, pour router la gestion (portail Stripe vs Google Play). */
  channel: "stripe" | "play" | null;
  /** Périodicité, dérivée du tarif Stripe vs les env `VITE_STRIPE_PRICE_*`. */
  plan: "monthly" | "yearly" | null;
  /** L'abonnement est résilié mais court jusqu'à `currentPeriodEnd`. */
  cancelAtPeriodEnd: boolean;
  /** Fin de la période en cours (renouvellement, ou date de fin si résilié). */
  currentPeriodEnd: Date | null;
  /** Date de première souscription (`created`). */
  since: Date | null;
}

/** État « aucun abonnement » : le défaut sûr (déconnecté, snapshot vide, erreur). */
export const EMPTY_PLAN: PlanState = {
  active: false, channel: null, plan: null,
  cancelAtPeriodEnd: false, currentPeriodEnd: null, since: null,
};

/**
 * Périodicité déduite d'un identifiant de tarif Stripe, par comparaison aux env
 * `VITE_STRIPE_PRICE_*`. Ne matche qu'une chaîne non vide, pour ne pas confondre
 * `undefined === undefined` quand les env sont absentes.
 *
 * @param price - L'identifiant de tarif (`price_…`) lu dans le doc Firestore.
 * @returns `"yearly"`, `"monthly"`, ou `null` si inconnu.
 */
export function derivePlanPeriod(price: unknown): "monthly" | "yearly" | null {
  if (typeof price !== "string" || !price) return null;
  if (price === import.meta.env.VITE_STRIPE_PRICE_YEARLY) return "yearly";
  if (price === import.meta.env.VITE_STRIPE_PRICE_MONTHLY) return "monthly";
  return null;
}

/**
 * Convertit une valeur de date issue de Firestore (`Timestamp`, `Date`, ou epoch
 * ms) en `Date`, ou `null` si la forme est inattendue. Payload `unknown` narrowé,
 * jamais casté à l'aveugle (cf. CLAUDE.md).
 */
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return new Date(v);
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    const d = (v as { toDate: () => unknown }).toDate();
    return d instanceof Date ? d : null;
  }
  return null;
}

/**
 * Narrowe un document `customers/{uid}/subscriptions` (écrit par le webhook, cf.
 * `functions/src/subscriptions/stripeHelpers.ts`) en {@link PlanState} actif. Le
 * document provenant du snapshot déjà filtré sur les statuts actifs, `active` est
 * toujours `true` ici.
 *
 * @param raw - Les données brutes du document (`unknown`).
 * @returns L'état d'abonnement, `active: true`.
 */
export function parseActiveSubscription(raw: unknown): PlanState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PLAN, active: true };
  const d = raw as Record<string, unknown>;
  return {
    active: true,
    channel: d.channel === "play" ? "play" : "stripe",
    plan: derivePlanPeriod(d.price),
    cancelAtPeriodEnd: d.cancelAtPeriodEnd === true,
    currentPeriodEnd: toDate(d.currentPeriodEnd),
    since: toDate(d.created),
  };
}

/**
 * Écoute l'état d'abonnement de l'utilisateur.
 *
 * @param uid - L'identifiant de l'utilisateur.
 * @param cb - Rappelé avec l'état d'abonnement courant ({@link EMPTY_PLAN} si aucun).
 * @returns La fonction de désabonnement (onSnapshot).
 */
export function subscribeToPlan(uid: string, cb: (state: PlanState) => void): () => void {
  const q = query(collection(db, "customers", uid, "subscriptions"), where("status", "in", ACTIVE_STATUSES));
  return onSnapshot(
    q,
    snap => cb(snap.docs[0] ? parseActiveSubscription(snap.docs[0].data()) : EMPTY_PLAN),
    () => cb(EMPTY_PLAN),
  );
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
