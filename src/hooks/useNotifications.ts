import { useState, useCallback, useRef, useEffect } from "react";

/** Toast affiché brièvement : message + type visuel. */
export interface Toast { msg: string; type: string }

/** Durée d'affichage plein écran avant que la sortie ne s'amorce (ms). */
const VISIBLE_MS = 2800;
/** Durée de l'animation de sortie ; doit rester alignée sur les keyframes CSS (ms). */
const EXIT_MS = 240;

/**
 * État de toast + fonction `notify(msg, type)` à identité stable. Le toast reste monté
 * pendant sa sortie (`leaving`) pour laisser jouer l'animation (glissé vers le bas sur
 * mobile, standard des snackbars) avant d'être démonté. Le rendu vit dans App, qui lit
 * `notification` et `leaving`.
 *
 * @returns `{ notification, leaving, notify }`, l'état courant (ou `null`), le drapeau
 *   de sortie en cours, et le déclencheur.
 */
export function useNotifications(): { notification: Toast | null; leaving: boolean; notify: (msg: string, type?: string) => void } {
  const [notification, setNotification] = useState<Toast | null>(null);
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (dropTimer.current) clearTimeout(dropTimer.current);
  };

  const notify = useCallback((msg: string, type = "success") => {
    clearTimers();
    setLeaving(false);
    setNotification({ msg, type });
    // Après le temps d'affichage : on arme la sortie (animation), puis on démonte.
    exitTimer.current = setTimeout(() => {
      setLeaving(true);
      dropTimer.current = setTimeout(() => { setNotification(null); setLeaving(false); }, EXIT_MS);
    }, VISIBLE_MS);
  }, []);

  useEffect(() => clearTimers, []);

  return { notification, leaving, notify };
}
