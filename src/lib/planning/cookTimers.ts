/**
 * Machine à états pure des minuteurs du cook mode.
 *
 * Le temps restant n'est jamais décrémenté « à la main » tick par tick : un
 * minuteur en marche porte une échéance absolue (`endAt`, ms epoch) et le restant
 * se dérive de `Date.now()`. C'est ce qui le rend juste après un passage en
 * arrière-plan (les `setInterval` sont gelés / throttlés par l'OS) : au retour,
 * l'affichage se recale seul et un minuteur échu pendant l'absence est détecté.
 *
 * Toutes les fonctions sont pures (aucune I/O, `now` injecté) : la planification
 * de la notification OS (son écran verrouillé) vit dans `notifications/`.
 *
 * @module cookTimers
 */

/** Un minuteur du cook mode, rattaché à l'étape d'où il a été lancé. */
export interface CookTimer {
  /** Identifiant unique et stable (sert de clé React et de graine de notif). */
  id: string;
  /** Libellé de durée affiché, ex. `"6 min"` ou `"1 h 30"`. */
  label: string;
  /** Durée totale en secondes (pour la barre de progression). */
  totalSec: number;
  /** En marche (décompte actif) vs en pause. */
  running: boolean;
  /** Échéance absolue en ms epoch quand `running` ; `null` en pause. */
  endAt: number | null;
  /** Restant figé en ms quand en pause (source de vérité hors marche). */
  remainingMs: number;
  /** Le minuteur a atteint zéro (alarme jouée). */
  done: boolean;
  /** Index de page cook mode d'où le minuteur a été lancé (navigation). */
  stepIdx: number;
  /** Libellé de l'étape source, ex. `"Étape 3"` ou `"Mise en place"`. */
  stepLabel: string;
}

/** Paramètres de création d'un minuteur. */
export interface CookTimerInit {
  /** Durée en minutes (> 0). */
  minutes: number;
  /** Libellé de durée affiché. */
  label: string;
  /** Index de page cook mode d'où il est lancé. */
  stepIdx: number;
  /** Libellé de l'étape source. */
  stepLabel: string;
}

/**
 * Crée un minuteur en marche dont l'échéance est `now + minutes`.
 *
 * @param init - Durée, libellé et étape source.
 * @param now - Horodatage courant en ms (injecté pour la testabilité).
 * @returns Un `CookTimer` neuf, en marche, non terminé.
 */
export function startTimer(init: CookTimerInit, now: number): CookTimer {
  const totalSec = Math.round(init.minutes * 60);
  const durationMs = totalSec * 1000;
  return {
    id: `${init.minutes}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    label: init.label,
    totalSec,
    running: true,
    endAt: now + durationMs,
    remainingMs: durationMs,
    done: false,
    stepIdx: init.stepIdx,
    stepLabel: init.stepLabel,
  };
}

/**
 * Restant en secondes, dérivé de l'échéance quand le minuteur tourne. Jamais
 * négatif. Arrondi au plafond pour qu'on voie « 6:00 » et non « 5:59 » à l'instant
 * du lancement.
 *
 * @param t - Le minuteur.
 * @param now - Horodatage courant en ms.
 */
export function remainingSecs(t: CookTimer, now: number): number {
  const ms = t.running && t.endAt != null ? t.endAt - now : t.remainingMs;
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * Le minuteur tourne-t-il encore mais son échéance est-elle déjà passée ? Vrai
 * uniquement pour un minuteur en marche, non déjà marqué terminé, dont le restant
 * est nul (typiquement détecté au retour d'arrière-plan).
 *
 * @param t - Le minuteur.
 * @param now - Horodatage courant en ms.
 */
export function hasElapsed(t: CookTimer, now: number): boolean {
  return t.running && !t.done && t.endAt != null && t.endAt <= now;
}

/**
 * Marque un minuteur comme terminé (décompte figé à zéro, plus en marche).
 * Idempotent.
 *
 * @param t - Le minuteur.
 */
export function markDone(t: CookTimer): CookTimer {
  if (t.done) return t;
  return { ...t, running: false, endAt: null, remainingMs: 0, done: true };
}

/**
 * Met en pause : fige le restant courant et coupe l'échéance. Sans effet sur un
 * minuteur déjà en pause ou terminé.
 *
 * @param t - Le minuteur.
 * @param now - Horodatage courant en ms.
 */
export function pauseTimer(t: CookTimer, now: number): CookTimer {
  if (!t.running || t.done) return t;
  const remainingMs = Math.max(0, (t.endAt ?? now) - now);
  return { ...t, running: false, endAt: null, remainingMs };
}

/**
 * Reprend un minuteur en pause : recale l'échéance sur `now + restant`. Sans effet
 * sur un minuteur déjà en marche ou terminé.
 *
 * @param t - Le minuteur.
 * @param now - Horodatage courant en ms.
 */
export function resumeTimer(t: CookTimer, now: number): CookTimer {
  if (t.running || t.done) return t;
  return { ...t, running: true, endAt: now + t.remainingMs };
}

/**
 * Relance un minuteur terminé (ou en cours) depuis sa durée totale.
 *
 * @param t - Le minuteur.
 * @param now - Horodatage courant en ms.
 */
export function resetTimer(t: CookTimer, now: number): CookTimer {
  const durationMs = t.totalSec * 1000;
  return { ...t, running: true, endAt: now + durationMs, remainingMs: durationMs, done: false };
}

/**
 * Existe-t-il déjà un minuteur ACTIF (en marche, non terminé) de cette durée ?
 * Sert à éviter d'empiler deux fois le même minuteur d'un tap répété, tout en
 * autorisant un nouveau minuteur une fois l'ancien terminé ou mis en pause.
 *
 * @param timers - Les minuteurs courants.
 * @param minutes - Durée candidate en minutes.
 */
export function hasActiveDuration(timers: readonly CookTimer[], minutes: number): boolean {
  const totalSec = Math.round(minutes * 60);
  return timers.some(t => t.totalSec === totalSec && t.running && !t.done);
}
