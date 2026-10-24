import { describe, it, expect } from "vitest";
import { planMealService, serviceRoadmap, ovenSpans, serviceReminders, stepOvenTemperature, stepUsesOven, dateAtClock, ovenConflictMessage, holdAdvice, type ServiceDishInput } from "../mealService.js";
import type { Step } from "@/lib/types.js";

const at = (hours: number, minutes = 0): number => new Date(2026, 9, 24, hours, minutes).getTime();
const step = (duration: number, activeTime: number, text = "Étape"): Step => ({ text, duration, activeTime, durationEstimated: false });
const dish = (id: string, role: ServiceDishInput["role"], steps: Step[]): ServiceDishInput => ({ id, name: id, role, recipe: { steps } });

const veloute = dish("velouté", "entree", [step(15, 15, "Éplucher"), step(25, 0, "Cuire à couvert"), step(5, 5, "Mixer")]);
const gigot = dish("gigot", "plat", [step(60, 0, "Sortir du frigo"), step(15, 15, "Piquer d'ail"), step(60, 1, "Enfourner à 220 °C"), step(15, 0, "Repos"), step(5, 5, "Trancher")]);
const gratin = dish("gratin", "accompagnement", [step(20, 20, "Trancher les pommes de terre"), step(75, 1, "Enfourner à 160 °C")]);
const mousse = dish("mousse", "dessert", [step(20, 20, "Monter la mousse"), step(240, 0, "Réfrigérer 4 h")]);

describe("stepOvenTemperature / stepUsesOven", () => {
  it("lit la température dans les réglages, puis en °C, puis en thermostat", () => {
    expect(stepOvenTemperature({ text: "Cuire", utensilParams: { u1: { temperature: 210, mode: "tournante" } } })).toBe(210);
    expect(stepOvenTemperature({ text: "Enfourner à 180°C" })).toBe(180);
    expect(stepOvenTemperature({ text: "Four th. 6" })).toBe(180);
  });

  it("ignore une température hors plage ou absente", () => {
    expect(stepOvenTemperature({ text: "Chauffer le lait à 37 °C" })).toBeNull();
    expect(stepOvenTemperature({ text: "Cuire", utensilParams: { u1: { temperature: 900 } } })).toBeNull();
    expect(stepOvenTemperature({})).toBeNull();
  });

  it("repère les gestes du four, sans confondre la fourchette", () => {
    expect(stepUsesOven({ text: "Enfourner pour 30 min" })).toBe(true);
    expect(stepUsesOven({ text: "Préchauffer le four" })).toBe(true);
    expect(stepUsesOven({ text: "Écraser à la fourchette" })).toBe(false);
  });
});

describe("planMealService", () => {
  const plan = planMealService([veloute, gigot, gratin, mousse], { serveAt: at(20), now: at(12) });
  const byId = Object.fromEntries(plan.dishes.map(d => [d.id, d]));

  it("décale le service de chaque rôle et range les plats dans l'ordre du repas", () => {
    expect(plan.dishes.map(d => [d.id, d.serveAt])).toEqual([["velouté", at(20)], ["gigot", at(20, 30)], ["gratin", at(20, 30)], ["mousse", at(21, 15)]]);
    expect(plan.end).toBe(at(21, 15));
  });

  it("place le plat le plus long au plus tard", () => {
    expect(byId.gigot.tasks.map(t => [t.start, t.end])).toEqual([
      [at(17, 55), at(18, 55)], [at(18, 55), at(19, 10)], [at(19, 10), at(20, 10)], [at(20, 10), at(20, 25)], [at(20, 25), at(20, 30)],
    ]);
    expect(byId.gigot.hold).toBe(0);
  });

  it("avance le gratin pour libérer le four du gigot, et signale qu'il faudra le garder au chaud", () => {
    expect(byId.gratin.tasks.map(t => [t.start, t.end])).toEqual([[at(17, 35), at(17, 55)], [at(17, 55), at(19, 10)]]);
    expect(plan.ovenConflicts).toEqual([{ dishId: "gratin", stepIndex: 1, withDishId: "gigot", shift: 80, temperature: 160, otherTemperature: 220 }]);
    expect(byId.gratin.hold).toBe(80);
  });

  it("commence par le dessert à préparer d'avance", () => {
    expect(byId.mousse.start).toBe(at(16, 55));
    expect(plan.start).toBe(at(16, 55));
    expect(plan.lateBy).toBe(0);
  });

  it("partage le four entre deux plats à la même température ou sans température connue", () => {
    const tarte = dish("tarte", "dessert", [step(30, 1, "Enfourner à 220 °C")]);
    const legumes = dish("légumes", "accompagnement", [step(60, 1, "Rôtir au four")]);
    const shared = planMealService([gigot, tarte, legumes], { serveAt: at(19, 40), offsets: { dessert: 30, accompagnement: 30 }, now: at(12) });
    expect(shared.ovenConflicts).toEqual([]);
  });

  it("n'attribue jamais deux tâches en main en même temps, sauf à deux en cuisine", () => {
    const salade = dish("salade", "entree", [step(20, 20, "Tailler les crudités")]);
    const tartare = dish("tartare", "plat", [step(20, 20, "Hacher la viande")]);
    const alone = planMealService([salade, tartare], { serveAt: at(20), offsets: { plat: 0 }, now: at(12) });
    const [first, second] = alone.dishes.map(d => d.tasks[0]);
    expect(first.end <= second.start || second.end <= first.start).toBe(true);
    expect(alone.handShifts).toBe(1);
    const together = planMealService([salade, tartare], { serveAt: at(20), offsets: { plat: 0 }, cooks: 2, now: at(12) });
    expect(together.handShifts).toBe(0);
    expect(together.start).toBe(at(19, 40));
  });

  it("chiffre le retard au pas de 5 min", () => {
    expect(planMealService([gigot], { serveAt: at(20), offsets: { plat: 0 }, now: at(17, 32) }).lateBy).toBe(10);
  });

  it("tient un repas vide", () => {
    expect(planMealService([], { serveAt: at(20), now: at(12) })).toMatchObject({ dishes: [], start: at(20), end: at(20), active: 0 });
  });
});

describe("serviceRoadmap / ovenSpans / serviceReminders", () => {
  const plan = planMealService([veloute, gigot, gratin, mousse], { serveAt: at(20), now: at(12) });

  it("mêle les étapes de tous les plats dans l'ordre chronologique", () => {
    const roadmap = serviceRoadmap(plan);
    expect(roadmap[0]).toMatchObject({ dishName: "mousse", start: at(16, 55) });
    expect(roadmap.map(t => t.start)).toEqual([...roadmap.map(t => t.start)].sort((a, b) => a - b));
    // À 17 h 55 : le gigot sort du frigo et le gratin part au four ; le plat passe avant l'accompagnement.
    expect(roadmap.filter(t => t.start === at(17, 55)).map(t => t.dishName)).toEqual(["gigot", "gratin"]);
  });

  it("fusionne les plages de four à même température", () => {
    expect(ovenSpans(plan).map(s => [s.start, s.end, s.temperature, s.dishIds])).toEqual([
      [at(17, 55), at(19, 10), 160, ["gratin"]],
      [at(19, 10), at(20, 10), 220, ["gigot"]],
    ]);
  });

  it("rappelle le départ de chaque plat et les retours après une attente", () => {
    const reminders = serviceReminders(plan, at(17));
    expect(reminders.map(r => [r.dishId, r.kind, r.at])).toEqual([
      ["gratin", "start", at(17, 35)],
      ["gigot", "start", at(17, 55)],
      ["gigot", "resume", at(18, 55)],
      ["velouté", "start", at(19, 15)],
      ["velouté", "resume", at(19, 55)],
      ["gigot", "resume", at(20, 10)],
      ["gigot", "resume", at(20, 25)],
    ]);
  });
});

describe("décalage propre à un plat", () => {
  it("prime sur celui du rôle", () => {
    const plan = planMealService([{ ...mousse, offset: 120 }], { serveAt: at(20), now: at(12) });
    expect(plan.dishes[0].serveAt).toBe(at(22));
  });
});

describe("dateAtClock", () => {
  it("combine un jour du planning et une heure", () => {
    expect(dateAtClock("2026-10-24", "20:30")).toBe(at(20, 30));
  });

  it("refuse un jour ou une heure invalides", () => {
    expect(dateAtClock("2026-02-30", "20:00")).toBeNull();
    expect(dateAtClock("24/10/2026", "20:00")).toBeNull();
    expect(dateAtClock("2026-10-24", "25:00")).toBeNull();
  });
});

describe("ovenConflictMessage / holdAdvice", () => {
  it("explique le conflit de four avec les températures", () => {
    const names: Record<string, string> = { gratin: "Gratin", gigot: "Gigot" };
    expect(ovenConflictMessage({ dishId: "gratin", stepIndex: 1, withDishId: "gigot", shift: 80, temperature: 160, otherTemperature: 220 }, id => names[id])).toEqual({
      title: "Gratin et Gigot voulaient le four en même temps",
      body: "Gratin (160 °C) passe 1 h 20 plus tôt : le four est pris par Gigot (220 °C).",
    });
    expect(ovenConflictMessage({ dishId: "a", stepIndex: 0, withDishId: "b", shift: 45, temperature: null, otherTemperature: 200 }, id => id).body).toBe("a passe 45 min plus tôt : le four est pris par b (200 °C).");
  });

  it("conseille de garder au chaud au-delà de 15 min d'avance", () => {
    expect(holdAdvice({ name: "Gratin", hold: 80 })).toBe("Gratin est prêt 1 h 20 avant de passer à table : garde-le au chaud, ou réchauffe-le quelques minutes juste avant.");
    expect(holdAdvice({ name: "Gratin", hold: 10 })).toBeNull();
  });
});
