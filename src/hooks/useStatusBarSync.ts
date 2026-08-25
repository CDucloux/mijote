/**
 * Maintient la barre système alignée sur le thème de l'app à trois moments : au
 * démarrage (montage), à chaque changement de thème (dépendance `isDark`), et à la
 * reprise de l'app après un passage en arrière-plan, où l'OS peut avoir réinitialisé
 * la barre. La reprise est captée via `visibilitychange` (web/PWA) et l'évènement
 * `resume` de `@capacitor/app` (natif, déjà dans les dépendances).
 *
 * @module useStatusBarSync
 */
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { applyStatusBarTheme } from "@/lib/ui/statusBarTheme.js";

/**
 * Synchronise la barre système avec le thème et la resynchronise à la reprise.
 *
 * @param isDark - Thème sombre actif ?
 */
export function useStatusBarSync(isDark: boolean): void {
  useEffect(() => {
    applyStatusBarTheme(isDark);

    const onVisible = (): void => {
      if (document.visibilityState === "visible") applyStatusBarTheme(isDark);
    };
    document.addEventListener("visibilitychange", onVisible);

    // Reprise native (Capacitor) : l'écouteur est asynchrone à poser ; on garde une
    // référence pour le retirer proprement, même si le montage/démontage se croisent.
    let removeResume: (() => void) | undefined;
    let cancelled = false;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", (state) => {
            if (state.isActive) applyStatusBarTheme(isDark);
          }),
        )
        .then((handle) => {
          if (cancelled) handle.remove();
          else removeResume = () => handle.remove();
        })
        .catch(() => { /* plugin App indisponible : la meta suffit */ });
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      removeResume?.();
    };
  }, [isDark]);
}
