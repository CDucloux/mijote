/**
 * Façade du plugin natif `Launcher` : pousse les raccourcis de l'icône et
 * l'instantané des widgets vers Android. No-op hors coquille native (la PWA n'a
 * ni l'un ni l'autre), et les échecs sont avalés : c'est un confort de lanceur,
 * jamais un chemin critique.
 *
 * @module launcher/plugin
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { LauncherShortcut } from "./shortcuts";
import type { WidgetSnapshot } from "./widgetSnapshot";

/** Charge utile d'une synchronisation du lanceur. */
export interface LauncherSync {
  shortcuts: LauncherShortcut[];
  widget: WidgetSnapshot;
}

/** Interface exposée par l'implémentation native (`LauncherPlugin.java`). */
interface LauncherPlugin {
  /** Remplace les raccourcis dynamiques et redessine les widgets posés. */
  sync(options: LauncherSync): Promise<void>;
}

const Launcher = registerPlugin<LauncherPlugin>("Launcher");

/**
 * Synchronise raccourcis et widgets avec l'état courant. No-op hors natif.
 *
 * @param payload - Raccourcis et instantané des widgets.
 */
export async function syncLauncher(payload: LauncherSync): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Launcher.sync(payload);
  } catch {
    /* lanceur indisponible : l'app reste pleinement utilisable */
  }
}
