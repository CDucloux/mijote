import { useState, useRef, useEffect, useCallback } from "react";

// Animation de SORTIE des fenêtres modales. Sans ça, un modal piloté par un état
// parent (`{cond && <Modal/>}`) se démonte d'un coup. Ici on passe d'abord en état
// `closing` (classe `.is-closing` → keyframe de sortie) puis on appelle la vraie
// fermeture à la fin de l'animation, ce qui laisse le temps à la sortie de jouer.
//
// `beginClose(cb?)` déclenche la sortie ; `cb` permet de router une action précise
// (ex. « Annuler » vs « Réessayer ») une fois l'animation terminée, sinon on
// retombe sur `onClose`. `onAnimationEnd` doit être posé sur l'élément animé (via
// `surfaceRef`) : on ignore l'animation d'entrée et celles des enfants.
export function useModalExit(onClose, { escape = true, disabled = false } = {}) {
  const [closing, setClosing] = useState(false);
  const surfaceRef = useRef(null);
  const pending = useRef(null);

  const beginClose = useCallback((cb) => {
    if (disabled) return;
    pending.current = typeof cb === "function" ? cb : null;
    setClosing(true);
  }, [disabled]);

  useEffect(() => {
    if (!escape) return;
    const onKey = (e) => { if (e.key === "Escape") beginClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escape, beginClose]);

  const onAnimationEnd = useCallback((e) => {
    if (!closing || e.target !== surfaceRef.current) return;
    const cb = pending.current || onClose;
    pending.current = null;
    setClosing(false); // réarme pour une éventuelle réouverture (modal resté monté)
    cb?.();
  }, [closing, onClose]);

  return { closing, surfaceRef, beginClose, onAnimationEnd };
}
