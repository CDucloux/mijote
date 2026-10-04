import { useCallback, useMemo, useRef, useState } from "react";
import { getRuntimeContext } from "@/lib/ui/runtimeContext.js";
import { shouldAnimateDismiss, DETAIL_DISMISS_MS } from "@/lib/ui/screenTransition.js";

/** Entrées du hook : la fiche est-elle affichée, et en disposition desktop ? */
export interface DetailDismissInput {
  onDetail: boolean;
  isDesktop: boolean;
}

/**
 * Sortie animée de la fiche recette (ressenti « app native » sur Capacitor mobile) :
 * la fiche reste montée le temps du glissement et la navigation n'a lieu qu'à la fin.
 *
 * @param input - Signaux d'affichage courants.
 * @returns `dismissing` (classe à poser), `dismissDetail(doNavigate)` qui enrobe un
 * retour, et `finishDismiss` à brancher sur `animationend`.
 */
export function useDetailDismiss({ onDetail, isDesktop }: DetailDismissInput) {
  const runtimeCtx = useMemo(() => getRuntimeContext(), []);
  const [dismissing, setDismissing] = useState(false);
  const navRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Consommée UNE seule fois : `animationend` et le filet de sécurité peuvent tous deux tirer.
  const finishDismiss = useCallback(() => {
    const go = navRef.current;
    if (!go) return;
    navRef.current = null;
    clearTimeout(timerRef.current);
    setDismissing(false);
    go();
  }, []);

  const dismissDetail = useCallback((doNavigate: () => void) => {
    if (dismissing) return;
    const reducedMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!shouldAnimateDismiss({ ctx: runtimeCtx, isDesktop, onDetail, reducedMotion })) { doNavigate(); return; }
    navRef.current = doNavigate;
    timerRef.current = setTimeout(finishDismiss, DETAIL_DISMISS_MS + 80);
    setDismissing(true);
  }, [dismissing, runtimeCtx, isDesktop, onDetail, finishDismiss]);

  return { dismissing, dismissDetail, finishDismiss };
}
