/**
 * Fine couche au-dessus de `@capacitor/local-notifications` pour faire sonner les
 * minuteurs du cook mode **même écran verrouillé / app en arrière-plan** : on
 * planifie une notification OS à l'échéance du minuteur, que le système déclenche
 * indépendamment de l'état de la WebView (dont les timers JS sont gelés).
 *
 * Tout est **no-op hors coquille native** (navigateur, PWA) : le web garde son
 * alarme en premier plan (bip + vibration) gérée côté composant. La décision de
 * plateforme s'appuie sur `Capacitor.isNativePlatform()`.
 *
 * @module localNotifications
 */
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/** Paramètres de planification d'une notification de minuteur. */
export interface TimerNotification {
  /** Identifiant numérique stable de la notification (voir {@link deriveNotifId}). */
  notifId: number;
  /** Titre de la notification, ex. `"Minuteur terminé"`. */
  title: string;
  /** Corps, ex. `"6 min, étape 3"`. */
  body: string;
  /** Instant de déclenchement. */
  at: Date;
}

/**
 * Dérive un identifiant de notification (entier 31 bits positif, non nul) à partir
 * de l'identifiant textuel d'un minuteur. Android exige un `id` entier ; on hashe
 * la chaîne de façon déterministe pour pouvoir annuler la bonne notification plus
 * tard sans stocker de table de correspondance.
 *
 * @param timerId - Identifiant du minuteur (`CookTimer.id`).
 * @returns Un entier dans `[1, 2^31 - 1]`.
 */
export function deriveNotifId(timerId: string): number {
  let h = 2166136261;
  for (let i = 0; i < timerId.length; i++) {
    h ^= timerId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 ramène en non signé, puis on borne à 31 bits et on évite 0.
  return ((h >>> 0) % 2147483647) + 1;
}

/** Exécution dans la coquille native (Capacitor) où les notifs OS existent. */
function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * S'assure que la permission de notification est accordée (Android 13+ la demande
 * explicitement). No-op et `true` hors natif. À appeler une fois avant la première
 * planification.
 *
 * @returns `true` si les notifications peuvent être planifiées.
 */
export async function ensureTimerNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;
    if (status.display === "denied") return false;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Planifie la notification de fin d'un minuteur à l'instant `at`. No-op hors natif,
 * ou si `at` est déjà passé. Les échecs (permission refusée, plugin indisponible)
 * sont avalés : l'alarme premier plan reste le filet de sécurité.
 *
 * @param n - Description de la notification à planifier.
 */
export async function scheduleTimerNotification(n: TimerNotification): Promise<void> {
  if (!isNative() || n.at.getTime() <= Date.now()) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: n.notifId,
        title: n.title,
        body: n.body,
        // `allowWhileIdle` : déclenche même en Doze (écran éteint depuis longtemps).
        schedule: { at: n.at, allowWhileIdle: true },
      }],
    });
  } catch {
    /* notification indisponible : l'alarme premier plan prend le relais */
  }
}

/**
 * Annule la notification planifiée d'un minuteur (pause, stop, relance, reprise).
 * No-op hors natif. Idempotent : annuler une notification déjà déclenchée ou
 * inexistante ne fait rien.
 *
 * @param notifId - Identifiant numérique de la notification (cf. {@link deriveNotifId}).
 */
export async function cancelTimerNotification(notifId: number): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch {
    /* rien à annuler */
  }
}
