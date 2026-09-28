import { useState, useRef, useEffect } from "react";
import { startTimer, hasElapsed, markDone, pauseTimer, resumeTimer, resetTimer as resetTimerState, hasActiveDuration } from "@/lib/planning/cookTimers.js";
import { ensureTimerNotificationPermission, scheduleTimerNotification, cancelTimerNotification, deriveNotifId } from "@/lib/notifications/localNotifications.js";

// Sonnerie de fin de minuteur : vibration + trois bips synthétisés (Web Audio).
// Isolée ici car impérative (effets de bord matériels), no-op si l'API manque.
function playAlarm() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
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
 * @param notify - Callback de notification in-app (toast), appelé à l'échéance.
 * @returns L'état (`timers`, `now`, `timersOpen`) et les actions (`addTimer`,
 *   `toggleTimer`, `restartTimer`, `removeTimer`, `setTimersOpen`).
 */
export function useCookTimers(notify) {
  const [timers, setTimers] = useState([]);
  const [timersOpen, setTimersOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef(new Set());
  const permAskedRef = useRef(false);

  const timerNotifBody = (t) => `${t.label}${t.stepLabel ? `, ${t.stepLabel.toLowerCase()}` : ""}`;
  const armNotif = async (t) => {
    if (t.endAt == null) return;
    // Permission demandée à la volée au premier minuteur (Android 13+), avant de planifier.
    if (!permAskedRef.current) { permAskedRef.current = true; await ensureTimerNotificationPermission(); }
    scheduleTimerNotification({ notifId: deriveNotifId(t.id), title: "Minuteur terminé", body: timerNotifBody(t), at: new Date(t.endAt) });
  };
  const cancelNotif = (t) => cancelTimerNotification(deriveNotifId(t.id));

  // Ajoute un minuteur pour la durée `d`, rattaché à l'étape (`stepIdx`/`stepLabel`)
  // depuis laquelle il est lancé. Sans effet si un minuteur identique tourne déjà.
  const addTimer = (d, stepIdx, stepLabel) => {
    if (hasActiveDuration(timers, d.minutes)) return;
    const clock = Date.now();
    const t = startTimer({ minutes: d.minutes, label: d.label, stepIdx, stepLabel }, clock);
    setTimers(prev => hasActiveDuration(prev, d.minutes) ? prev : [...prev, t]);
    setNow(clock); // recale l'horloge d'affichage sur le même instant que l'échéance, sinon le restant part faux d'un `now` gelé (voir battement)
    setTimersOpen(true);
    armNotif(t);
  };
  const toggleTimer = (id) => {
    const t = timers.find(x => x.id === id);
    if (!t || t.done) return;
    const clock = Date.now();
    setTimers(prev => prev.map(x => x.id === id ? (x.running ? pauseTimer(x, clock) : resumeTimer(x, clock)) : x));
    setNow(clock);
    if (t.running) cancelNotif(t); else armNotif(resumeTimer(t, clock));
  };
  const restartTimer = (id) => {
    const t = timers.find(x => x.id === id);
    const clock = Date.now();
    notifiedRef.current.delete(id);
    setTimers(prev => prev.map(x => x.id === id ? resetTimerState(x, clock) : x));
    setNow(clock);
    if (t) armNotif(resetTimerState(t, clock));
  };
  const removeTimer = (id) => {
    const t = timers.find(x => x.id === id);
    if (t) cancelNotif(t);
    notifiedRef.current.delete(id);
    setTimers(prev => prev.filter(x => x.id !== id));
  };

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

  // Alarme quand un minuteur se termine (une seule fois, compatible StrictMode).
  useEffect(() => {
    for (const t of timers) {
      if (t.done && !notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id);
        playAlarm();
        // L'alarme premier plan a joué : on annule la notif OS encore en attente
        // pour éviter une bannière redondante quand le minuteur échoit app ouverte.
        cancelNotif(t);
        notify?.(`Minuteur terminé, ${t.label}`);
      }
    }
  }, [timers, notify]);

  return { timers, timersOpen, setTimersOpen, now, addTimer, toggleTimer, restartTimer, removeTimer };
}
