import { useState, useEffect } from "react";
import { subscribeToPlan } from "@/lib/firebase/subscription.js";

/**
 * Suit l'état d'abonnement Mijoté+ de l'utilisateur (extension Stripe Firebase).
 *
 * @param uid - L'identifiant de l'utilisateur (ou falsy si déconnecté).
 * @returns `true` tant qu'un abonnement Stripe actif existe.
 *
 * @example
 * ```tsx
 * const subscribed = useSubscription(user?.uid);
 * const isPlus = isAdmin || subscribed;
 * ```
 */
export function useSubscription(uid: string | null | undefined): boolean {
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!uid) { setSubscribed(false); return; }
    return subscribeToPlan(uid, setSubscribed);
  }, [uid]);
  return subscribed;
}
