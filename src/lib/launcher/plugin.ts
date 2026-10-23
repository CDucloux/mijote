/**
 * Façade du plugin natif `Launcher` : pousse les raccourcis de l'icône et
 * l'instantané des widgets vers Android, relève les cases cochées sur le widget et
 * lit le lien copié (la WebView Android refuse `navigator.clipboard.readText`). No-op hors coquille native (la PWA n'a
 * ni l'un ni l'autre), et les échecs sont avalés : c'est un confort de lanceur,
 * jamais un chemin critique.
 *
 * @module launcher/plugin
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { LauncherShortcut } from "./shortcuts";
import type { WidgetSnapshot } from "./widgetSnapshot";
import { parseWidgetChecks, type WidgetCheck } from "./widgetChecks";
import { firstHttpUrl } from "./clipboardLink";

/** Charge utile d'une synchronisation du lanceur. */
export interface LauncherSync {
  shortcuts: LauncherShortcut[];
  widget: WidgetSnapshot;
}

/** Interface exposée par l'implémentation native (`LauncherPlugin.java`). */
interface LauncherPlugin {
  /** Remplace les raccourcis dynamiques et redessine les widgets posés. */
  sync(options: LauncherSync): Promise<void>;
  /** Rend puis oublie les bascules faites sur le widget « Courses ». */
  takeChecks(): Promise<unknown>;
  /** Texte du presse-papiers système (lisible tant que l'app est au premier plan). */
  clipboardText(): Promise<{ text?: unknown }>;
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

/**
 * Relève les articles cochés sur le widget depuis la dernière relève. Le natif
 * les oublie aussitôt rendus : à appliquer tout de suite. `[]` hors natif ou en
 * cas d'échec.
 *
 * @returns Les bascules validées, à passer à `applyWidgetChecks`.
 */
export async function takeWidgetChecks(): Promise<WidgetCheck[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    return parseWidgetChecks(await Launcher.takeChecks());
  } catch {
    return [];
  }
}

/**
 * Texte du presse-papiers : presse-papiers système en natif (lu directement, sans
 * la bulle « Coller » que la WebView impose à `navigator.clipboard.readText`),
 * API web ailleurs (le navigateur peut alors demander confirmation, c'est hors de
 * notre main). Ne lève jamais : un refus d'accès vaut « rien de copié ».
 *
 * @returns Le texte copié, `""` si vide, illisible ou refusé.
 */
export async function readClipboardText(): Promise<string> {
  try {
    const text = Capacitor.isNativePlatform()
      ? (await Launcher.clipboardText()).text
      : await navigator.clipboard?.readText?.();
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

/**
 * Lien copié dans le presse-papiers, s'il y en a un (cf. `readClipboardText`).
 *
 * @returns Le premier lien http(s) copié, ou `null`.
 */
export async function readClipboardLink(): Promise<string | null> {
  return firstHttpUrl(await readClipboardText());
}
