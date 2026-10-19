/**
 * Décision de message d'échec d'import côté client, isolée du chemin réseau pour
 * rester pure et testable.
 *
 * Motif : sur mobile (WebView suspendue) ou dans un onglet passé en arrière-plan,
 * l'OS peut interrompre l'appel réseau d'un import un peu long. La promesse du
 * callable rejette alors, alors qu'il ne s'agit PAS d'un vrai échec serveur. On
 * remonte dans ce cas un message d'INTERRUPTION clair (rester sur l'écran, réessayer)
 * plutôt qu'une erreur technique alarmante.
 *
 * @module recipes/importInterruption
 */

/** Message présenté quand l'import a été interrompu par un passage en arrière-plan. */
export const IMPORT_INTERRUPTED: { code: string; message: string } = {
  code: "cancelled",
  message: "L'import a été interrompu parce que Cardamome est passé en arrière-plan. Réessaie en gardant l'écran ouvert : si l'extraction avait déjà abouti, elle te sera rendue sans re-consommer de crédit.",
};

/**
 * Choisit le message/code à afficher pour un échec d'import.
 *
 * @param err - L'erreur remontée, de forme non garantie (`catch`) : `message` et
 *   `code` ne sont repris que s'ils sont des chaînes non vides.
 * @param wentBackground - `true` si la page a été masquée pendant l'import (onglet
 *   quitté, app mobile mise en arrière-plan) : l'échec est alors traité comme une
 *   interruption plutôt que comme une panne serveur.
 * @returns `{ message, code }` prêt à afficher.
 */
export function importFailureFor(err: unknown, wentBackground: boolean): { message: string; code: string } {
  if (wentBackground) return { ...IMPORT_INTERRUPTED };
  const source = err && typeof err === "object" ? err : {};
  const message = "message" in source && typeof source.message === "string" ? source.message : "";
  const code = "code" in source && typeof source.code === "string" ? source.code : "";
  return { message: message || "Import impossible.", code: code || "internal" };
}
