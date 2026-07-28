import { useState, useCallback } from "react";

// ─── NOTIFICATIONS (toasts) ───────────────────────────────────────────────────
// Petit état de toast + fonction `notify(msg, type)` à identité stable. Extrait
// d'App.jsx. Le rendu du toast reste dans App (il lit `notification`).
export function useNotifications() {
  const [notification, setNotification] = useState(null);
  const notify = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2800);
  }, []);
  return { notification, notify };
}
