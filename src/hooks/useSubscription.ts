import { useState, useEffect } from "react";
import { subscribeToPlan, EMPTY_PLAN, type PlanState } from "@/lib/firebase/subscription.js";

/**
 * Suit l'état d'abonnement Cardamome+ de l'utilisateur (intégration Stripe maison,
 * cf. docs/stripe-mijote-plus.md). Renvoie l'objet {@link PlanState} complet ;
 * `active` reste le booléen d'accès premium consommé partout ailleurs.
 *
 * @param uid - L'identifiant de l'utilisateur (ou falsy si déconnecté).
 * @returns L'état d'abonnement courant ({@link EMPTY_PLAN} tant qu'aucun actif).
 *
 * @example
 * ```tsx
 * const sub = useSubscription(user?.uid);
 * const isPlus = isAdmin || sub.active;
 * ```
 */
export function useSubscription(uid: string | null | undefined): PlanState {
  const [state, setState] = useState<PlanState>(EMPTY_PLAN);
  useEffect(() => {
    if (!uid) { setState(EMPTY_PLAN); return; }
    return subscribeToPlan(uid, setState);
  }, [uid]);
  return state;
}
