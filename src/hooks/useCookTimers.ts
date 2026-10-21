import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import { startTimer, hasElapsed, markDone, pauseTimer, resumeTimer, resetTimer as resetTimerState, hasActiveDuration, type CookTimer } from "@/lib/planning/cookTimers.js";
import { mergeSharedTimers } from "@/lib/cookSession/sharedTimers.js";
import { ensureTimerNotificationPermission, scheduleTimerNotification, cancelTimerNotification, deriveNotifId } from "@/lib/notifications/localNotifications.js";

/** Durée candidate d'un minuteur (préréglage d'étape). */
export interface TimerDuration {
  minutes: number;
  label: string;
}

/** Minuteurs communs d'une session à deux (cf. `useCookTogether`). */
export interface SharedCookTimers {
  /** Minuteurs lus dans la session, ou null hors session. */
  timers: CookTimer[] | null;
  save: (timer: CookTimer) => void;
  drop: (id: string) => void;
}

/** État et actions exposés par {@link useCookTimers}. */
export interface UseCookTimersResult {
  timers: CookTimer[];
  timersOpen: boolean;
  setTimersOpen: Dispatch<SetStateAction<boolean>>;
  now: number;
  addTimer: (duration: TimerDuration, stepIdx: number, stepLabel: string) => void;
  toggleTimer: (id: string) => void;
  restartTimer: (id: string) => void;
  removeTimer: (id: string) => void;
}

// Sonnerie de fin de minuteur : vibration + trois bips synthétisés (Web Audio).
// Isolée ici car impérative (effets de bord matériels), no-op si l'API manque.
function playAlarm(): void {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [0, 0.28, 0.56].forEach(off => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.value = 880;
      const s = ctx.currentTime + off;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.3, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
      o.start(s); o.stop(s + 0.22);
    });
    setTimeout(() => ctx.close?.(), 1200);
  } catch { /* audio indisponible */ }
}

/**
 * Orchestration des minuteurs de cuisson : état des minuteurs, horloge d'affichage,
 * planification/annulation des notifications OS, battement d'horloge (recalé au retour
 * au premier plan) et alarme à l'échéance. Les minuteurs sont horodatés (cf.
 * `cookTimers`), donc le restant reste juste après un passage en arrière-plan.
 *
 * À deux, les minuteurs sont communs : chaque action est publiée dans la session et
 * la liste se recale sur celle-ci (arrêter un minuteur l'arrête chez l'autre). Les
 * notifications OS se déduisent de l'état, quelle que soit l'origine du changement.
 *
 * @param notify - Callback de notification in-app (toast), appelé à l'échéance.
 * @param shared - Minuteurs de la session à deux, absent en solo.
 * @returns L'état (`timers`, `now`, `timersOpen`) et les actions (`addTimer`,
 *   `toggleTimer`, `restartTimer`, `removeTimer`, `setTimersOpen`).
 */
export function useCookTimers(notify?: (message: string) => void, shared?: SharedCookTimers): UseCookTimersResult {
  const [timers, setTimers] = useState<CookTimer[]>([]);
  const [timersOpen, setTimersOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef(new Set<string>());
  const permAskedRef = useRef(false);

  const armedRef = useRef(new Map<string, number>());
  const seenRef = useRef(new Set<string>());
  // Dernières valeurs lues par le recalage sur la session, sans le relancer.
  const timersRef = useRef(timers);
  const sharedRef = useRef(shared);
  useEffect(() => { timersRef.current = timers; sharedRef.current = shared; });

  const timerNotifBody = (t: CookTimer): string => `${t.label}${t.stepLabel ? `, ${t.stepLabel.toLowerCase()}` : ""}`;
  const armNotif = async (t: CookTimer, at: number): Promise<void> => {
    // Permission demandée à la volée au premier minuteur (Android 13+), avant de planifier.
    if (!permAskedRef.current) { permAskedRef.current = true; await ensureTimerNotificationPermission(); }
    scheduleTimerNotification({ notifId: deriveNotifId(t.id), title: "Minuteur terminé", body: timerNotifBody(t), at: new Date(at) });
  };

  // Applique un minuteur modifié localement et le publie à deux.
  const commit = (t: CookTimer): void => {
    setTimers(prev => prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [...prev, t]);
    sharedRef.current?.save(t);
  };

  // Ajoute un minuteur pour la durée `duration`, rattaché à l'étape (`stepIdx`/`stepLabel`)
  // depuis laquelle il est lancé. Sans effet si un minuteur identique tourne déjà (lancé
  // ici ou par l'autre membre) : la pile se déplie pour le montrer.
  const addTimer = (d: TimerDuration, stepIdx: number, stepLabel: string): void => {
    setTimersOpen(true);
    if (hasActiveDuration(timers, d.minutes)) return;
    const clock = Date.now();
    commit(startTimer({ minutes: d.minutes, label: d.label, stepIdx, stepLabel }, clock));
    setNow(clock); // recale l'horloge d'affichage sur le même instant que l'échéance, sinon le restant part faux d'un `now` gelé (voir battement)
  };
  const toggleTimer = (id: string): void => {
    const t = timers.find(x => x.id === id);
    if (!t || t.done) return;
    const clock = Date.now();
    commit(t.running ? pauseTimer(t, clock) : resumeTimer(t, clock));
    setNow(clock);
  };
  const restartTimer = (id: string): void => {
    const t = timers.find(x => x.id === id);
    if (!t) return;
    const clock = Date.now();
    commit(resetTimerState(t, clock));
    setNow(clock);
  };
  const removeTimer = (id: string): void => {
    setTimers(prev => prev.filter(x => x.id !== id));
    sharedRef.current?.drop(id);
  };

  // À deux : recalage sur les minuteurs de la session à chaque changement distant.
  const sharedTimers = shared?.timers ?? null;
  useEffect(() => {
    if (!sharedTimers) return;
    const { timers: next, pending } = mergeSharedTimers(timersRef.current, sharedTimers, seenRef.current, Date.now());
    for (const t of sharedTimers) seenRef.current.add(t.id);
    setTimers(next);
    for (const t of pending) sharedRef.current?.save(t);
  }, [sharedTimers]);

  // Notifications OS déduites de l'état : une par minuteur en marche, replanifiée si
  // son échéance bouge, annulée en pause, à l'arrêt ou à l'échéance (l'alarme premier
  // plan prend alors le relais, sans bannière redondante).
  useEffect(() => {
    const live = new Map<string, number>();
    for (const t of timers) if (t.running && !t.done && t.endAt != null) live.set(t.id, t.endAt);
    for (const [id, at] of armedRef.current) {
      if (live.get(id) === at) continue;
      armedRef.current.delete(id);
      cancelTimerNotification(deriveNotifId(id));
    }
    for (const t of timers) {
      const at = live.get(t.id);
      if (at == null || armedRef.current.has(t.id)) continue;
      armedRef.current.set(t.id, at);
      armNotif(t, at);
    }
  });

  // Battement d'horloge tant qu'un minuteur tourne : on avance `now` (le restant
  // s'en dérive) et on bascule à « terminé » les échéances dépassées. Un recalage
  // immédiat au retour au premier plan rattrape ce qui a expiré en arrière-plan,
  // où les timers JS sont gelés par l'OS.
  useEffect(() => {
    if (!timers.some(t => t.running && !t.done)) return;
    const sync = () => {
      const n = Date.now();
      setNow(n);
      setTimers(prev => {
        let changed = false;
        const next = prev.map(t => { if (hasElapsed(t, n)) { changed = true; return markDone(t); } return t; });
        return changed ? next : prev;
      });
    };
    const iv = setInterval(sync, 1000);
    const onWake = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onWake); window.removeEventListener("focus", onWake); };
  }, [timers]);

  // Alarme quand un minuteur se termine (une seule fois, compatible StrictMode). Un
  // minuteur relancé (ici ou par l'autre membre) pourra sonner de nouveau.
  useEffect(() => {
    for (const t of timers) {
      if (!t.done) { notifiedRef.current.delete(t.id); continue; }
      if (notifiedRef.current.has(t.id)) continue;
      notifiedRef.current.add(t.id);
      playAlarm();
      notify?.(`Minuteur terminé, ${t.label}`);
    }
  }, [timers, notify]);

  return { timers, timersOpen, setTimersOpen, now, addTimer, toggleTimer, restartTimer, removeTimer };
}
