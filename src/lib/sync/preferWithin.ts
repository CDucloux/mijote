/**
 * Course « source fraîche dans le budget, sinon repli local », utilisée au
 * démarrage : la lecture serveur est préférée si elle répond à temps ; passé le
 * budget (réseau absent ou qui ne répond pas), on sert le cache local au lieu de
 * laisser l'écran de chargement attendre le délai du SDK. Logique pure, sans I/O.
 *
 * @module sync/preferWithin
 */

/** Résultat de {@link preferWithin} : la valeur retenue et sa provenance. */
export interface PreferResult<T> {
  value: T;
  source: "primary" | "fallback";
}

/**
 * Attend `primary` au plus `budgetMs`. Au-delà, ou si `primary` échoue avant, sert
 * `fallback()` s'il a une valeur (`null` = rien d'exploitable). Sans repli, on
 * retombe sur `primary` (attente ou erreur d'origine) : jamais de donnée inventée.
 * Un budget nul ou négatif interroge le repli tout de suite (hors ligne déclaré).
 *
 * @param primary - Lecture préférée, déjà lancée (ex. serveur).
 * @param fallback - Lecture de repli, appelée au plus une fois (ex. cache local).
 * @param budgetMs - Temps accordé à `primary` avant de se rabattre.
 * @returns La valeur retenue et sa source.
 * @throws L'erreur de `primary` si le repli n'a rien et que `primary` échoue.
 */
export async function preferWithin<T>(primary: Promise<T>, fallback: () => Promise<T | null>, budgetMs: number): Promise<PreferResult<T>> {
  // Le primaire peut perdre la course puis échouer : on évite un rejet non géré.
  primary.catch(() => { });
  const tryFallback = async (): Promise<T | null> => {
    try { return await fallback(); } catch { return null; }
  };
  if (budgetMs <= 0) {
    const local = await tryFallback();
    return local !== null ? { value: local, source: "fallback" } : { value: await primary, source: "primary" };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<"expired">(resolve => { timer = setTimeout(() => resolve("expired"), budgetMs); });
  const settled = primary.then(
    value => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  const first = await Promise.race([settled, expired]);
  clearTimeout(timer);
  if (first !== "expired" && first.ok) return { value: first.value, source: "primary" };
  const local = await tryFallback();
  if (local !== null) return { value: local, source: "fallback" };
  return { value: await primary, source: "primary" };
}

/** Temps accordé au serveur au démarrage avant de servir le cache local. */
export const BOOT_SERVER_BUDGET_MS = 1200;

/**
 * Budget de lecture serveur au démarrage. Hors ligne déclaré, inutile d'attendre :
 * on lit le cache tout de suite. Sinon, le serveur a {@link BOOT_SERVER_BUDGET_MS}
 * (réseau présent mais muet : Wi-Fi sans internet, signal faible).
 *
 * @param online - `navigator.onLine` au moment du démarrage.
 * @returns Le budget en millisecondes.
 */
export function bootReadBudget(online: boolean): number {
  return online ? BOOT_SERVER_BUDGET_MS : 0;
}
