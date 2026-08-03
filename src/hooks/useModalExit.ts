import { useState, useRef, useEffect, useCallback, type AnimationEvent as ReactAnimationEvent } from "react";

/**
 * Animation de SORTIE des fenêtres modales. Sans ça, un modal piloté par un état
 * parent (`{cond && <Modal/>}`) se démonte d'un coup. Ici on passe d'abord en état
 * `closing` (classe `.is-closing` → keyframe de sortie) puis on appelle la vraie
 * fermeture à la fin de l'animation, ce qui laisse le temps à la sortie de jouer.
 *
 * `beginClose(cb?)` déclenche la sortie ; `cb` permet de router une action précise
 * (ex. « Annuler » vs « Réessayer ») une fois l'animation terminée, sinon on retombe
 * sur `onClose`. `onAnimationEnd` doit être posé sur l'élément animé (via `surfaceRef`) :
 * on ignore l'animation d'entrée et celles des enfants.
 *
 * @param onClose - Fermeture réelle, appelée à la fin de l'animation de sortie.
 * @param options - Réglages.
 * @param options.escape - Fermer sur la touche Échap (défaut `true`).
 * @param options.disabled - Désactive complètement le déclenchement de sortie.
 * @returns `{ closing, surfaceRef, beginClose, onAnimationEnd }`.
 */
export function useModalExit(onClose?: () => void, { escape = true, disabled = false }: { escape?: boolean; disabled?: boolean } = {}) {
  const [closing, setClosing] = useState(false);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const beginClose = useCallback((cb?: unknown): void => {
    if (disabled) return;
    pending.current = typeof cb === "function" ? (cb as () => void) : null;
    setClosing(true);
  }, [disabled]);

  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") beginClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escape, beginClose]);

  const onAnimationEnd = useCallback((e: ReactAnimationEvent): void => {
    if (!closing || e.target !== surfaceRef.current) return;
    const cb = pending.current || onClose;
    pending.current = null;
    setClosing(false); // réarme pour une éventuelle réouverture (modal resté monté)
    cb?.();
  }, [closing, onClose]);

  return { closing, surfaceRef, beginClose, onAnimationEnd };
}
