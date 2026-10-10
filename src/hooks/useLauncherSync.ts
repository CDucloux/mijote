import { useEffect, useMemo, useRef } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { buildShortcuts, type LauncherInput } from "@/lib/launcher/shortcuts.js";
import { buildWidgetSnapshot } from "@/lib/launcher/widgetSnapshot.js";
import { syncLauncher } from "@/lib/launcher/plugin.js";

/** Options de la synchronisation du lanceur. */
export interface LauncherSyncOptions extends Omit<LauncherInput, "date"> {
  /** Données du foyer chargées : avant, on pousserait un état vide trompeur. */
  ready: boolean;
}

/**
 * Tient à jour les raccourcis de l'icône et les widgets Android à partir du
 * planning et des courses. Ne pousse qu'au changement de contenu, et recalcule au
 * retour au premier plan (le « prochain repas » dépend de l'heure).
 *
 * Inerte hors plateforme native. À monter une seule fois, sous le routeur.
 *
 * @param options - Voir {@link LauncherSyncOptions}.
 */
export function useLauncherSync({ ready, mealPlan, recipes, shoppingLists, ingredientDB }: LauncherSyncOptions): void {
  const input = useMemo(() => ({ mealPlan, recipes, shoppingLists, ingredientDB }), [mealPlan, recipes, shoppingLists, ingredientDB]);
  const lastSent = useRef("");

  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return;
    const push = () => {
      const date = new Date();
      const payload = { shortcuts: buildShortcuts({ ...input, date }), widget: buildWidgetSnapshot({ ...input, date }) };
      const key = JSON.stringify(payload);
      if (key === lastSent.current) return;
      lastSent.current = key;
      void syncLauncher(payload);
    };
    push();
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    CapacitorApp.addListener("resume", push).then((h) => { if (cancelled) void h.remove(); else handle = h; });
    return () => { cancelled = true; void handle?.remove(); };
  }, [ready, input]);
}
