/**
 * Synchronisation de la barre système (statut) avec le thème de l'app.
 *
 * Sur le web / en PWA, la couleur de la barre suit la meta `theme-color`. Dans la
 * coquille Capacitor, si (et seulement si) le plugin `@capacitor/status-bar` est
 * présent au runtime, on l'appelle aussi : l'accès passe par `window.Capacitor.Plugins`
 * (pas d'import statique) pour NE PAS ajouter de dépendance de build ; le code reste
 * un no-op tant que le plugin n'est pas installé.
 *
 * La couleur (`barColorFor`) est pure et testable ; `applyStatusBarTheme` est la glue
 * DOM/plugin.
 *
 * @module statusBarTheme
 */

/** Couleurs de fond du thème, calées sur celles posées au boot (`index.html`). */
export const BAR_COLOR = { dark: "#0f110d", light: "#f3f4ec" } as const;

/**
 * Couleur de barre système pour le thème donné.
 *
 * @param isDark - Thème sombre actif ?
 * @returns La couleur `#rrggbb` correspondante.
 */
export function barColorFor(isDark: boolean): string {
  return isDark ? BAR_COLOR.dark : BAR_COLOR.light;
}

/** Type minimal du plugin StatusBar, accédé dynamiquement s'il est présent. */
interface CapacitorBridge {
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: {
    StatusBar?: {
      setStyle?: (opts: { style: "DARK" | "LIGHT" }) => unknown;
      setBackgroundColor?: (opts: { color: string }) => unknown;
    };
  };
}

/**
 * Aligne la barre système sur le thème : meta `theme-color` (web/PWA) et, si le plugin
 * natif est disponible, style + couleur de la StatusBar Capacitor. Sans effet hors DOM.
 *
 * @param isDark - Thème sombre actif ?
 */
export function applyStatusBarTheme(isDark: boolean): void {
  if (typeof document === "undefined") return;
  const color = barColorFor(isDark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", color);

  const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  const bar = cap?.isPluginAvailable?.("StatusBar") ? cap.Plugins?.StatusBar : undefined;
  if (!bar) return;
  try {
    // Le contenu de la barre (heure, icônes) doit CONTRASTER avec le fond : texte
    // clair sur thème sombre, texte sombre sur thème clair.
    bar.setStyle?.({ style: isDark ? "DARK" : "LIGHT" });
    bar.setBackgroundColor?.({ color });
  } catch { /* plugin indisponible ou plateforme non gérée : no-op */ }
}
