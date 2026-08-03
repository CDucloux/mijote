import { useState, useCallback } from "react";

/** Toast affiché brièvement : message + type visuel. */
export interface Toast { msg: string; type: string }

/**
 * État de toast + fonction `notify(msg, type)` à identité stable. Extrait d'App.jsx.
 * Le rendu du toast reste dans App (il lit `notification`).
 *
 * @returns `{ notification, notify }` — l'état courant (ou `null`) et le déclencheur.
 */
export function useNotifications(): { notification: Toast | null; notify: (msg: string, type?: string) => void } {
  const [notification, setNotification] = useState<Toast | null>(null);
  const notify = useCallback((msg: string, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2800);
  }, []);
  return { notification, notify };
}
