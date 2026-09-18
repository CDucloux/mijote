/**
 * Façade du plugin natif `CookSession` : pilote la barre de notification ongoing
 * du cook mode (afficher / mettre à jour / retirer) et relaie les taps sur ses
 * boutons vers le JS.
 *
 * Tout est **no-op hors coquille native** (navigateur, PWA) : la barre n'existe
 * que dans l'app Android. La décision de plateforme s'appuie sur
 * `Capacitor.isNativePlatform()`, comme `notifications/localNotifications`.
 *
 * @module cookSession/plugin
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { CookSessionSnapshot } from "./snapshot";

/** Action émise par un bouton de la barre de notification. */
export type CookAction = "next" | "prev" | "toggleTimer" | "stop";

/** Charge utile de l'événement `cookAction`. */
export interface CookActionEvent {
  /** Bouton actionné dans la notification. */
  action: CookAction;
}

/** Interface exposée par l'implémentation native (`CookSessionPlugin.java`). */
export interface CookSessionPlugin {
  /** Poste la barre de notification pour une nouvelle session. */
  start(options: CookSessionSnapshot): Promise<void>;
  /** Met à jour la barre existante (changement d'étape ou de minuteur). */
  update(options: CookSessionSnapshot): Promise<void>;
  /** Retire la barre (fin de session, fermeture du cook mode). */
  stop(): Promise<void>;
  /** Abonne un handler aux taps de boutons. */
  addListener(
    eventName: "cookAction",
    listenerFunc: (event: CookActionEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const CookSession = registerPlugin<CookSessionPlugin>("CookSession");

/** Exécution dans la coquille native (Capacitor) où la barre native existe. */
function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Poste la barre de notification pour une session de cuisine. No-op hors natif.
 * Les échecs (plugin absent, permission refusée) sont avalés : la barre est un
 * confort, jamais un chemin critique.
 *
 * @param snapshot - État initial de la session.
 */
export async function startCookBar(snapshot: CookSessionSnapshot): Promise<void> {
  if (!isNative()) return;
  try {
    await CookSession.start(snapshot);
  } catch {
    /* barre indisponible : le cook mode reste pleinement utilisable sans elle */
  }
}

/**
 * Met à jour la barre existante avec un nouvel état. No-op hors natif.
 *
 * @param snapshot - Nouvel état de la session.
 */
export async function updateCookBar(snapshot: CookSessionSnapshot): Promise<void> {
  if (!isNative()) return;
  try {
    await CookSession.update(snapshot);
  } catch {
    /* mise à jour sans effet : l'ancien état reste affiché */
  }
}

/** Retire la barre de notification. No-op hors natif. Idempotent. */
export async function stopCookBar(): Promise<void> {
  if (!isNative()) return;
  try {
    await CookSession.stop();
  } catch {
    /* rien à retirer */
  }
}

/**
 * Abonne un handler aux taps de boutons de la barre. Renvoie une fonction de
 * désabonnement (no-op hors natif) à appeler au démontage.
 *
 * @param handler - Reçoit l'action du bouton actionné.
 * @returns Fonction de nettoyage à invoquer pour se désabonner.
 */
export function onCookAction(handler: (action: CookAction) => void): () => void {
  if (!isNative()) return () => {};
  let handle: PluginListenerHandle | null = null;
  let cancelled = false;
  CookSession.addListener("cookAction", (e) => handler(e.action))
    .then((h) => {
      if (cancelled) { void h.remove(); return; }
      handle = h;
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    if (handle) void handle.remove();
  };
}
