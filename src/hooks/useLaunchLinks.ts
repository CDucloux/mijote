import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { launchPath } from "@/lib/launcher/deepLink.js";

// Le lien de lancement reste lisible tant que l'activité vit : sans ce verrou, un
// remontage de l'app (déconnexion puis reconnexion) le rejouerait.
let launchConsumed = false;

/**
 * Ouvre l'écran visé par un raccourci d'icône ou un widget Android : au
 * démarrage à froid (`getLaunchUrl`) comme app déjà ouverte (`appUrlOpen`).
 *
 * Inerte hors plateforme native. À monter une seule fois, sous le routeur et
 * derrière l'authentification (un lien n'a de sens qu'une fois connecté).
 */
export function useLaunchLinks(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const open = (url: string | undefined) => {
      const path = launchPath(url);
      if (path) navigate(path);
    };
    if (!launchConsumed) {
      launchConsumed = true;
      CapacitorApp.getLaunchUrl().then((res) => open(res?.url)).catch(() => {});
    }
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    CapacitorApp.addListener("appUrlOpen", (event) => open(event.url))
      .then((h) => { if (cancelled) void h.remove(); else handle = h; });
    return () => { cancelled = true; void handle?.remove(); };
  }, [navigate]);
}
