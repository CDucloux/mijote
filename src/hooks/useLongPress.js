import { useRef, useCallback } from "react";

// Appui long → menu contextuel, sans entrer en conflit avec le scroll /
// pull-to-refresh : on mémorise le point de départ et on annule dès que le doigt
// bouge (> 10 px). `fired` permet au `onClick` qui suit de s'auto-annuler après
// un appui long (sinon le relâchement déclenche aussi le clic).
//
// Câblage : onPointerDown={(e) => startLongPress(e, onFire)}, onPointerMove=
// {moveLongPress}, onPointerUp/Leave/Cancel={cancelLongPress} ; dans le onClick,
// `if (wasLongPress()) return;` (consomme le flag pour annuler le clic qui suit).
export function useLongPress(delay = 480) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const startLongPress = useCallback((e, onFire) => {
    fired.current = false;
    start.current = e ? { x: e.clientX, y: e.clientY } : null;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { fired.current = true; start.current = null; onFire(); }, delay);
  }, [delay]);

  const cancelLongPress = useCallback(() => { clearTimeout(timer.current); start.current = null; }, []);

  const moveLongPress = useCallback((e) => {
    const s = start.current;
    if (s && (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10)) { clearTimeout(timer.current); start.current = null; }
  }, []);

  // À appeler en tête du onClick : true si un appui long vient de se déclencher
  // (auquel cas on ignore le clic), et remet le flag à zéro.
  const wasLongPress = useCallback(() => {
    if (fired.current) { fired.current = false; return true; }
    return false;
  }, []);

  return { startLongPress, cancelLongPress, moveLongPress, wasLongPress };
}
