import { useMemo, useRef } from "react";
import type { AppShell } from "../context/AppShellContext.jsx";

/** Fonctions du shell, relayées à identité stable. */
export type ShellApi = Pick<AppShell,
  "signOut" | "toggleTheme" | "getSharedData" | "loadDirectory" | "importFromUrl" | "importFromImages"
  | "importFromText" | "importFromPdf" | "importGift" | "logActivity">;

/** Valeurs du shell (tout sauf les fonctions relayées). */
export type ShellState = Omit<AppShell, keyof ShellApi>;

/**
 * Valeur du contexte App Shell À IDENTITÉ STABLE : sans ça, tous les consommateurs
 * `useAppShell` (pages, cartes, sections) re-rendraient à chaque rendu d'App, même
 * pour un simple toast. Les fonctions passent par une ref (toujours la dernière
 * closure, jamais périmée) et l'objet ne change que si une VRAIE valeur change.
 *
 * @param state - Valeurs du shell (utilisateur, foyer, thème, abonnement…).
 * @param api - Dernières closures des fonctions du shell.
 */
export function useAppShellValue(state: ShellState, api: ShellApi): AppShell {
  const apiRef = useRef(api);
  // Écriture pendant le rendu voulue (motif « latest ref ») : idempotente, et ces
  // fonctions ne sont appelées que sur action utilisateur, jamais au rendu.
  // eslint-disable-next-line react-hooks/refs
  apiRef.current = api;
  const stableApi = useMemo<ShellApi>(() => ({
    signOut: () => apiRef.current.signOut(),
    toggleTheme: () => apiRef.current.toggleTheme(),
    getSharedData: () => apiRef.current.getSharedData(),
    loadDirectory: () => apiRef.current.loadDirectory(),
    importFromUrl: (url) => apiRef.current.importFromUrl(url),
    importFromImages: (images) => apiRef.current.importFromImages(images),
    importFromText: (text) => apiRef.current.importFromText(text),
    importFromPdf: (text) => apiRef.current.importFromPdf(text),
    importGift: () => apiRef.current.importGift(),
    logActivity: (input) => apiRef.current.logActivity(input),
  }), []);
  const { user, householdId, syncStatus, isDark, notify, techniques, sources, directory, isAdmin, isPlus, subscription, giftImportUsed, markGiftImportUsed } = state;
  return useMemo(
    () => ({ user, householdId, syncStatus, isDark, notify, techniques, sources, directory, isAdmin, isPlus, subscription, giftImportUsed, markGiftImportUsed, ...stableApi }),
    [user, householdId, syncStatus, isDark, notify, techniques, sources, directory, isAdmin, isPlus, subscription, giftImportUsed, markGiftImportUsed, stableApi],
  );
}
