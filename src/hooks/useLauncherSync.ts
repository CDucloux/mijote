import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { buildShortcuts, type LauncherInput } from "@/lib/launcher/shortcuts.js";
import { buildWidgetSnapshot } from "@/lib/launcher/widgetSnapshot.js";
import { syncLauncher, takeWidgetChecks } from "@/lib/launcher/plugin.js";
import { applyWidgetChecks } from "@/lib/launcher/widgetChecks.js";
import type { ShoppingList } from "@/lib/food/shoppingAggregate.js";

/** Options de la synchronisation du lanceur. */
export interface LauncherSyncOptions extends Omit<LauncherInput, "date"> {
  /** Données du foyer chargées : avant, on pousserait un état vide trompeur. */
  ready: boolean;
  /** Reçoit les articles cochés depuis le widget « Courses ». */
  setShoppingLists: Dispatch<SetStateAction<ShoppingList[]>>;
}

/**
 * Tient à jour les raccourcis de l'icône et les widgets Android à partir du
 * planning et des courses. Ne pousse qu'au changement de contenu, et recalcule au
 * retour au premier plan (le « prochain repas » dépend de l'heure). Au même moment,
 * relève les articles cochés sur le widget et les reporte dans les listes.
 *
 * Inerte hors plateforme native. À monter une seule fois, sous le routeur.
 *
 * @param options - Voir {@link LauncherSyncOptions}.
 */
export function useLauncherSync({ ready, mealPlan, recipes, shoppingLists, ingredientDB, setShoppingLists }: LauncherSyncOptions): void {
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

  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return;
    const collect = async () => {
      const checks = await takeWidgetChecks();
      if (checks.length) setShoppingLists(prev => applyWidgetChecks(prev, checks));
    };
    void collect();
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    CapacitorApp.addListener("resume", () => void collect()).then((h) => { if (cancelled) void h.remove(); else handle = h; });
    return () => { cancelled = true; void handle?.remove(); };
  }, [ready, setShoppingLists]);
}
