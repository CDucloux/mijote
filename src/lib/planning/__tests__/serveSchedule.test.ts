import { describe, it, expect } from "vitest";
import { scheduleService, clockToTime, timeToClock, clockLabel, dayLabel, scheduleDays, serveReminders, timingWarning, stepSummary, reminderMessage } from "../serveSchedule.js";
import type { Step } from "@/lib/types.js";

const at = (day: number, hours: number, minutes = 0): number => new Date(2026, 9, day, hours, minutes).getTime();
const step = (duration: number, activeTime: number, text = "Étape"): Step => ({ text, duration, activeTime, durationEstimated: false });

// Gigot : sortir du frigo (1 h, attente), piquer (15 min), cuire (1 h au four), repos (15 min), trancher (5 min).
const gigot = { steps: [step(60, 0), step(15, 15), step(60, 1), step(15, 0), step(5, 5)] };

describe("scheduleService", () => {
  it("remonte les étapes depuis l'heure de service", () => {
    const schedule = scheduleService(gigot, at(24, 20), at(24, 15));
    expect(schedule.start).toBe(at(24, 17, 25));
    expect(schedule.steps.map(s => [s.start, s.end])).toEqual([
      [at(24, 17, 25), at(24, 18, 25)], [at(24, 18, 25), at(24, 18, 40)], [at(24, 18, 40), at(24, 19, 40)],
      [at(24, 19, 40), at(24, 19, 55)], [at(24, 19, 55), at(24, 20)],
    ]);
    expect(schedule).toMatchObject({ status: "ok", earliestServe: null });
    expect(schedule.timing.active).toBe(21);
  });

  it("en retard, propose l'heure atteignable en commençant maintenant, au pas de 5 min", () => {
    const schedule = scheduleService(gigot, at(24, 20), at(24, 18, 3));
    expect(schedule.status).toBe("late");
    expect(schedule.earliestServe).toBe(at(24, 20, 40));
  });

  it("une recette sans étapes commence à l'heure de service", () => {
    const schedule = scheduleService({ steps: [] }, at(24, 20), at(24, 12));
    expect(schedule).toMatchObject({ start: at(24, 20), steps: [], status: "ok" });
  });
});

describe("clockToTime / timeToClock / clockLabel", () => {
  it("place une heure aujourd'hui ou demain", () => {
    expect(clockToTime("20:00", 0, at(24, 9))).toBe(at(24, 20));
    expect(clockToTime("7:30", 1, at(24, 9))).toBe(at(25, 7, 30));
  });

  it("refuse une heure mal formée ou hors plage", () => {
    expect(clockToTime("", 0, at(24, 9))).toBeNull();
    expect(clockToTime("24:00", 0, at(24, 9))).toBeNull();
    expect(clockToTime("20h", 0, at(24, 9))).toBeNull();
  });

  it("formate pour un champ heure et pour la lecture", () => {
    expect(timeToClock(at(24, 8, 5))).toBe("08:05");
    expect(clockLabel(at(24, 20))).toBe("20 h");
    expect(clockLabel(at(24, 17, 5))).toBe("17 h 05");
  });
});

describe("dayLabel / scheduleDays", () => {
  it("nomme les jours relativement à maintenant", () => {
    const now = at(24, 10);
    expect(dayLabel(at(24, 22), now)).toBe("Aujourd'hui");
    expect(dayLabel(at(25, 1), now)).toBe("Demain");
    expect(dayLabel(at(23, 21), now)).toBe("Hier");
    expect(dayLabel(at(27, 12), now)).toBe("Mardi");
  });

  it("ouvre un groupe par jour quand une marinade commence la veille", () => {
    const recipe = { steps: [step(10, 10), step(720, 0), step(30, 10)] };
    const schedule = scheduleService(recipe, at(25, 12), at(24, 9));
    const days = scheduleDays(schedule, at(24, 9));
    expect(days.map(d => [d.label, d.steps.map(s => s.index)])).toEqual([["Aujourd'hui", [0, 1]], ["Demain", [2]]]);
  });

  it("un déroulé dans la journée tient en un seul groupe", () => {
    expect(scheduleDays(scheduleService(gigot, at(24, 20), at(24, 9)), at(24, 9))).toHaveLength(1);
  });
});

describe("serveReminders", () => {
  it("rappelle le départ et chaque retour après une vraie attente", () => {
    const schedule = scheduleService(gigot, at(24, 20), at(24, 15));
    expect(serveReminders(schedule, at(24, 15))).toEqual([
      { at: at(24, 17, 25), stepIndex: 0, kind: "start" },
      { at: at(24, 18, 25), stepIndex: 1, kind: "resume" },
      { at: at(24, 19, 40), stepIndex: 3, kind: "resume" },
      { at: at(24, 19, 55), stepIndex: 4, kind: "resume" },
    ]);
  });

  it("ignore une attente trop courte et les rappels déjà passés", () => {
    const schedule = scheduleService({ steps: [step(20, 15), step(10, 10)] }, at(24, 20), at(24, 15));
    expect(serveReminders(schedule, at(24, 15))).toEqual([{ at: at(24, 19, 30), stepIndex: 0, kind: "start" }]);
    expect(serveReminders(schedule, at(24, 19, 45))).toEqual([]);
  });
});

describe("timingWarning", () => {
  it("se tait quand toutes les durées viennent de la recette", () => {
    expect(timingWarning(scheduleService(gigot, at(24, 20), at(24, 9)).timing)).toBeNull();
  });

  it("signale les durées estimées, puis les étapes sans durée en priorité", () => {
    expect(timingWarning({ quality: "estimated", steps: [{ minutes: 5, active: 5, source: "text" }, { minutes: 5, active: 5, source: "recipe" }] }))
      .toBe("1 durée estimée : vérifie-les pour un horaire fiable.");
    expect(timingWarning({ quality: "rough", steps: [{ minutes: 5, active: 5, source: "fallback" }, { minutes: 5, active: 5, source: "fallback" }, { minutes: 5, active: 5, source: "estimated" }] }))
      .toBe("2 étapes sans durée, calculées d'après les temps de la recette : l'horaire est approximatif.");
  });

  it("explique l'absence d'étapes", () => {
    expect(timingWarning({ quality: "rough", steps: [] })).toMatch(/pas d'étapes/);
  });
});

describe("stepSummary / reminderMessage", () => {
  it("garde la première phrase, sans point final", () => {
    expect(stepSummary("Préchauffer le four. Beurrer le moule.")).toBe("Préchauffer le four");
    expect(stepSummary("  ")).toBe("Étape suivante");
    expect(stepSummary(undefined)).toBe("Étape suivante");
  });

  it("coupe une phrase trop longue sur un mot", () => {
    const summary = stepSummary("Faire revenir longuement les oignons émincés dans le beurre", 30);
    expect(summary).toBe("Faire revenir longuement les…");
  });

  it("compose le rappel de départ et de retour", () => {
    expect(reminderMessage({ kind: "start" }, "Gigot", "Sortir le gigot du frigo.")).toEqual({ title: "Gigot : c'est l'heure de commencer", body: "Sortir le gigot du frigo" });
    expect(reminderMessage({ kind: "resume" }, "", "Trancher")).toEqual({ title: "Ta recette : retour en cuisine", body: "Trancher" });
  });
});
